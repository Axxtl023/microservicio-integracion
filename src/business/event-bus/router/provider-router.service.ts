import { Inject, Injectable, Logger } from '@nestjs/common';

import type { IReservaExternaClient } from '../../vehiculos/i-reserva-externa.client';
import { IURBANCAR_CLIENT } from '../../../infrastructure/urbancar/i-urbancar.client';
import { IRENTCAR_CLIENT } from '../../../infrastructure/rentcar/i-rentcar.client';
import { IRENTWHEELS_CLIENT } from '../../../infrastructure/rentwheels/i-rentwheels.client';
import { IDRIVEX_CLIENT } from '../../../infrastructure/drivex/i-drivex.client';
import { IZENITH_DRIVE_CLIENT } from '../../../infrastructure/zenith-drive/i-zenith-drive.client';
import { VEHICLE_PROVIDER_IDS } from '../../vehiculos/provider-routing';

import type { IReservaHotelClient } from '../../hoteles/i-reserva-hotel.client';
import { IHOTELES_CLIENT } from '../../../infrastructure/hoteles/i-hoteles.client';
import { IHOMIYA_CLIENT } from '../../../infrastructure/homiya/i-homiya.client';
import { IRODRIGOS_CLIENT } from '../../../infrastructure/rodrigos/i-rodrigos.client';
import { IHOUSING_PLACE_CLIENT } from '../../../infrastructure/housing-place/i-housing-place.client';
import { IALOJAEXPRESS_CLIENT } from '../../../infrastructure/aloja-express/i-aloja-express.client';
import { HOTEL_PROVIDER_IDS } from '../../hoteles/hotel-provider-routing';

import type { IReservaExternaVueloClient } from '../../vuelos/i-reserva-externa-vuelo.client';
import { IVUELOS_CLIENT } from '../../../infrastructure/vuelos/i-vuelos.client';
import { ISKYBOOK_CLIENT } from '../../../infrastructure/skybook/i-skybook.client';
import { IAEROWI_LLY_CLIENT } from '../../../infrastructure/aerowilly/i-aerowilly.client';
import { IAEROCORE_CLIENT } from '../../../infrastructure/aerocore/i-aerocore.client';
import { FLIGHT_PROVIDER_IDS } from '../../vuelos/flight-provider-routing';

import type { IReservaExternaAtraccionClient } from '../../atracciones/i-reserva-externa-atraccion.client';
import { IATRACCIONES_CLIENT } from '../../../infrastructure/atracciones/i-atracciones.client';
import { IATRACCIONCATS_CLIENT } from '../../../infrastructure/atraccioncats/i-atraccioncats.client';
import { IVENTURO_CLIENT } from '../../../infrastructure/venturo/i-venturo.client';
import { INEXTSTOP_CLIENT } from '../../../infrastructure/nextstop/i-nextstop.client';
import { TOUR_PROVIDER_IDS } from '../../atracciones/tour-provider-routing';

import type { ProviderType } from '../event-types';

export interface RemoteReservationResult {
  externalId: string;
  externalCode?: string;
  status: string;
  raw: Record<string, unknown>;
}

export class ProviderNotSupportedError extends Error {
  readonly isDomainError = true;
  readonly code = 'PROVIDER_NOT_SUPPORTED';
  constructor(providerId: string) {
    super(`Proveedor no soportado: ${providerId}`);
  }
}

export class MetadataInvalidError extends Error {
  readonly isDomainError = true;
  readonly code = 'METADATA_INVALID';
  constructor(field: string) {
    super(`metadata.${field} es requerido`);
  }
}

/**
 * Enruta CREATE/CONFIRM/CANCEL al cliente externo correspondiente.
 *
 * Espejo funcional de IntegrationGrpcController para el consumer V2.
 * Acepta payload normalizado del comando (NO el shape gRPC) — el orquestador
 * publica los campos del metadata directamente en la cola.
 *
 * Errores marcados con `isDomainError` deben hacer al consumer publicar
 * `*.create_failed` + ACK (no reintentar). Otros errores son de infra → throw.
 */
@Injectable()
export class ProviderRouterService {
  private readonly logger = new Logger(ProviderRouterService.name);

  constructor(
    @Inject(IURBANCAR_CLIENT) private readonly urbancar: IReservaExternaClient,
    @Inject(IRENTCAR_CLIENT) private readonly rentcar: IReservaExternaClient,
    @Inject(IRENTWHEELS_CLIENT) private readonly rentwheels: IReservaExternaClient,
    @Inject(IDRIVEX_CLIENT) private readonly drivex: IReservaExternaClient,
    @Inject(IZENITH_DRIVE_CLIENT) private readonly zenithDrive: IReservaExternaClient,

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

  async create(
    providerType: ProviderType,
    providerId: string,
    metadata: Record<string, unknown>,
  ): Promise<RemoteReservationResult> {
    if (providerType === 'VEHICLE') {
      const client = this.resolveVehicle(providerId);
      const remote = await client.crearReservaExterna({
        vehiculoId: this.requireString(metadata, 'vehiculoId'),
        clienteId: this.requireString(metadata, 'clienteId'),
        agenciaId: metadata.agenciaId as string | undefined,
        fechaInicio: this.requireString(metadata, 'fechaInicio'),
        fechaFin: this.requireString(metadata, 'fechaFin'),
      });
      return this.toResult(remote.id, remote.status, remote.codigoReserva, remote);
    }

    if (providerType === 'HOTEL') {
      const client = this.resolveHotel(providerId);
      const remote = await client.crearReservaHotel({
        alojamientoId: this.requireString(metadata, 'alojamientoId'),
        habitacionId: this.requireString(metadata, 'habitacionId'),
        clienteId: this.requireString(metadata, 'clienteId'),
        fechaInicio: this.requireString(metadata, 'fechaInicio'),
        fechaFin: this.requireString(metadata, 'fechaFin'),
      });
      return this.toResult(remote.id, remote.status, remote.codigoReserva, remote);
    }

    if (providerType === 'FLIGHT') {
      const client = this.resolveFlight(providerId);
      const passengers = this.requirePassengers(metadata);
      const remote = await client.crearReservaVueloExterna({
        flightClassId: this.requireString(metadata, 'flightClassId'),
        passengers: passengers.map((p) => ({
          firstName: this.requireString(p, 'firstName'),
          lastName: this.requireString(p, 'lastName'),
          documentNumber: this.requireString(p, 'documentNumber'),
          seatNumber: p.seatNumber as string | undefined,
        })),
      });
      return this.toResult(remote.id, remote.status, remote.reservationCode, remote);
    }

    if (providerType === 'TOUR') {
      const client = this.resolveTour(providerId);
      const passengers = this.requirePassengers(metadata);
      const remote = await client.crearReservaAtraccionExterna({
        slotId: this.requireString(metadata, 'slotId'),
        attractionId: this.requireString(metadata, 'attractionId'),
        productOptionId: this.requireString(metadata, 'productOptionId'),
        contactName: this.requireString(metadata, 'contactName'),
        contactEmail: this.requireString(metadata, 'contactEmail'),
        passengers: passengers.map((p) => ({
          firstName: this.requireString(p, 'firstName'),
          lastName: this.requireString(p, 'lastName'),
          documentNumber: this.requireString(p, 'documentNumber'),
          documentType: (p.documentType as string | undefined) ?? 'CI',
        })),
      });
      return this.toResult(remote.id, remote.status, remote.reservationCode, remote);
    }

    throw new MetadataInvalidError(`providerType=${String(providerType)}`);
  }

  async confirm(
    providerType: ProviderType,
    providerId: string,
    externalId: string,
  ): Promise<RemoteReservationResult> {
    if (providerType === 'VEHICLE') {
      const remote = await this.resolveVehicle(providerId).confirmarReservaExterna(externalId);
      return this.toResult(remote.id, remote.status, remote.codigoReserva, remote);
    }
    if (providerType === 'HOTEL') {
      const remote = await this.resolveHotel(providerId).confirmarReservaHotel(externalId);
      return this.toResult(remote.id, remote.status, remote.codigoReserva, remote);
    }
    if (providerType === 'FLIGHT') {
      const remote = await this.resolveFlight(providerId).confirmarReservaVueloExterna(externalId);
      return this.toResult(remote.id, remote.status, remote.reservationCode, remote);
    }
    if (providerType === 'TOUR') {
      const remote = await this.resolveTour(providerId).confirmarReservaAtraccionExterna(externalId);
      return this.toResult(remote.id, remote.status, remote.reservationCode, remote);
    }
    throw new MetadataInvalidError(`providerType=${String(providerType)}`);
  }

  async cancel(
    providerType: ProviderType,
    providerId: string,
    externalId: string,
    reason?: string,
  ): Promise<RemoteReservationResult> {
    if (providerType === 'VEHICLE') {
      const remote = await this.resolveVehicle(providerId).cancelarReservaExterna(externalId, reason);
      return this.toResult(remote.id, remote.status, remote.codigoReserva, remote);
    }
    if (providerType === 'HOTEL') {
      const remote = await this.resolveHotel(providerId).cancelarReservaHotel(externalId, reason);
      return this.toResult(remote.id, remote.status, remote.codigoReserva, remote);
    }
    if (providerType === 'FLIGHT') {
      const remote = await this.resolveFlight(providerId).cancelarReservaVueloExterna(externalId, reason);
      return this.toResult(remote.id, remote.status, remote.reservationCode, remote);
    }
    if (providerType === 'TOUR') {
      const remote = await this.resolveTour(providerId).cancelarReservaAtraccionExterna(externalId, reason);
      return this.toResult(remote.id, remote.status, remote.reservationCode, remote);
    }
    throw new MetadataInvalidError(`providerType=${String(providerType)}`);
  }

  private resolveVehicle(providerId: string): IReservaExternaClient {
    const routes: Record<string, IReservaExternaClient> = {
      [VEHICLE_PROVIDER_IDS.URBANCAR]: this.urbancar,
      [VEHICLE_PROVIDER_IDS.RENTCAR]: this.rentcar,
      [VEHICLE_PROVIDER_IDS.RENTWHEELS]: this.rentwheels,
      [VEHICLE_PROVIDER_IDS.DRIVEX]: this.drivex,
      [VEHICLE_PROVIDER_IDS.ZENITH_DRIVE]: this.zenithDrive,
    };
    const client = routes[providerId];
    if (!client) throw new ProviderNotSupportedError(providerId);
    return client;
  }

  private resolveHotel(providerId: string): IReservaHotelClient {
    const routes: Record<string, IReservaHotelClient> = {
      [HOTEL_PROVIDER_IDS.LOCUS]: this.locus,
      [HOTEL_PROVIDER_IDS.ALOJA_EXPRESS]: this.alojaExpress,
      [HOTEL_PROVIDER_IDS.HOUSING_PLACE]: this.housingPlace,
      [HOTEL_PROVIDER_IDS.HOMIYA]: this.homiya,
      [HOTEL_PROVIDER_IDS.RODRIGOS]: this.rodrigos,
    };
    const client = routes[providerId];
    if (!client) throw new ProviderNotSupportedError(providerId);
    return client;
  }

  private resolveFlight(providerId: string): IReservaExternaVueloClient {
    const routes: Record<string, IReservaExternaVueloClient> = {
      [FLIGHT_PROVIDER_IDS.VUELOSAPP]: this.vuelosApp,
      [FLIGHT_PROVIDER_IDS.SKYBOOK]: this.skybook,
      [FLIGHT_PROVIDER_IDS.AEROWILLY]: this.aeroWilly,
      [FLIGHT_PROVIDER_IDS.AEROCORE]: this.aeroCore,
    };
    const client = routes[providerId];
    if (!client) throw new ProviderNotSupportedError(providerId);
    return client;
  }

  private resolveTour(providerId: string): IReservaExternaAtraccionClient {
    const routes: Record<string, IReservaExternaAtraccionClient> = {
      [TOUR_PROVIDER_IDS.TERRAQUEST]: this.terraQuest,
      [TOUR_PROVIDER_IDS.VENTURO]: this.venturo,
      [TOUR_PROVIDER_IDS.CATS]: this.atraccionCats,
      [TOUR_PROVIDER_IDS.NEXTSTOP]: this.nextStop,
    };
    const client = routes[providerId];
    if (!client) throw new ProviderNotSupportedError(providerId);
    return client;
  }

  private toResult(
    externalId: string,
    status: string,
    externalCode: string | undefined,
    raw: unknown,
  ): RemoteReservationResult {
    return {
      externalId,
      externalCode,
      status,
      raw: raw as Record<string, unknown>,
    };
  }

  private requireString(obj: Record<string, unknown>, field: string): string {
    const value = obj[field];
    if (typeof value !== 'string' || value.length === 0) {
      throw new MetadataInvalidError(field);
    }
    return value;
  }

  private requirePassengers(metadata: Record<string, unknown>): Record<string, unknown>[] {
    const pax = metadata.passengers;
    if (!Array.isArray(pax) || pax.length === 0) {
      throw new MetadataInvalidError('passengers');
    }
    return pax as Record<string, unknown>[];
  }
}
