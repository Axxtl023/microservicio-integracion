import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { PrismaService } from '../../../common/prisma/prisma.service';

// Ver nota en outbox.service.ts sobre el typing de tx.
type TxClient = any; // eslint-disable-line @typescript-eslint/no-explicit-any
import { InboxService } from '../inbox/inbox.service';
import { OutboxService } from '../outbox/outbox.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { ProviderRouterService } from '../router/provider-router.service';
import { wrap, isValidEnvelope } from '../envelope';
import type { EventEnvelope } from '../envelope';
import {
  EXCHANGES,
  ROUTING_KEYS,
  QUEUES,
  type CreateReservationCommand,
  type ReservationCreatedEvent,
  type ReservationFailedEvent,
} from '../event-types';
import { runWithCorrelationId } from '../../../common/observability/trace-context';
import { MetricsService } from '../../../common/observability/metrics.service';

@Injectable()
export class CreateReservationConsumer {
  private readonly logger = new Logger(CreateReservationConsumer.name);
  private readonly source = 'integracion';

  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService,
    private readonly outbox: OutboxService,
    private readonly idempotency: IdempotencyService,
    private readonly router: ProviderRouterService,
    private readonly metrics: MetricsService,
  ) {}

  @RabbitSubscribe({
    exchange: EXCHANGES.INTEGRATION_COMMANDS,
    routingKey: ROUTING_KEYS.RESERVATION_CREATE_REQUESTED,
    queue: QUEUES.CREATE_RESERVATION,
    queueOptions: {
      durable: true,
      deadLetterExchange: EXCHANGES.INTEGRATION_DLX,
      deadLetterRoutingKey: 'integracion.create-reservation.dead',
    },
  })
  async handle(envelope: EventEnvelope<CreateReservationCommand>): Promise<void> {
    // 1. Validación de envelope — descartar (ACK) si está malformado
    if (!isValidEnvelope(envelope) || !envelope.payload?.reservaId || !envelope.payload?.itemId) {
      this.logger.warn(`[create-reservation] Envelope inválido, descartando`);
      return;
    }

    const { eventId, correlationId, payload } = envelope;
    const eventType = envelope.eventType;

    await runWithCorrelationId(correlationId, async () => {
      this.logger.log(
        `create-reservation: reserva=${payload.reservaId} item=${payload.itemId} provider=${payload.providerId} type=${payload.providerType}`,
      );

      // 2. Idempotencia por mensaje — descarta duplicados de RabbitMQ
      const isDup = await this.inbox.isProcessed(eventId);
      if (isDup) {
        this.logger.log(`Mensaje duplicado ${eventId}, ignorando`);
        return;
      }

      // 3. Idempotencia de negocio — clave compuesta única de integracion
      const idKey = {
        reservaId: payload.reservaId,
        itemId: payload.itemId,
        providerId: payload.providerId,
        operation: 'CREATE' as const,
      };
      const previous = await this.idempotency.find(idKey);

      if (previous?.status === 'SUCCESS') {
        // Ya hubo create exitoso — re-publicar el evento sin tocar al proveedor
        this.logger.log(
          `Reserva ya creada externamente (externalId=${previous.externalId}), re-publicando integration.reservation.created`,
        );
        await this.publishCreated(
          correlationId,
          eventId,
          eventId,
          eventType,
          payload,
          previous.externalId ?? '',
          this.extractExternalCode(previous.payload),
          previous.payload as Record<string, unknown>,
        );
        this.metrics.incrementProcessed(eventType);
        return;
      }

      if (previous?.status === 'FAILED') {
        // Ya falló antes — no reintentar al proveedor, re-publicar el failure
        this.logger.log(`Create previo falló para esta clave, re-publicando integration.reservation.create_failed`);
        const previousPayload = (previous.payload ?? {}) as Record<string, unknown>;
        const previousError = (previousPayload.error ?? { code: 'UNKNOWN', message: 'Previous attempt failed' }) as {
          code: string;
          message: string;
        };
        await this.publishCreateFailed(correlationId, eventId, eventId, eventType, payload, previousError);
        this.metrics.incrementProcessed(eventType);
        return;
      }

      // 4. Primer intento — invocar al proveedor externo (NO atómico con DB)
      try {
        const remote = await this.router.create(payload.providerType, payload.providerId, payload.metadata);

        // 5. Éxito → persistir inbox + idempotency + outbox en UNA transacción
        await this.prisma.$transaction(async (tx) => {
          await this.inbox.markProcessedTx(tx, eventId, eventType);
          await this.idempotency.save(tx, idKey, {
            status: 'SUCCESS',
            externalId: remote.externalId,
            payload: {
              externalCode: remote.externalCode,
              status: remote.status,
              raw: remote.raw,
            },
          });
          await this.publishCreatedTx(tx, correlationId, eventId, payload, remote.externalId, remote.externalCode, remote.raw);
        });

        this.logger.log(`Reserva creada OK externalId=${remote.externalId} status=${remote.status}`);
        this.metrics.incrementProcessed(eventType);
      } catch (err: unknown) {
        const error = err as { isDomainError?: boolean; code?: string; message?: string };

        // 6. Error de dominio (validación, proveedor no soportado, no disponible)
        //    → persistir FAILED + publicar create_failed + ACK (no reintentar)
        if (error?.isDomainError === true) {
          await this.prisma.$transaction(async (tx) => {
            await this.inbox.markProcessedTx(tx, eventId, eventType);
            await this.idempotency.save(tx, idKey, {
              status: 'FAILED',
              externalId: null,
              payload: { error: { code: error.code ?? 'DOMAIN_ERROR', message: error.message ?? 'Domain error' } },
            });
            await this.publishCreateFailedTx(tx, correlationId, eventId, payload, {
              code: error.code ?? 'DOMAIN_ERROR',
              message: error.message ?? 'Domain error',
            });
          });
          this.logger.warn(`[create-reservation] dominio: ${error.message}`);
          this.metrics.incrementFailed(eventType);
          return;
        }

        // 7. Error de infra (red, timeout, 5xx) → throw → RabbitMQ retry → DLX
        this.logger.error(`[create-reservation] infra, reintentando: ${error.message}`);
        this.metrics.incrementFailed(eventType);
        throw err;
      }
    });
  }

  private async publishCreatedTx(
    tx: TxClient,
    correlationId: string,
    causationId: string,
    cmd: CreateReservationCommand,
    externalId: string,
    externalCode: string | undefined,
    raw: Record<string, unknown>,
  ): Promise<void> {
    const event: ReservationCreatedEvent = {
      reservaId: cmd.reservaId,
      itemId: cmd.itemId,
      providerId: cmd.providerId,
      providerType: cmd.providerType,
      externalId,
      externalCode,
      rawProviderResponse: raw,
    };
    await this.outbox.save(
      tx,
      EXCHANGES.INTEGRATION_EVENTS,
      ROUTING_KEYS.RESERVATION_CREATED,
      wrap(ROUTING_KEYS.RESERVATION_CREATED, event, { correlationId, causationId, source: this.source }),
    );
  }

  private async publishCreated(
    correlationId: string,
    causationId: string,
    eventId: string,
    eventType: string,
    cmd: CreateReservationCommand,
    externalId: string,
    externalCode: string | undefined,
    raw: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.inbox.markProcessedTx(tx, eventId, eventType);
      await this.publishCreatedTx(tx, correlationId, causationId, cmd, externalId, externalCode, raw);
    });
  }

  private async publishCreateFailedTx(
    tx: TxClient,
    correlationId: string,
    causationId: string,
    cmd: CreateReservationCommand,
    err: { code: string; message: string },
  ): Promise<void> {
    const event: ReservationFailedEvent = {
      reservaId: cmd.reservaId,
      itemId: cmd.itemId,
      providerId: cmd.providerId,
      providerType: cmd.providerType,
      error: err,
    };
    await this.outbox.save(
      tx,
      EXCHANGES.INTEGRATION_EVENTS,
      ROUTING_KEYS.RESERVATION_CREATE_FAILED,
      wrap(ROUTING_KEYS.RESERVATION_CREATE_FAILED, event, { correlationId, causationId, source: this.source }),
    );
  }

  private async publishCreateFailed(
    correlationId: string,
    causationId: string,
    eventId: string,
    eventType: string,
    cmd: CreateReservationCommand,
    err: { code: string; message: string },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.inbox.markProcessedTx(tx, eventId, eventType);
      await this.publishCreateFailedTx(tx, correlationId, causationId, cmd, err);
    });
  }

  private extractExternalCode(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const code = (payload as Record<string, unknown>).externalCode;
    return typeof code === 'string' ? code : undefined;
  }
}
