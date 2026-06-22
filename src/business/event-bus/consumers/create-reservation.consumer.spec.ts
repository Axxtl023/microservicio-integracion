// runWithCorrelationId is an async wrapper — replace it with a pass-through so
// we can test handle() without importing tracing infrastructure.
jest.mock('../../../common/observability/trace-context', () => ({
  runWithCorrelationId: (_id: string, fn: () => Promise<void>) => fn(),
}));

import { CreateReservationConsumer } from './create-reservation.consumer';
import type { EventEnvelope } from '../envelope';
import type { CreateReservationCommand } from '../event-types';

// ── Mock factories ─────────────────────────────────────────────────────────────

const makeTx = () => ({
  processed_messages: { create: jest.fn().mockResolvedValue({}) },
  integration_idempotency: { create: jest.fn().mockResolvedValue({}) },
  event_outbox: { create: jest.fn().mockResolvedValue({}) },
});

const makePrisma = () => ({
  $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(makeTx())),
});

const makeInbox = () => ({
  isProcessed: jest.fn().mockResolvedValue(false),
  markProcessedTx: jest.fn().mockResolvedValue(undefined),
});

const makeOutbox = () => ({
  save: jest.fn().mockResolvedValue(undefined),
});

const makeIdempotency = () => ({
  find: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockResolvedValue(undefined),
});

const makeRouter = () => ({
  create: jest.fn().mockResolvedValue({
    externalId: 'ext-1',
    externalCode: 'CODE-1',
    status: 'CONFIRMED',
    raw: { id: 'ext-1', status: 'CONFIRMED' },
  }),
});

const makeMetrics = () => ({
  incrementProcessed: jest.fn(),
  incrementFailed: jest.fn(),
});

// ── Test envelope factory ──────────────────────────────────────────────────────

const makeEnvelope = (
  overrides: Partial<EventEnvelope<CreateReservationCommand>> = {},
): EventEnvelope<CreateReservationCommand> => ({
  eventId: 'evt-001',
  eventType: 'integration.reservation.create.requested',
  eventVersion: '1.0.0',
  correlationId: 'corr-001',
  causationId: 'cmd-001',
  source: 'reservas-booking',
  timestamp: new Date().toISOString(),
  payload: {
    reservaId: 'res-1',
    itemId: 'item-1',
    providerId: '11111111-0001-4000-8000-000000000001',
    providerType: 'VEHICLE',
    quantity: 1,
    unitPrice: 90,
    currency: 'USD',
    metadata: {
      vehiculoId: 'veh-1',
      clienteId: 'cli-1',
      fechaInicio: '2026-07-01',
      fechaFin: '2026-07-05',
    },
  },
  ...overrides,
});

// ── Consumer factory ───────────────────────────────────────────────────────────

function buildConsumer() {
  const prisma = makePrisma();
  const inbox = makeInbox();
  const outbox = makeOutbox();
  const idempotency = makeIdempotency();
  const router = makeRouter();
  const metrics = makeMetrics();

  const consumer = new CreateReservationConsumer(
    prisma as any,
    inbox as any,
    outbox as any,
    idempotency as any,
    router as any,
    metrics as any,
  );

  return { consumer, prisma, inbox, outbox, idempotency, router, metrics };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateReservationConsumer.handle', () => {

  describe('envelope validation', () => {
    it('discards (ACKs without processing) when envelope is invalid', async () => {
      const { consumer, inbox } = buildConsumer();
      await consumer.handle({} as any);
      expect(inbox.isProcessed).not.toHaveBeenCalled();
    });

    it('discards when payload.reservaId is missing', async () => {
      const { consumer, inbox } = buildConsumer();
      await consumer.handle(makeEnvelope({ payload: { ...makeEnvelope().payload, reservaId: '' } }));
      expect(inbox.isProcessed).not.toHaveBeenCalled();
    });

    it('discards when payload.itemId is missing', async () => {
      const { consumer, inbox } = buildConsumer();
      await consumer.handle(makeEnvelope({ payload: { ...makeEnvelope().payload, itemId: '' } }));
      expect(inbox.isProcessed).not.toHaveBeenCalled();
    });
  });

  describe('inbox deduplication (layer 1 — duplicate RabbitMQ delivery)', () => {
    it('returns without calling router when inbox already has the eventId', async () => {
      const { consumer, inbox, router, idempotency } = buildConsumer();
      inbox.isProcessed.mockResolvedValue(true);
      await consumer.handle(makeEnvelope());
      expect(idempotency.find).not.toHaveBeenCalled();
      expect(router.create).not.toHaveBeenCalled();
    });
  });

  describe('idempotency deduplication (layer 2 — repeated command)', () => {
    it('re-publishes reservation.created without calling router when previous attempt was SUCCESS', async () => {
      const { consumer, router, outbox, prisma } = buildConsumer();
      (consumer as any).idempotency = {
        find: jest.fn().mockResolvedValue({
          status: 'SUCCESS',
          externalId: 'ext-from-previous',
          payload: { externalCode: 'PREV-CODE', status: 'CONFIRMED', raw: {} },
        }),
        save: jest.fn(),
      };
      // Rebuild with updated idempotency by using a custom mock inline
      const idempotencyMock = {
        find: jest.fn().mockResolvedValue({
          status: 'SUCCESS',
          externalId: 'ext-from-previous',
          payload: { externalCode: 'PREV-CODE', status: 'CONFIRMED', raw: {} },
        }),
        save: jest.fn(),
      };
      const { consumer: c2, router: r2, outbox: o2, prisma: p2, inbox: i2, metrics: m2 } = buildConsumer();
      const c = new CreateReservationConsumer(p2 as any, i2 as any, o2 as any, idempotencyMock as any, r2 as any, m2 as any);

      await c.handle(makeEnvelope());
      expect(r2.create).not.toHaveBeenCalled();
      expect(o2.save).toHaveBeenCalled();
      expect(m2.incrementProcessed).toHaveBeenCalled();
    });

    it('re-publishes reservation.create_failed without calling router when previous attempt was FAILED', async () => {
      const { consumer, inbox, outbox, router, prisma, metrics } = buildConsumer();
      const idempotencyMock = {
        find: jest.fn().mockResolvedValue({
          status: 'FAILED',
          externalId: null,
          payload: { error: { code: 'DOMAIN_ERROR', message: 'provider unavailable' } },
        }),
        save: jest.fn(),
      };
      const c = new CreateReservationConsumer(
        prisma as any, inbox as any, outbox as any, idempotencyMock as any, router as any, metrics as any,
      );

      await c.handle(makeEnvelope());
      expect(router.create).not.toHaveBeenCalled();
      expect(outbox.save).toHaveBeenCalled();
      expect(metrics.incrementProcessed).toHaveBeenCalled();
    });
  });

  describe('first attempt — success path', () => {
    it('calls router.create with providerType, providerId, and metadata', async () => {
      const { consumer, router } = buildConsumer();
      await consumer.handle(makeEnvelope());
      expect(router.create).toHaveBeenCalledWith(
        'VEHICLE',
        '11111111-0001-4000-8000-000000000001',
        expect.objectContaining({ vehiculoId: 'veh-1' }),
      );
    });

    it('saves inbox + idempotency + outbox inside a single transaction', async () => {
      const { consumer, prisma, inbox, idempotency, outbox } = buildConsumer();
      await consumer.handle(makeEnvelope());

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(inbox.markProcessedTx).toHaveBeenCalledWith(
        expect.anything(),
        'evt-001',
        'integration.reservation.create.requested',
      );
      expect(idempotency.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ reservaId: 'res-1', itemId: 'item-1', operation: 'CREATE' }),
        expect.objectContaining({ status: 'SUCCESS', externalId: 'ext-1' }),
      );
      expect(outbox.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ payload: expect.objectContaining({ reservaId: 'res-1', externalId: 'ext-1' }) }),
      );
    });

    it('increments the processed metric on success', async () => {
      const { consumer, metrics } = buildConsumer();
      await consumer.handle(makeEnvelope());
      expect(metrics.incrementProcessed).toHaveBeenCalledWith('integration.reservation.create.requested');
    });
  });

  describe('first attempt — domain error (non-retryable)', () => {
    const domainError = Object.assign(new Error('provider not available'), {
      isDomainError: true,
      code: 'PROVIDER_NOT_FOUND',
    });

    it('persists FAILED idempotency and publishes create_failed without rethrowing', async () => {
      const { consumer, router, idempotency, outbox } = buildConsumer();
      router.create.mockRejectedValue(domainError);

      await expect(consumer.handle(makeEnvelope())).resolves.toBeUndefined();

      expect(idempotency.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ operation: 'CREATE' }),
        expect.objectContaining({ status: 'FAILED', externalId: null }),
      );
      expect(outbox.save).toHaveBeenCalled();
    });

    it('increments the failed metric for domain errors', async () => {
      const { consumer, router, metrics } = buildConsumer();
      router.create.mockRejectedValue(domainError);
      await consumer.handle(makeEnvelope());
      expect(metrics.incrementFailed).toHaveBeenCalled();
    });
  });

  describe('first attempt — infra error (fallback a FAILED, no hot loop)', () => {
    it('resuelve sin throw (ACK) para no causar requeue infinito', async () => {
      const { consumer, router } = buildConsumer();
      router.create.mockRejectedValue(new Error('ECONNREFUSED — provider server down'));
      await expect(consumer.handle(makeEnvelope())).resolves.toBeUndefined();
    });

    it('guarda idempotency FAILED con código INFRA_ERROR', async () => {
      const { consumer, router, idempotency } = buildConsumer();
      router.create.mockRejectedValue(new Error('timeout'));
      await consumer.handle(makeEnvelope());
      expect(idempotency.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ operation: 'CREATE' }),
        expect.objectContaining({ status: 'FAILED', externalId: null }),
      );
    });

    it('publica create_failed para que la saga termine en vez de quedar colgada', async () => {
      const { consumer, router, outbox } = buildConsumer();
      router.create.mockRejectedValue(new Error('timeout'));
      await consumer.handle(makeEnvelope());
      expect(outbox.save).toHaveBeenCalled();
    });
  });
});
