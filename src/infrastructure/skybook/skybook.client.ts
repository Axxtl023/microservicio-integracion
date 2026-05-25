import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { ISkybookClient } from './i-skybook.client';
import type { Vuelo } from '../../interfaces/vuelos.interface';
import type { CrearReservaVueloExternaDto } from '../../business/vuelos/dtos/crear-reserva-vuelo-externa.dto';
import type { ReservaVueloExternaDto } from '../../business/vuelos/dtos/reserva-vuelo-externa.dto';
import { mapHttpToDomainError } from '../../business/vehiculos/errors/map-http-error';

@Injectable()
export class SkybookClient implements ISkybookClient {
  private readonly logger = new Logger(SkybookClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    // SkyBook es una API pública — no requiere token de autenticación.
    this.http = axios.create({
      baseURL: process.env.SKYBOOK_API_URL ?? '',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getVuelos(): Promise<Vuelo[]> {
    try {
      const res = await this.http.get('/flights');

      // Handles bare array or { data: Vuelo[] } envelope
      const payload: unknown = res.data?.data ?? res.data;

      if (Array.isArray(payload)) {
        this.logger.log(`[SkyBook] ${payload.length} vuelos obtenidos`);
        return payload as Vuelo[];
      }

      this.logger.warn('[SkyBook] Estructura de respuesta inesperada — retornando []', payload);
      return [];
    } catch (err) {
      this.logger.error('[SkyBook] Error de red al llamar /flights', err);
      throw new ServiceUnavailableException('No se pudo conectar con SkyBook');
    }
  }

  async crearReservaVueloExterna(data: CrearReservaVueloExternaDto): Promise<ReservaVueloExternaDto> {
    try {
      // Usamos un userId estático/hardcodeado para identificar al usuario que realiza la reserva
      // ya que la API requiere userId y no hay clientId en el payload de cancelación.
      const userId = 'booking_central_user';
      const res = await this.http.post('/reservations', {
        userId,
        flightClassId: data.flightClassId,
        passengers: data.passengers,
      });
      const body = res.data?.data ?? res.data;
      return this.toReservaDto(body as Record<string, unknown>);
    } catch (err) {
      this.logger.error('[SkyBook] Error creando reserva de vuelo', err);
      throw mapHttpToDomainError(err, 'SkyBook', 'No se pudo crear la reserva de vuelo');
    }
  }

  async confirmarReservaVueloExterna(id: string): Promise<ReservaVueloExternaDto> {
    // SkyBook no expone endpoint de confirmación explícita (queda CONFIRMED desde la creación).
    this.logger.log(`[SkyBook] confirm no-op para reserva ${id}`);
    return { id, status: 'CONFIRMED' };
  }

  async cancelarReservaVueloExterna(id: string, reason?: string): Promise<ReservaVueloExternaDto> {
    try {
      if (reason) this.logger.log(`[SkyBook] Cancelando reserva ${id}. Razón: ${reason}`);
      const userId = 'booking_central_user';
      const res = await this.http.patch(`/reservations/${id}/cancel`, { userId });
      const body = res.data?.data ?? res.data;
      return {
        id,
        reservationCode: body?.reservationCode ? String(body.reservationCode) : undefined,
        status: 'CANCELLED',
      };
    } catch (err) {
      this.logger.error(`[SkyBook] Error cancelando reserva ${id}`, err);
      throw mapHttpToDomainError(err, 'SkyBook', 'No se pudo cancelar la reserva de vuelo');
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
