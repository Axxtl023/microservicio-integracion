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

// Hoteles
import { HOTEL_PROVIDER_IDS, type HotelProviderKey } from '../../../business/hoteles/hotel-provider-routing';
import type { IReservaHotelClient } from '../../../business/hoteles/i-reserva-hotel.client';
import { IHOTELES_CLIENT } from '../../../infrastructure/hoteles/i-hoteles.client';
import { IHOMIYA_CLIENT } from '../../../infrastructure/homiya/i-homiya.client';
import { IRODRIGOS_CLIENT } from '../../../infrastructure/rodrigos/i-rodrigos.client';
import { IHOUSING_PLACE_CLIENT } from '../../../infrastructure/housing-place/i-housing-place.client';
import { IALOJAEXPRESS_CLIENT } from '../../../infrastructure/aloja-express/i-aloja-express.client';

import type { ReservaExternaDto } from '../../../business/vehiculos/dtos/reserva-externa.dto';
import type { IReservaExternaVueloClient } from '../../../business/vuelos/i-reserva-externa-vuelo.client';
import { FLIGHT_PROVIDER_IDS, type FlightProviderKey } from '../../../business/vuelos/flight-provider-routing';
import { IVUELOS_CLIENT } from '../../../infrastructure/vuelos/i-vuelos.client';
import { ISKYBOOK_CLIENT } from '../../../infrastructure/skybook/i-skybook.client';
import { IAEROWI_LLY_CLIENT } from '../../../infrastructure/aerowilly/i-aerowilly.client';
import { IAEROCORE_CLIENT } from '../../../infrastructure/aerocore/i-aerocore.client';
import type { ReservaVueloExternaDto } from '../../../business/vuelos/dtos/reserva-vuelo-externa.dto';

import type { IReservaExternaAtraccionClient } from '../../../business/atracciones/i-reserva-externa-atraccion.client';
import { TOUR_PROVIDER_IDS, type TourProviderKey } from '../../../business/atracciones/tour-provider-routing';
import { IATRACCIONES_CLIENT } from '../../../infrastructure/atracciones/i-atracciones.client';
import { IATRACCIONCATS_CLIENT } from '../../../infrastructure/atraccioncats/i-atraccioncats.client';
import { IVENTURO_CLIENT } from '../../../infrastructure/venturo/i-venturo.client';
import { INEXTSTOP_CLIENT } from '../../../infrastructure/nextstop/i-nextstop.client';
import type { ReservaAtraccionExternaDto } from '../../../business/atracciones/dtos/reserva-atraccion-externa.dto';

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

interface HotelDetails {
  alojamientoId?: string;
  alojamiento_id?: string;
  habitacionId?: string;
  habitacion_id?: string;
  fechaInicio?: ProtoTimestamp;
  fecha_inicio?: ProtoTimestamp;
  fechaFin?: ProtoTimestamp;
  fecha_fin?: ProtoTimestamp;
}

interface FlightPassenger {
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  documentNumber?: string;
  document_number?: string;
  seatNumber?: string;
  seat_number?: string;
}

interface FlightDetails {
  flightClassId?: string;
  flight_class_id?: string;
  passengers?: FlightPassenger[];
}

interface TourPassenger {
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  documentNumber?: string;
  document_number?: string;
  documentType?: string;
  document_type?: string;
}

interface TourDetails {
  slotId?: string;
  slot_id?: string;
  attractionId?: string;
  attraction_id?: string;
  productOptionId?: string;
  product_option_id?: string;
  passengers?: TourPassenger[];
  contactName?: string;
  contact_name?: string;
  contactEmail?: string;
  contact_email?: string;
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
  hotel?: HotelDetails;
  flight?: FlightDetails;
  tour?: TourDetails;
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

interface HotelProviderRoute {
  key: HotelProviderKey;
  name: string;
  client: IReservaHotelClient;
}

interface FlightProviderRoute {
  key: FlightProviderKey;
  name: string;
  client: IReservaExternaVueloClient;
}

interface TourProviderRoute {
  key: TourProviderKey;
  name: string;
  client: IReservaExternaAtraccionClient;
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

    // Hoteles
    @Inject(IHOTELES_CLIENT) private readonly locus: IReservaHotelClient,
    @Inject(IHOMIYA_CLIENT) private readonly homiya: IReservaHotelClient,
    @Inject(IRODRIGOS_CLIENT) private readonly rodrigos: IReservaHotelClient,
    @Inject(IHOUSING_PLACE_CLIENT) private readonly housingPlace: IReservaHotelClient,
    @Inject(IALOJAEXPRESS_CLIENT) private readonly alojaExpress: IReservaHotelClient,

    @Inject(IVUELOS_CLIENT) private readonly vuelosApp: IReservaExternaVueloClient,
    @Inject(ISKYBOOK_CLIENT) private readonly skybook: IReservaExternaVueloClient,
    @Inject(IAEROWI_LLY_CLIENT) private readonly aeroWilly: IReservaExternaVueloClient,
    @Inject(IAEROCORE_CLIENT) private readonly aeroCore: IReservaExternaVueloClient,
    @Inject(IATRACCIONES_CLIENT) private readonly terraQuest: IReservaExternaAtraccionClient,
    @Inject(IATRACCIONCATS_CLIENT) private readonly atraccionCats: IReservaExternaAtraccionClient,
    @Inject(IVENTURO_CLIENT) private readonly venturo: IReservaExternaAtraccionClient,
    @Inject(INEXTSTOP_CLIENT) private readonly nextStop: IReservaExternaAtraccionClient,
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
      const itemType = item.type ?? ProviderType.PROVIDER_TYPE_UNSPECIFIED;

      if (itemType === ProviderType.FLIGHT) {
        const flightRoute = this.resolveFlightRoute(item);
        const flight = this.requireFlight(item);
        const flightClassId = this.requireString(flight.flightClassId ?? flight.flight_class_id, 'flight.flight_class_id');
        this.logger.log(`[create] FLIGHT provider_name=${flightRoute.name} provider_id=${this.providerId(item)} flight_class_id=${flightClassId}`);
        const remote = await flightRoute.client.crearReservaVueloExterna({
          flightClassId,
          passengers: (flight.passengers ?? []).map((p) => ({
            firstName: p.firstName ?? p.first_name ?? '',
            lastName: p.lastName ?? p.last_name ?? '',
            documentNumber: p.documentNumber ?? p.document_number ?? '',
            seatNumber: p.seatNumber ?? p.seat_number ?? undefined,
          })),
        });
        return this.toFlightMutationResponse(remote);
      }

      if (itemType === ProviderType.TOUR) {
        const tourRoute = this.resolveTourRoute(item);
        const tour = this.requireTour(item);
        const slotId = this.requireString(tour.slotId ?? tour.slot_id, 'tour.slot_id');
        this.logger.log(`[create] TOUR provider_name=${tourRoute.name} provider_id=${this.providerId(item)} slot_id=${slotId}`);
        const remote = await tourRoute.client.crearReservaAtraccionExterna({
          slotId,
          attractionId: this.requireString(tour.attractionId ?? tour.attraction_id, 'tour.attraction_id'),
          productOptionId: this.requireString(tour.productOptionId ?? tour.product_option_id, 'tour.product_option_id'),
          contactName: tour.contactName ?? tour.contact_name ?? '',
          contactEmail: tour.contactEmail ?? tour.contact_email ?? '',
          passengers: (tour.passengers ?? []).map((p) => ({
            firstName: p.firstName ?? p.first_name ?? '',
            lastName: p.lastName ?? p.last_name ?? '',
            documentNumber: p.documentNumber ?? p.document_number ?? '',
            documentType: p.documentType ?? p.document_type ?? 'CI',
          })),
        });
        return this.toTourMutationResponse(remote);
      }

      if (itemType === ProviderType.VEHICLE) {
        const route = this.resolveVehicleRoute(item);
        const vehicle = this.requireVehicle(item);
        const vehiculoId = this.requireString(vehicle.vehiculoId ?? vehicle.vehiculo_id, 'vehicle.vehiculo_id');
        this.logger.log(`[create] [VEHICLE] provider_name=${route.name} provider_id=${this.providerId(item)} vehicle_id=${vehiculoId}`);

        const remote = await route.client.crearReservaExterna({
          vehiculoId,
          clienteId: this.requireString(item.clientId ?? item.client_id, 'client_id'),
          agenciaId: vehicle.agenciaId ?? vehicle.agencia_id,
          fechaInicio: this.timestampToIso(vehicle.fechaInicio ?? vehicle.fecha_inicio),
          fechaFin: this.timestampToIso(vehicle.fechaFin ?? vehicle.fecha_fin),
        });

        return this.toMutationResponse(remote, ProviderType.VEHICLE);
      }

      if (itemType === ProviderType.HOTEL) {
        const route = this.resolveHotelRoute(item);
        const hotel = this.requireHotel(item);
        const alojamientoId = this.requireString(hotel.alojamientoId ?? hotel.alojamiento_id, 'hotel.alojamiento_id');
        const habitacionId = this.requireString(hotel.habitacionId ?? hotel.habitacion_id, 'hotel.habitacion_id');
        this.logger.log(`[create] [HOTEL] provider_name=${route.name} provider_id=${this.providerId(item)} alojamiento_id=${alojamientoId} habitacion_id=${habitacionId}`);

        const remote = await route.client.crearReservaHotel({
          alojamientoId,
          habitacionId,
          clienteId: this.requireString(item.clientId ?? item.client_id, 'client_id'),
          fechaInicio: this.timestampToIso(hotel.fechaInicio ?? hotel.fecha_inicio),
          fechaFin: this.timestampToIso(hotel.fechaFin ?? hotel.fecha_fin),
        });

        return this.toMutationResponse(remote, ProviderType.HOTEL);
      }

      throw new RpcException({ code: status.INVALID_ARGUMENT, message: `ProviderType ${itemType} no soportado para creación remota` });
    } catch (error) {
      throw this.toRpcException(error);
    }
  }

  @GrpcMethod('IntegrationService', 'ConfirmRemoteReservation')
  async confirmRemoteReservation(request: ConfirmRemoteReservationRequest) {
    try {
      const type = request.type ?? ProviderType.PROVIDER_TYPE_UNSPECIFIED;
      const remoteReservationId = this.requireString(
        request.remoteReservationId ?? request.remote_reservation_id,
        'remote_reservation_id',
      );

      if (type === ProviderType.FLIGHT) {
        const flightRoute = this.resolveFlightRoute(request);
        this.logger.log(`[confirm] FLIGHT provider_name=${flightRoute.name} remote_reservation_id=${remoteReservationId}`);
        return this.toFlightMutationResponse(await flightRoute.client.confirmarReservaVueloExterna(remoteReservationId));
      }
      if (type === ProviderType.TOUR) {
        const tourRoute = this.resolveTourRoute(request);
        this.logger.log(`[confirm] TOUR provider_name=${tourRoute.name} remote_reservation_id=${remoteReservationId}`);
        return this.toTourMutationResponse(await tourRoute.client.confirmarReservaAtraccionExterna(remoteReservationId));
      }
      if (type === ProviderType.HOTEL) {
        const route = this.resolveHotelRoute(request);
        this.logger.log(`[confirm] [HOTEL] provider_name=${route.name} provider_id=${this.providerId(request)} remote_reservation_id=${remoteReservationId}`);
        return this.toMutationResponse(await route.client.confirmarReservaHotel(remoteReservationId), ProviderType.HOTEL);
      }

      // Por defecto VEHICLE
      const route = this.resolveVehicleRoute(request);
      this.logger.log(`[confirm] provider_name=${route.name} provider_id=${this.providerId(request)} remote_reservation_id=${remoteReservationId}`);
      return this.toMutationResponse(await route.client.confirmarReservaExterna(remoteReservationId));
    } catch (error) {
      throw this.toRpcException(error);
    }
  }

  @GrpcMethod('IntegrationService', 'CancelRemoteReservation')
  async cancelRemoteReservation(request: CancelRemoteReservationRequest) {
    try {
      const type = request.type ?? ProviderType.PROVIDER_TYPE_UNSPECIFIED;
      const remoteReservationId = this.requireString(
        request.remoteReservationId ?? request.remote_reservation_id,
        'remote_reservation_id',
      );

      if (type === ProviderType.FLIGHT) {
        const flightRoute = this.resolveFlightRoute(request);
        this.logger.log(`[cancel] FLIGHT provider_name=${flightRoute.name} remote_reservation_id=${remoteReservationId}`);
        return this.toFlightMutationResponse(await flightRoute.client.cancelarReservaVueloExterna(remoteReservationId, request.reason));
      }
      if (type === ProviderType.TOUR) {
        const tourRoute = this.resolveTourRoute(request);
        this.logger.log(`[cancel] TOUR provider_name=${tourRoute.name} remote_reservation_id=${remoteReservationId}`);
        return this.toTourMutationResponse(await tourRoute.client.cancelarReservaAtraccionExterna(remoteReservationId, request.reason));
      }
      if (type === ProviderType.HOTEL) {
        const route = this.resolveHotelRoute(request);
        this.logger.log(`[cancel] [HOTEL] provider_name=${route.name} provider_id=${this.providerId(request)} remote_reservation_id=${remoteReservationId}`);
        return this.toMutationResponse(await route.client.cancelarReservaHotel(remoteReservationId, request.reason), ProviderType.HOTEL);
      }

      // Por defecto VEHICLE
      const route = this.resolveVehicleRoute(request);
      this.logger.log(`[cancel] provider_name=${route.name} provider_id=${this.providerId(request)} remote_reservation_id=${remoteReservationId}`);
      return this.toMutationResponse(await route.client.cancelarReservaExterna(remoteReservationId, request.reason));
    } catch (error) {
      throw this.toRpcException(error);
    }
  }

  private async checkAvailability(item: BookingItem) {
    const itemId = item.itemId ?? item.item_id ?? '';
    const itemType = item.type ?? ProviderType.PROVIDER_TYPE_UNSPECIFIED;

    // FLIGHT: optimistic check — la validación real de asientos ocurre en
    // crearReservaVueloExterna (atómica en el proveedor). Si no hay asientos,
    // el create falla con 422 y la saga compensa.
    if (itemType === ProviderType.FLIGHT) {
      return {
        itemId,
        type: ProviderType.FLIGHT,
        providerItemId: item.flight?.flightClassId ?? item.flight?.flight_class_id ?? '',
        available: true,
        reason: '',
      };
    }

    // TOUR: optimistic check — similar to flight, checking capacity atomically on create.
    if (itemType === ProviderType.TOUR) {
      return {
        itemId,
        type: ProviderType.TOUR,
        providerItemId: item.tour?.slotId ?? item.tour?.slot_id ?? '',
        available: true,
        reason: '',
      };
    }

    if (itemType === ProviderType.HOTEL) {
      try {
        const route = this.resolveHotelRoute(item);
        const hotel = this.requireHotel(item);
        const alojamientoId = this.requireString(hotel.alojamientoId ?? hotel.alojamiento_id, 'hotel.alojamiento_id');
        const habitacionId = this.requireString(hotel.habitacionId ?? hotel.habitacion_id, 'hotel.habitacion_id');
        const availability = await route.client.verificarDisponibilidadHotel(alojamientoId, habitacionId);
        return {
          itemId: itemId || alojamientoId,
          type: ProviderType.HOTEL,
          providerItemId: availability.alojamientoId ?? alojamientoId,
          available: availability.disponible,
          reason: availability.mensaje ?? availability.status ?? '',
        };
      } catch (error) {
        return {
          itemId,
          type: ProviderType.HOTEL,
          providerItemId: item.hotel?.alojamientoId ?? item.hotel?.alojamiento_id ?? '',
          available: false,
          reason: error instanceof Error ? error.message : 'Error al consultar disponibilidad del hotel',
        };
      }
    }

    if (itemType === ProviderType.VEHICLE) {
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

    return {
      itemId,
      type: itemType,
      providerItemId: '',
      available: false,
      reason: 'PROVIDER_TYPE_NOT_SUPPORTED',
    };
  }

  private resolveVehicleRoute(input: { type?: ProviderType; providerId?: string; provider_id?: string }): VehicleProviderRoute {
    if (input.type !== ProviderType.VEHICLE) {
      // Guardia defensivo — los métodos públicos del controller ramifican por type
      // ANTES de llamar a resolveVehicleRoute. Si caés acá hay un bug de routing.
      throw new RpcException({
        code: status.INTERNAL,
        message: `resolveVehicleRoute invocado con type=${input.type}; bug de routing per-tipo`,
      });
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

  private resolveHotelRoute(input: { type?: ProviderType; providerId?: string; provider_id?: string }): HotelProviderRoute {
    if (input.type !== ProviderType.HOTEL) {
      throw new RpcException({ code: status.UNIMPLEMENTED, message: 'Esperaba ProviderType.HOTEL' });
    }

    const providerId = this.providerId(input);
    const routes: Record<string, HotelProviderRoute> = {
      [HOTEL_PROVIDER_IDS.LOCUS]: { key: 'LOCUS', name: 'Locus', client: this.locus },
      [HOTEL_PROVIDER_IDS.ALOJA_EXPRESS]: { key: 'ALOJA_EXPRESS', name: 'AlojaExpress', client: this.alojaExpress },
      [HOTEL_PROVIDER_IDS.HOUSING_PLACE]: { key: 'HOUSING_PLACE', name: 'HousingPlace', client: this.housingPlace },
      [HOTEL_PROVIDER_IDS.HOMIYA]: { key: 'HOMIYA', name: 'Homiya', client: this.homiya },
      [HOTEL_PROVIDER_IDS.RODRIGOS]: { key: 'RODRIGOS', name: "Rodrigo's", client: this.rodrigos },
    };

    const route = routes[providerId];
    if (!route) throw new RpcException({ code: status.NOT_FOUND, message: `Proveedor de hotel no soportado: ${providerId}` });
    return route;
  }

  private resolveFlightRoute(input: { type?: ProviderType; providerId?: string; provider_id?: string }): FlightProviderRoute {
    const providerId = this.providerId(input);
    const routes: Record<string, FlightProviderRoute> = {
      [FLIGHT_PROVIDER_IDS.VUELOSAPP]: { key: 'VUELOSAPP', name: 'VuelosApp', client: this.vuelosApp },
      [FLIGHT_PROVIDER_IDS.SKYBOOK]:   { key: 'SKYBOOK',   name: 'SkyBook',   client: this.skybook },
      [FLIGHT_PROVIDER_IDS.AEROWILLY]:  { key: 'AEROWILLY',  name: 'AeroWilly', client: this.aeroWilly },
      [FLIGHT_PROVIDER_IDS.AEROCORE]:   { key: 'AEROCORE',   name: 'AeroCore',  client: this.aeroCore },
    };
    const route = routes[providerId];
    if (!route) throw new ProveedorNoSoportadoError(providerId);
    return route;
  }

  private requireFlight(item: BookingItem): FlightDetails {
    if (!item.flight) {
      throw new ReservaInvalidaError('Integration', 'flight details son requeridos');
    }
    return item.flight;
  }

  private requireTour(item: BookingItem): TourDetails {
    if (!item.tour) {
      throw new ReservaInvalidaError('Integration', 'tour details son requeridos');
    }
    return item.tour;
  }

  private toFlightMutationResponse(remote: ReservaVueloExternaDto) {
    return {
      type: ProviderType.FLIGHT,
      remoteReservationId: remote.id,
      providerReservationCode: remote.reservationCode ?? remote.id,
      status: remote.status,
    };
  }

  private toTourMutationResponse(remote: ReservaAtraccionExternaDto) {
    return {
      type: ProviderType.TOUR,
      remoteReservationId: remote.id,
      providerReservationCode: remote.reservationCode ?? remote.id,
      status: remote.status,
    };
  }

  private resolveTourRoute(input: { type?: ProviderType; providerId?: string; provider_id?: string }): TourProviderRoute {
    const providerId = this.providerId(input);
    const routes: Record<string, TourProviderRoute> = {
      [TOUR_PROVIDER_IDS.TERRAQUEST]: { key: 'TERRAQUEST', name: 'TerraQuest', client: this.terraQuest },
      [TOUR_PROVIDER_IDS.VENTURO]:    { key: 'VENTURO',    name: 'Venturo',    client: this.venturo },
      [TOUR_PROVIDER_IDS.CATS]:       { key: 'CATS',       name: 'AtraccionCaTs', client: this.atraccionCats },
      [TOUR_PROVIDER_IDS.NEXTSTOP]:   { key: 'NEXTSTOP',   name: 'NextStop',   client: this.nextStop },
    };
    const route = routes[providerId];
    if (!route) throw new ProveedorNoSoportadoError(providerId);
    return route;
  }

  private toMutationResponse(remote: { id: string; codigoReserva?: string; status: string }, type: ProviderType = ProviderType.VEHICLE) {
    return {
      type,
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

  private requireHotel(item: BookingItem): HotelDetails {
    if (!item.hotel) {
      throw new ReservaInvalidaError('Integration', 'hotel details son requeridos');
    }
    return item.hotel;
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
    if (value === undefined || value === null) {
      throw new ReservaInvalidaError('Integration', 'fecha_inicio y fecha_fin son requeridas');
    }
    const raw = value.seconds;
    let seconds: number;
    if (typeof raw === 'object' && raw !== null) {
      // gRPC Long object (grpc-js serializa int64 como Long cuando el valor excede Number.MAX_SAFE_INTEGER)
      seconds = typeof raw.toNumber === 'function' ? raw.toNumber() : Number(raw);
    } else if (typeof raw === 'string') {
      seconds = parseInt(raw, 10);
    } else if (typeof raw === 'number') {
      seconds = raw;
    } else {
      throw new ReservaInvalidaError('Integration', `fecha con formato inválido: seconds=${String(raw)}`);
    }
    if (!Number.isFinite(seconds)) {
      throw new ReservaInvalidaError('Integration', `fecha inválida: seconds=${String(raw)} no es un número finito`);
    }
    return new Date(seconds * 1000).toISOString();
  }
}
