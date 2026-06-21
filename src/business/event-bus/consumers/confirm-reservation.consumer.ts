import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { PrismaService } from '../../../common/prisma/prisma.service';
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
  type ConfirmReservationCommand,
  type ReservationConfirmedEvent,
  type ReservationFailedEvent,
} from '../event-types';
import { runWithCorrelationId } from '../../../common/observability/trace-context';
import { MetricsService } from '../../../common/observability/metrics.service';

// Ver nota en outbox.service.ts sobre el typing de tx.
type TxClient = any; // eslint-disable-line @typescript-eslint/no-explicit-any

@Injectable()
export class ConfirmReservationConsumer {
  private readonly logger = new Logger(ConfirmReservationConsumer.name);
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
    routingKey: ROUTING_KEYS.RESERVATION_CONFIRM_REQUESTED,
    queue: QUEUES.CONFIRM_RESERVATION,
    queueOptions: {
      durable: true,
      deadLetterExchange: EXCHANGES.INTEGRATION_DLX,
      deadLetterRoutingKey: 'integracion.confirm-reservation.dead',
    },
  })
  async handle(envelope: EventEnvelope<ConfirmReservationCommand>): Promise<void> {
    if (!isValidEnvelope(envelope) || !envelope.payload?.reservaId || !envelope.payload?.externalId) {
      this.logger.warn(`[confirm-reservation] Envelope inválido, descartando`);
      return;
    }

    const { eventId, correlationId, payload } = envelope;
    const eventType = envelope.eventType;

    await runWithCorrelationId(correlationId, async () => {
      this.logger.log(
        `confirm-reservation: reserva=${payload.reservaId} item=${payload.itemId} externalId=${payload.externalId}`,
      );

      const isDup = await this.inbox.isProcessed(eventId);
      if (isDup) {
        this.logger.log(`Mensaje duplicado ${eventId}, ignorando`);
        return;
      }

      const idKey = {
        reservaId: payload.reservaId,
        itemId: payload.itemId,
        providerId: payload.providerId,
        operation: 'CONFIRM' as const,
      };
      const previous = await this.idempotency.find(idKey);

      if (previous?.status === 'SUCCESS') {
        this.logger.log(`Confirm ya ejecutado, re-publicando integration.reservation.confirmed`);
        await this.publishConfirmed(correlationId, eventId, eventId, eventType, payload);
        this.metrics.incrementProcessed(eventType);
        return;
      }

      if (previous?.status === 'FAILED') {
        this.logger.log(`Confirm previo falló, re-publicando integration.reservation.confirm_failed`);
        const previousPayload = (previous.payload ?? {}) as Record<string, unknown>;
        const previousError = (previousPayload.error ?? { code: 'UNKNOWN', message: 'Previous attempt failed' }) as {
          code: string;
          message: string;
        };
        await this.publishConfirmFailed(correlationId, eventId, eventId, eventType, payload, previousError);
        this.metrics.incrementProcessed(eventType);
        return;
      }

      try {
        const remote = await this.router.confirm(payload.providerType, payload.providerId, payload.externalId);

        await this.prisma.$transaction(async (tx) => {
          await this.inbox.markProcessedTx(tx, eventId, eventType);
          await this.idempotency.save(tx, idKey, {
            status: 'SUCCESS',
            externalId: remote.externalId,
            payload: { status: remote.status, raw: remote.raw },
          });
          await this.publishConfirmedTx(tx, correlationId, eventId, payload);
        });

        this.logger.log(`Confirm OK externalId=${remote.externalId}`);
        this.metrics.incrementProcessed(eventType);
      } catch (err: unknown) {
        const error = err as { isDomainError?: boolean; code?: string; message?: string };

        if (error?.isDomainError === true) {
          const errObj = { code: error.code ?? 'DOMAIN_ERROR', message: error.message ?? 'Domain error' };
          await this.prisma.$transaction(async (tx) => {
            await this.inbox.markProcessedTx(tx, eventId, eventType);
            await this.idempotency.save(tx, idKey, {
              status: 'FAILED',
              externalId: payload.externalId,
              payload: { error: errObj },
            });
            await this.publishConfirmFailedTx(tx, correlationId, eventId, payload, errObj);
          });
          this.logger.warn(`[confirm-reservation] dominio: ${error.message}`);
          this.metrics.incrementFailed(eventType);
          return;
        }

        this.logger.error(`[confirm-reservation] infra, reintentando: ${error.message}`);
        this.metrics.incrementFailed(eventType);
        throw err;
      }
    });
  }

  private async publishConfirmedTx(
    tx: TxClient,
    correlationId: string,
    causationId: string,
    cmd: ConfirmReservationCommand,
  ): Promise<void> {
    const event: ReservationConfirmedEvent = {
      reservaId: cmd.reservaId,
      itemId: cmd.itemId,
      providerId: cmd.providerId,
      externalId: cmd.externalId,
    };
    await this.outbox.save(
      tx,
      EXCHANGES.INTEGRATION_EVENTS,
      ROUTING_KEYS.RESERVATION_CONFIRMED,
      wrap(ROUTING_KEYS.RESERVATION_CONFIRMED, event, { correlationId, causationId, source: this.source }),
    );
  }

  private async publishConfirmed(
    correlationId: string,
    causationId: string,
    eventId: string,
    eventType: string,
    cmd: ConfirmReservationCommand,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.inbox.markProcessedTx(tx, eventId, eventType);
      await this.publishConfirmedTx(tx, correlationId, causationId, cmd);
    });
  }

  private async publishConfirmFailedTx(
    tx: TxClient,
    correlationId: string,
    causationId: string,
    cmd: ConfirmReservationCommand,
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
      ROUTING_KEYS.RESERVATION_CONFIRM_FAILED,
      wrap(ROUTING_KEYS.RESERVATION_CONFIRM_FAILED, event, { correlationId, causationId, source: this.source }),
    );
  }

  private async publishConfirmFailed(
    correlationId: string,
    causationId: string,
    eventId: string,
    eventType: string,
    cmd: ConfirmReservationCommand,
    err: { code: string; message: string },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.inbox.markProcessedTx(tx, eventId, eventType);
      await this.publishConfirmFailedTx(tx, correlationId, causationId, cmd, err);
    });
  }
}
