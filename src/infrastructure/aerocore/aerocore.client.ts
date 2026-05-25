import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IAeroCoreClient } from './i-aerocore.client';
import type { CrearReservaVueloExternaDto } from '../../business/vuelos/dtos/crear-reserva-vuelo-externa.dto';
import type { ReservaVueloExternaDto } from '../../business/vuelos/dtos/reserva-vuelo-externa.dto';
import { mapHttpToDomainError } from '../../business/vehiculos/errors/map-http-error';

@Injectable()
export class AeroCoreClient implements IAeroCoreClient {
  private readonly logger = new Logger(AeroCoreClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.AEROCORE_API_URL ?? '',
      timeout: 4_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getVuelos(query: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    try {
      const res = await this.http.get('/flights', { params: query });
      const payload: unknown = res.data?.data ?? res.data ?? [];
      const items = Array.isArray(payload) ? payload : [];
      this.logger.log(`[AeroCore] ${items.length} vuelos obtenidos`);
      return items as Record<string, unknown>[];
    } catch (err) {
      console.error('❌ [AeroCore Error]:', err);
      this.logger.error('[AeroCore] Error al obtener vuelos', err);
      return [];
    }
  }

  async getVueloById(id: string): Promise<Record<string, unknown> | null> {
    try {
      const res = await this.http.get(`/flights/${id}`);
      const payload: unknown = res.data?.data ?? res.data ?? null;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
      return payload as Record<string, unknown>;
    } catch (err) {
      console.error('❌ [AeroCore Error]:', err);
      this.logger.error(`[AeroCore] Error al obtener vuelo ${id}`, err);
      return null;
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
      this.logger.error('[AeroCore] Error creando reserva de vuelo', err);
      throw mapHttpToDomainError(err, 'AeroCore', 'No se pudo crear la reserva de vuelo');
    }
  }

  async confirmarReservaVueloExterna(id: string): Promise<ReservaVueloExternaDto> {
    // AeroCore no expone endpoint de confirmación explícita.
    this.logger.log(`[AeroCore] confirm no-op para reserva ${id}`);
    return { id, status: 'CONFIRMED' };
  }

  async cancelarReservaVueloExterna(id: string, reason?: string): Promise<ReservaVueloExternaDto> {
    try {
      if (reason) this.logger.log(`[AeroCore] Cancelando reserva ${id}. Razón: ${reason}`);
      const res = await this.http.patch(`/reservations/${id}/cancel`, {});
      const body = res.data?.data ?? res.data;
      return {
        id,
        reservationCode: body?.reservationCode ? String(body.reservationCode) : undefined,
        status: 'CANCELLED',
      };
    } catch (err) {
      this.logger.error(`[AeroCore] Error cancelando reserva ${id}`, err);
      throw mapHttpToDomainError(err, 'AeroCore', 'No se pudo cancelar la reserva de vuelo');
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
