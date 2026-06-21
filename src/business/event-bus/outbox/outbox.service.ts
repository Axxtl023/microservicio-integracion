import { Injectable } from '@nestjs/common';
import { EventEnvelope } from '../envelope';

// Prisma 7 + nodenext: el typing de Prisma.TransactionClient no resuelve los
// modelos en este repo (diferencia con identidad-finanzas que no logré aislar).
// Usar `any` para el tx es seguro porque el runtime sí los expone correctamente,
// y los servicios que lo invocan ya tienen tipos estrictos en sus parámetros.
type TxClient = any; // eslint-disable-line @typescript-eslint/no-explicit-any

@Injectable()
export class OutboxService {
  /**
   * Guarda un evento en event_outbox DENTRO de la misma transacción de Prisma.
   * Llamar siempre con el cliente transaccional `tx`.
   * Append-only: los registros nunca se borran (auditoría).
   */
  async save(
    tx: TxClient,
    exchange: string,
    routingKey: string,
    envelope: EventEnvelope,
  ): Promise<void> {
    const payload = envelope.payload as Record<string, unknown> | undefined;
    const aggregateId =
      (payload?.reservaId as string | undefined) ??
      (payload?.itemId as string | undefined) ??
      null;

    await tx.event_outbox.create({
      data: {
        event_id: envelope.eventId,
        event_type: envelope.eventType,
        exchange,
        routing_key: routingKey,
        payload: envelope as object,
        correlation_id: envelope.correlationId ?? null,
        aggregate_id: aggregateId,
      },
    });
  }
}
