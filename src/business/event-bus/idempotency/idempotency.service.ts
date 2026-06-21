import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

// Ver nota en outbox.service.ts sobre el typing de tx.
type TxClient = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type IntegrationOperation = 'CREATE' | 'CONFIRM' | 'CANCEL';
export type IntegrationStatus = 'SUCCESS' | 'FAILED';

export interface IdempotencyKey {
  reservaId: string;
  itemId: string;
  providerId: string;
  operation: IntegrationOperation;
}

export interface IdempotencyRecord {
  status: IntegrationStatus;
  externalId: string | null;
  payload: unknown;
}

/**
 * Idempotencia de negocio única de integracion.
 *
 * Clave compuesta (reservaId + itemId + providerId + operation) porque este micro
 * procesa N items por reserva, uno por proveedor. Cuando el orquestador reintenta
 * un comando, este lookup evita doble llamada al proveedor externo (ej: doble
 * booking en UrbanCar).
 *
 * La transaccionalidad NO cubre la HTTP call al proveedor — solo el INSERT en
 * idempotency + el INSERT en outbox. Por eso es vital que el consumer haga el
 * SELECT antes del POST: si la HTTP call ya tuvo éxito en un intento previo, se
 * republica el resultado guardado sin tocar al proveedor.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca un registro previo de idempotencia para una clave dada.
   * Devuelve null si nunca se intentó esta combinación.
   */
  async find(key: IdempotencyKey): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.integration_idempotency.findUnique({
      where: {
        reserva_id_item_id_provider_id_operation: {
          reserva_id: key.reservaId,
          item_id: key.itemId,
          provider_id: key.providerId,
          operation: key.operation,
        },
      },
    });

    if (!row) return null;

    return {
      status: row.status as IntegrationStatus,
      externalId: row.external_id,
      payload: row.payload,
    };
  }

  /**
   * Persiste el resultado de una llamada al proveedor externo.
   * Debe llamarse DENTRO de la misma transacción que el outbox.save() para
   * mantener atomicidad entre el resultado de negocio y el evento publicado.
   */
  async save(
    tx: TxClient,
    key: IdempotencyKey,
    record: IdempotencyRecord,
  ): Promise<void> {
    await tx.integration_idempotency.create({
      data: {
        reserva_id: key.reservaId,
        item_id: key.itemId,
        provider_id: key.providerId,
        operation: key.operation,
        status: record.status,
        external_id: record.externalId,
        payload: record.payload as object,
      },
    });
  }
}
