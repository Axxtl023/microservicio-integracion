import { Controller, Inject, Logger } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import type { IVehiculosService } from '../../../business/vehiculos/interfaces/i-vehiculos.service';
import { IVEHICULOS_SERVICE } from '../../../business/vehiculos/interfaces/i-vehiculos.service';
import {
  ProveedorIndisponibleError,
  ReservaInvalidaError,
  ReservaNoDisponibleError,
  ReservaNoEncontradaError,
} from '../../../infrastructure/urbancar/urbancar.errors';

enum ProviderType {
  PROVIDER_TYPE_UNSPECIFIED = 0,
  VEHICLE = 1,
  FLIGHT = 2,
  HOTEL = 3,
  TOUR = 4,
}

interface ProtoTimestamp {
  seconds?: number | string | { toNumber?: () => number; toString?: () => string };
  nanos?: number;
}

interface VehicleDetails {
  vehiculoId?: string;
  agenciaId?: string;
  fechaInicio?: ProtoTimestamp | Date | string;
  fechaFin?: ProtoTimestamp | Date | string;
}

interface BookingItem {
  itemId?: string;
  type?: ProviderType | keyof typeof ProviderType;
  clientId?: string;
  amountCents?: number | string;
  vehicle?: VehicleDetails;
  flight?: Record<string, never>;
  hotel?: Record<string, never>;
}

interface CheckBatchAvailabilityRequest {
  items?: BookingItem[];
}

interface CreateRemoteReservationRequest {
  item?: BookingItem;
  idempotencyKey?: string;
}

interface ReservationMutationRequest {
  type?: ProviderType | keyof typeof ProviderType;
  remoteReservationId?: string;
  reason?: string;
  idempotencyKey?: string;
}

@Controller()
export class IntegrationGrpcController {
  private readonly logger = new Logger(IntegrationGrpcController.name);

  constructor(
    @Inject(IVEHICULOS_SERVICE)
    private readonly vehiculosService: IVehiculosService,
  ) {}

  @GrpcMethod('IntegrationService', 'CheckBatchAvailability')
  async checkBatchAvailability(request: CheckBatchAvailabilityRequest) {
    this.logger.log(`CheckBatchAvailability received ${request.items?.length ?? 0} items`);

    const results = await Promise.all(
      (request.items ?? []).map(async (item) => {
        const type = this.normalizeProviderType(item.type);

        if (type !== ProviderType.VEHICLE) {
          return {
            itemId: item.itemId ?? '',
            type,
            providerItemId: '',
            available: false,
            reason: 'PROVIDER_NOT_IMPLEMENTED',
          };
        }

        if (!item.vehicle?.vehiculoId) {
          return {
            itemId: item.itemId ?? '',
            type,
            providerItemId: '',
            available: false,
            reason: 'INVALID_VEHICLE_DETAILS',
          };
        }

        try {
          const availability = await this.vehiculosService.verificarDisponibilidadExterna(
            item.vehicle.vehiculoId,
          );

          return {
            itemId: item.itemId ?? '',
            type,
            providerItemId: availability.vehiculoId ?? item.vehicle.vehiculoId,
            available: Boolean(availability.disponible),
            reason: availability.disponible
              ? ''
              : availability.mensaje ?? availability.status ?? 'NOT_AVAILABLE',
          };
        } catch (err) {
          throw this.toRpcException(err);
        }
      }),
    );

    return {
      allAvailable: results.every((result) => result.available),
      results,
    };
  }

  @GrpcMethod('IntegrationService', 'CreateRemoteReservation')
  async createRemoteReservation(request: CreateRemoteReservationRequest) {
    this.logger.log(`CreateRemoteReservation idempotencyKey=${request.idempotencyKey ?? ''}`);

    try {
      this.assertIdempotencyKey(request.idempotencyKey);
      const item = this.assertVehicleItem(request.item);
      const reservation = await this.vehiculosService.crearReservaExterna({
        vehiculoId: item.vehicle.vehiculoId,
        clienteId: item.clientId ?? '',
        agenciaId: item.vehicle.agenciaId || undefined,
        fechaInicio: this.timestampToIso(item.vehicle.fechaInicio, 'fecha_inicio'),
        fechaFin: this.timestampToIso(item.vehicle.fechaFin, 'fecha_fin'),
      });

      return {
        type: ProviderType.VEHICLE,
        remoteReservationId: reservation.id,
        providerReservationCode: reservation.codigoReserva ?? '',
        status: reservation.status,
      };
    } catch (err) {
      throw this.toRpcException(err);
    }
  }

  @GrpcMethod('IntegrationService', 'ConfirmRemoteReservation')
  async confirmRemoteReservation(request: ReservationMutationRequest) {
    this.logger.log(
      `ConfirmRemoteReservation remoteReservationId=${request.remoteReservationId ?? ''}`,
    );

    try {
      this.assertIdempotencyKey(request.idempotencyKey);
      this.assertVehicleProvider(request.type);
      const remoteReservationId = this.assertRemoteReservationId(request.remoteReservationId);
      const reservation = await this.vehiculosService.confirmarReservaExterna(remoteReservationId);

      return {
        type: ProviderType.VEHICLE,
        remoteReservationId: reservation.id,
        providerReservationCode: reservation.codigoReserva ?? '',
        status: reservation.status,
      };
    } catch (err) {
      throw this.toRpcException(err);
    }
  }

  @GrpcMethod('IntegrationService', 'CancelRemoteReservation')
  async cancelRemoteReservation(request: ReservationMutationRequest) {
    this.logger.log(
      `CancelRemoteReservation remoteReservationId=${request.remoteReservationId ?? ''}`,
    );

    try {
      this.assertIdempotencyKey(request.idempotencyKey);
      this.assertVehicleProvider(request.type);
      const remoteReservationId = this.assertRemoteReservationId(request.remoteReservationId);
      const reservation = await this.vehiculosService.cancelarReservaExterna(
        remoteReservationId,
        request.reason,
      );

      return {
        type: ProviderType.VEHICLE,
        remoteReservationId: reservation.id,
        providerReservationCode: reservation.codigoReserva ?? '',
        status: reservation.status,
      };
    } catch (err) {
      throw this.toRpcException(err);
    }
  }

  private assertVehicleItem(item?: BookingItem): BookingItem & { vehicle: Required<VehicleDetails> } {
    if (!item) {
      throw this.invalidArgument('BookingItem is required');
    }

    this.assertVehicleProvider(item.type);

    if (!item.vehicle?.vehiculoId || !item.clientId) {
      throw this.invalidArgument('Vehicle details and client_id are required');
    }

    return item as BookingItem & { vehicle: Required<VehicleDetails> };
  }

  private assertVehicleProvider(type?: ProviderType | keyof typeof ProviderType): void {
    const normalized = this.normalizeProviderType(type);
    if (normalized !== ProviderType.VEHICLE) {
      throw this.invalidArgument('Provider type is not implemented for this operation');
    }
  }

  private assertIdempotencyKey(idempotencyKey?: string): void {
    if (!idempotencyKey?.trim()) {
      throw this.invalidArgument('idempotency_key is required');
    }
  }

  private assertRemoteReservationId(remoteReservationId?: string): string {
    if (!remoteReservationId?.trim()) {
      throw this.invalidArgument('remote_reservation_id is required');
    }
    return remoteReservationId;
  }

  private normalizeProviderType(type?: ProviderType | keyof typeof ProviderType): ProviderType {
    if (typeof type === 'number') return type;
    if (typeof type === 'string' && type in ProviderType) {
      return ProviderType[type as keyof typeof ProviderType];
    }
    return ProviderType.PROVIDER_TYPE_UNSPECIFIED;
  }

  private timestampToIso(value: ProtoTimestamp | Date | string | undefined, fieldName: string): string {
    if (!value) throw this.invalidArgument(`${fieldName} is required`);
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return new Date(value).toISOString();

    const rawSeconds = value.seconds;
    const seconds =
      typeof rawSeconds === 'number'
        ? rawSeconds
        : typeof rawSeconds === 'string'
          ? Number(rawSeconds)
          : rawSeconds?.toNumber
            ? rawSeconds.toNumber()
            : rawSeconds?.toString
              ? Number(rawSeconds.toString())
              : Number.NaN;

    if (!Number.isFinite(seconds)) {
      throw this.invalidArgument(`${fieldName} must be a valid Timestamp`);
    }

    return new Date(seconds * 1000 + Math.floor((value.nanos ?? 0) / 1_000_000)).toISOString();
  }

  private toRpcException(err: unknown): RpcException {
    if (err instanceof RpcException) return err;
    if (err instanceof ReservaInvalidaError) {
      return this.rpcError(status.INVALID_ARGUMENT, err.message);
    }
    if (err instanceof ReservaNoDisponibleError) {
      return this.rpcError(status.FAILED_PRECONDITION, err.message);
    }
    if (err instanceof ReservaNoEncontradaError) {
      return this.rpcError(status.NOT_FOUND, err.message);
    }
    if (err instanceof ProveedorIndisponibleError) {
      return this.rpcError(status.UNAVAILABLE, err.message);
    }

    const message = err instanceof Error ? err.message : 'Internal integration error';
    return this.rpcError(status.INTERNAL, message);
  }

  private invalidArgument(message: string): RpcException {
    return this.rpcError(status.INVALID_ARGUMENT, message);
  }

  private rpcError(code: status, message: string): RpcException {
    return new RpcException({ code, message });
  }
}
