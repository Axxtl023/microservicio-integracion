import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IAeroWillyClient } from './i-aerowilly.client';
import type { Vuelo } from '../../interfaces/vuelos.interface';
import type { CrearReservaVueloExternaDto } from '../../business/vuelos/dtos/crear-reserva-vuelo-externa.dto';
import type { ReservaVueloExternaDto } from '../../business/vuelos/dtos/reserva-vuelo-externa.dto';
import { mapHttpToDomainError } from '../../business/vehiculos/errors/map-http-error';

interface RawAeroWillyClass {
  flightClassId?:  string;
  cabinClass?:     string;
  availableSeats?: number;
  basePrice?:      number;
}

interface RawAeroWillyFlight {
  flightId?:               string;
  id?:                     string;
  flightNumber?:           string;
  origin?:                 string;
  originAirportIata?:      string;
  destination?:            string;
  destinationAirportIata?: string;
  departureDateTime?:      string;
  arrivalDateTime?:        string;
  status?:                 string | null;
  duration?:               number;
  stops?:                  number;
  lowestPrice?:            number;
  airline?:                string | { name?: string; iataCode?: string; logoUrl?: string | null } | null;
  aircraft?:               string | null;
  classes?:                RawAeroWillyClass[];
}

@Injectable()
export class AeroWillyClient implements IAeroWillyClient {
  private readonly logger = new Logger(AeroWillyClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    // AeroWilly es una API pública — no requiere token de autenticación.
    this.http = axios.create({
      baseURL: process.env.AEROWILLY_API_URL ?? '',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getVuelos(): Promise<Vuelo[]> {
    try {
      const res = await this.http.get('/flights');

      // Handles bare array or { data: [...] } envelope
      const payload: unknown = res.data?.data ?? res.data;

      const raw: RawAeroWillyFlight[] = Array.isArray(payload) ? payload : [];

      this.logger.log(`[AeroWilly] ${raw.length} vuelos obtenidos`);

      return raw.map((v): Vuelo => {
        const airlineName =
          typeof v.airline === 'string'
            ? v.airline
            : (v.airline as { name?: string } | null)?.name ?? 'AeroWilly';

        const flightId = v.flightId ?? v.id ?? '';

        return {
          id:                     flightId,
          flightNumber:           v.flightNumber             ?? 'N/A',
          status:                 v.status                   ?? 'SCHEDULED',
          originAirportIata:      v.origin                   ?? v.originAirportIata ?? '',
          destinationAirportIata: v.destination              ?? v.destinationAirportIata ?? '',
          departureDateTime:      v.departureDateTime        ?? '',
          arrivalDateTime:        v.arrivalDateTime          ?? '',
          duration:               v.duration                 ?? 0,
          stops:                  v.stops                    ?? 0,
          lowestPrice:            v.lowestPrice              ?? 0,
          airline: {
            id:       '',
            iataCode: '',
            name:     airlineName,
            logoUrl:  null,
          },
          flightClasses: (v.classes ?? []).map((c) => ({
            id:             c.flightClassId  ?? '',
            flightId,
            cabinClass:     c.cabinClass     ?? '',
            availableSeats: c.availableSeats ?? 0,
            basePrice:      c.basePrice      ?? 0,
            classType:      c.cabinClass     ?? '',
          })),
          // Pass-through AeroWilly native fields for frontend identification and search
          flightId:    v.flightId    ?? undefined,
          origin:      v.origin      ?? undefined,
          destination: v.destination ?? undefined,
          aircraft:    v.aircraft    ?? null,
          proveedor:   'AeroWilly',
        };
      });
    } catch (err) {
      this.logger.error('[AeroWilly] Error de red al llamar /flights', err);
      throw new ServiceUnavailableException('No se pudo conectar con AeroWilly');
    }
  }

  async crearReservaVueloExterna(data: CrearReservaVueloExternaDto): Promise<ReservaVueloExternaDto> {
    try {
      const res = await this.http.post('/reservations', {
        flightClassId: data.flightClassId,
        passengers: data.passengers,
      });
      const body = res.data?.data ?? res.data;
      return this.toReservaDto(body as Record<string, unknown>);
    } catch (err) {
      this.logger.error('[AeroWilly] Error creando reserva de vuelo', err);
      throw mapHttpToDomainError(err, 'AeroWilly', 'No se pudo crear la reserva de vuelo');
    }
  }

  async confirmarReservaVueloExterna(id: string): Promise<ReservaVueloExternaDto> {
    // AeroWilly no expone endpoint de confirmación explícita.
    this.logger.log(`[AeroWilly] confirm no-op para reserva ${id}`);
    return { id, status: 'CONFIRMED' };
  }

  async cancelarReservaVueloExterna(id: string, reason?: string): Promise<ReservaVueloExternaDto> {
    try {
      if (reason) this.logger.log(`[AeroWilly] Cancelando reserva ${id}. Razón: ${reason}`);
      const res = await this.http.patch(`/reservations/${id}/cancel`, {});
      const body = res.data?.data ?? res.data;
      return this.toReservaDto(body as Record<string, unknown>);
    } catch (err) {
      this.logger.error(`[AeroWilly] Error cancelando reserva ${id}`, err);
      throw mapHttpToDomainError(err, 'AeroWilly', 'No se pudo cancelar la reserva de vuelo');
    }
  }

  private toReservaDto(body: Record<string, unknown>): ReservaVueloExternaDto {
    return {
      id: String(body.id ?? ''),
      reservationCode: body.reservationCode ? String(body.reservationCode) : undefined,
      status: String(body.status ?? 'PENDING'),
      flightId: body.flightId ? String(body.flightId) : undefined,
    };
  }
}
