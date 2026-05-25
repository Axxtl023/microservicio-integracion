import { Controller, Inject, Logger } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import type { IReservaExternaClient } from '../../../business/vehiculos/i-reserva-externa.client';
import { IURBANCAR_CLIENT } from '../../../infrastructure/urbancar/i-urbancar.client';
import { IRENTCAR_CLIENT } from '../../../infrastructure/rentcar/i-rentcar.client';
import { IRENTWHEELS_CLIENT } from '../../../infrastructure/rentwheels/i-rentwheels.client';
import { IDRIVEX_CLIENT } from '../../../infrastructure/drivex/i-drivex.client';
import { IZENITH_DRIVE_CLIENT } from '../../../infrastructure/zenith-drive/i-zenith-drive.client';
import {
  ProveedorIndisponibleError,
  ProveedorNoSoportadoError,
  ReservaInvalidaError,
  ReservaNoDisponibleError,
  ReservaNoEncontradaError,
} from '../../../business/vehiculos/errors/vehiculos.errors';
import { VEHICLE_PROVIDER_IDS, type VehicleProviderKey } from '../../../business/vehiculos/provider-routing';
import type { ReservaExternaDto } from '../../../business/vehiculos/dtos/reserva-externa.dto';

enum ProviderType {
  PROVIDER_TYPE_UNSPECIFIED = 0,
  VEHICLE = 1,
  FLIGHT = 2,
  HOTEL = 3,
  TOUR = 4,
}

interface ProtoTimestamp {
  seconds?: number | string | { toNumber?: () => number };
}

interface VehicleDetails {
  vehiculoId?: string;
  vehiculo_id?: string;
  agenciaId?: string;
  agencia_id?: string;
  fechaInicio?: ProtoTimestamp;
  fecha_inicio?: ProtoTimestamp;
  fechaFin?: ProtoTimestamp;
  fecha_fin?: ProtoTimestamp;
}

interface BookingItem {
  itemId?: string;
  item_id?: string;
  type?: ProviderType;
  clientId?: string;
  client_id?: string;
  providerId?: string;
  provider_id?: string;
  vehicle?: VehicleDetails;
}

interface CheckBatchAvailabilityRequest {
  items?: BookingItem[];
}

interface CreateRemoteReservationRequest {
  item?: BookingItem;
  idempotencyKey?: string;
  idempotency_key?: string;
}

interface ConfirmRemoteReservationRequest {
  type?: ProviderType;
  remoteReservationId?: string;
  remote_reservation_id?: string;
  providerId?: string;
  provider_id?: string;
}

interface CancelRemoteReservationRequest extends ConfirmRemoteReservationRequest {
  reason?: string;
}

interface VehicleProviderRoute {
  key: VehicleProviderKey;
  name: string;
  client: IReservaExternaClient;
}

@Controller()
export class IntegrationGrpcController {
  private readonly logger = new Logger(IntegrationGrpcController.name);

  constructor(
    @Inject(IURBANCAR_CLIENT) private readonly urbancar: IReservaExternaClient,
    @Inject(IRENTCAR_CLIENT) private readonly rentcar: IReservaExternaClient,
    @Inject(IRENTWHEELS_CLIENT) private readonly rentwheels: IReservaExternaClient,
    @Inject(IDRIVEX_CLIENT) private readonly drivex: IReservaExternaClient,
    @Inject(IZENITH_DRIVE_CLIENT) private readonly zenithDrive: IReservaExternaClient,
  ) {}

  @GrpcMethod('IntegrationService', 'CheckBatchAvailability')
  async checkBatchAvailability(request: CheckBatchAvailabilityRequest) {
    const results = await Promise.all((request.items ?? []).map((item) => this.checkAvailability(item)));
    return {
      allAvailable: results.every((result) => result.available),
      results,
    };
  }

  @GrpcMethod('IntegrationService', 'CreateRemoteReservation')
  async createRemoteReservation(request: CreateRemoteReservationRequest) {
    try {
      const item = this.requireItem(request.item);
      const route = this.resolveVehicleRoute(item);
      const vehicle = this.requireVehicle(item);
      const vehiculoId = this.requireString(vehicle.vehiculoId ?? vehicle.vehiculo_id, 'vehicle.vehiculo_id');
      this.logger.log(`[create] provider_name=${route.name} provider_id=${this.providerId(item)} vehicle_id=${vehiculoId}`);

      const remote = await route.client.crearReservaExterna({
        vehiculoId,
        clienteId: this.requireString(item.clientId ?? item.client_id, 'client_id'),
        agenciaId: vehicle.agenciaId ?? vehicle.agencia_id,
        fechaInicio: this.timestampToIso(vehicle.fechaInicio ?? vehicle.fecha_inicio),
        fechaFin: this.timestampToIso(vehicle.fechaFin ?? vehicle.fecha_fin),
      });

      return this.toMutationResponse(remote);
    } catch (error) {
      throw this.toRpcException(error);
    }
  }

  @GrpcMethod('IntegrationService', 'ConfirmRemoteReservation')
  async confirmRemoteReservation(request: ConfirmRemoteReservationRequest) {
    try {
      const route = this.resolveVehicleRoute(request);
      const remoteReservationId = this.requireString(
        request.remoteReservationId ?? request.remote_reservation_id,
        'remote_reservation_id',
      );
      this.logger.log(`[confirm] provider_name=${route.name} provider_id=${this.providerId(request)} remote_reservation_id=${remoteReservationId}`);
      return this.toMutationResponse(await route.client.confirmarReservaExterna(remoteReservationId));
    } catch (error) {
      throw this.toRpcException(error);
    }
  }

  @GrpcMethod('IntegrationService', 'CancelRemoteReservation')
  async cancelRemoteReservation(request: CancelRemoteReservationRequest) {
    try {
      const route = this.resolveVehicleRoute(request);
      const remoteReservationId = this.requireString(
        request.remoteReservationId ?? request.remote_reservation_id,
        'remote_reservation_id',
      );
      this.logger.log(`[cancel] provider_name=${route.name} provider_id=${this.providerId(request)} remote_reservation_id=${remoteReservationId}`);
      return this.toMutationResponse(await route.client.cancelarReservaExterna(remoteReservationId, request.reason));
    } catch (error) {
      throw this.toRpcException(error);
    }
  }

  private async checkAvailability(item: BookingItem) {
    const itemId = item.itemId ?? item.item_id ?? '';
    const itemType = item.type ?? ProviderType.PROVIDER_TYPE_UNSPECIFIED;

    // Si el tipo no es VEHICLE, no rompemos el batch entero — devolvemos
    // available=false para ese item y dejamos que los vehículos sigan.
    // Cuando se sumen FLIGHT/HOTEL/TOUR, este bloque enruta al service correcto.
    if (itemType !== ProviderType.VEHICLE) {
      return {
        itemId,
        type: itemType,
        providerItemId: '',
        available: false,
        reason: 'NOT_VEHICLE',
      };
    }

    try {
      const route = this.resolveVehicleRoute(item);
      const vehicle = this.requireVehicle(item);
      const vehiculoId = this.requireString(vehicle.vehiculoId ?? vehicle.vehiculo_id, 'vehicle.vehiculo_id');
      const availability = await route.client.verificarDisponibilidadExterna(vehiculoId);
      return {
        itemId: itemId || vehiculoId,
        type: ProviderType.VEHICLE,
        providerItemId: availability.vehiculoId ?? vehiculoId,
        available: availability.disponible,
        reason: availability.mensaje ?? availability.status ?? '',
      };
    } catch (error) {
      if (
        error instanceof ReservaNoDisponibleError ||
        error instanceof ReservaNoEncontradaError ||
        error instanceof ProveedorNoSoportadoError
      ) {
        return {
          itemId,
          type: ProviderType.VEHICLE,
          providerItemId: item.vehicle?.vehiculoId ?? item.vehicle?.vehiculo_id ?? '',
          available: false,
          reason: error.message,
        };
      }
      throw this.toRpcException(error);
    }
  }

  private resolveVehicleRoute(input: { type?: ProviderType; providerId?: string; provider_id?: string }): VehicleProviderRoute {
    if (input.type !== ProviderType.VEHICLE) {
      throw new RpcException({ code: status.UNIMPLEMENTED, message: 'Solo ProviderType.VEHICLE esta implementado por ahora' });
    }

    const providerId = this.providerId(input);
    const routes: Record<string, VehicleProviderRoute> = {
      [VEHICLE_PROVIDER_IDS.URBANCAR]: { key: 'URBANCAR', name: 'UrbanCar', client: this.urbancar },
      [VEHICLE_PROVIDER_IDS.RENTCAR]: { key: 'RENTCAR', name: 'RentCar', client: this.rentcar },
      [VEHICLE_PROVIDER_IDS.RENTWHEELS]: { key: 'RENTWHEELS', name: 'RentWheels', client: this.rentwheels },
      [VEHICLE_PROVIDER_IDS.DRIVEX]: { key: 'DRIVEX', name: 'DriveX', client: this.drivex },
      [VEHICLE_PROVIDER_IDS.ZENITH_DRIVE]: { key: 'ZENITH_DRIVE', name: 'ZenithDrive', client: this.zenithDrive },
    };

    const route = routes[providerId];
    if (!route) throw new ProveedorNoSoportadoError(providerId);
    return route;
  }

  private toMutationResponse(remote: ReservaExternaDto) {
    return {
      type: ProviderType.VEHICLE,
      remoteReservationId: remote.id,
      providerReservationCode: remote.codigoReserva ?? remote.id,
      status: remote.status,
    };
  }

  private toRpcException(error: unknown): RpcException {
    if (error instanceof RpcException) return error;
    if (error instanceof ReservaInvalidaError) {
      return new RpcException({ code: status.INVALID_ARGUMENT, message: error.message });
    }
    if (error instanceof ReservaNoDisponibleError) {
      return new RpcException({ code: status.FAILED_PRECONDITION, message: error.message });
    }
    if (error instanceof ReservaNoEncontradaError || error instanceof ProveedorNoSoportadoError) {
      return new RpcException({ code: status.NOT_FOUND, message: error.message });
    }
    if (error instanceof ProveedorIndisponibleError) {
      return new RpcException({ code: status.UNAVAILABLE, message: error.message });
    }
    const message = error instanceof Error ? error.message : 'Error de integracion';
    return new RpcException({ code: status.UNKNOWN, message });
  }

  private requireItem(item: BookingItem | undefined): BookingItem {
    if (!item) {
      throw new ReservaInvalidaError('Integration', 'item es requerido');
    }
    return item;
  }

  private requireVehicle(item: BookingItem): VehicleDetails {
    if (!item.vehicle) {
      throw new ReservaInvalidaError('Integration', 'vehicle details son requeridos');
    }
    return item.vehicle;
  }

  private providerId(input: { providerId?: string; provider_id?: string }): string {
    return this.requireString(input.providerId ?? input.provider_id, 'provider_id');
  }

  private requireString(value: string | undefined, field: string): string {
    if (!value) {
      throw new ReservaInvalidaError('Integration', `${field} es requerido`);
    }
    return value;
  }

  private timestampToIso(value: ProtoTimestamp | undefined): string {
    if (!value?.seconds) {
      throw new ReservaInvalidaError('Integration', 'fecha_inicio y fecha_fin son requeridas');
    }
    const seconds = typeof value.seconds === 'object' ? value.seconds.toNumber?.() : value.seconds;
    // ISO 8601 completo con UTC. Proveedores que requieran date-only
    // (Zenith, RentCar) hacen el slice en su propio cliente — ver Zenith.toDateOnly().
    return new Date(Number(seconds) * 1000).toISOString();
  }
}
