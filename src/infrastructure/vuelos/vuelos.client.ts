import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import type { IVuelosClient } from './i-vuelos.client';
import type { Vuelo, VuelosApiResponse } from '../../interfaces/vuelos.interface';
import type { CrearReservaVueloExternaDto } from '../../business/vuelos/dtos/crear-reserva-vuelo-externa.dto';
import type { ReservaVueloExternaDto } from '../../business/vuelos/dtos/reserva-vuelo-externa.dto';
import { JwtTokenCache } from '../../business/vehiculos/jwt-token-cache';
import { mapHttpToDomainError } from '../../business/vehiculos/errors/map-http-error';

const PROV = 'VuelosApp';

@Injectable()
export class VuelosClient implements IVuelosClient {
  private readonly logger = new Logger(VuelosClient.name);
  private readonly http:   AxiosInstance;
  private readonly auth:   JwtTokenCache;

  constructor() {
    const baseURL = process.env.VUELOSAPP_BASE_URL ?? '';
    this.http = axios.create({
      baseURL,
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.auth = new JwtTokenCache({
      proveedor: PROV,
      loginUrl: `${baseURL}/auth/login`,
      email: process.env.VUELOSAPP_SERVICE_EMAIL,
      password: process.env.VUELOSAPP_SERVICE_PASSWORD,
    });

    // Request interceptor: agrega Bearer para rutas que lo requieren
    this.http.interceptors.request.use(async (config) => {
      try {
        const token = await this.auth.getValidToken();
        config.headers.Authorization = `Bearer ${token}`;
      } catch {
        // Sin credenciales configuradas — catalog GET funcionará igual (público)
      }
      return config;
    });

    this.http.interceptors.response.use(
      (response) => response,
      async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original?._retry) {
          original._retry = true;
          this.auth.invalidate();
          try {
            const token = await this.auth.getValidToken();
            original.headers.Authorization = `Bearer ${token}`;
            return this.http.request(original);
          } catch {
            // fall through
          }
        }
        return Promise.reject(error);
      },
    );
  }

  async getVuelos(params: Record<string, unknown>): Promise<Vuelo[]> {
    try {
      const res = await this.http.get<VuelosApiResponse>('/flights', { params });
      return res.data?.data ?? [];
    } catch (err) {
      this.logger.error('Error al obtener vuelos de VuelosApp', err);
      throw new ServiceUnavailableException('No se pudo conectar con VuelosApp');
    }
  }

  async crearReservaVueloExterna(data: CrearReservaVueloExternaDto): Promise<ReservaVueloExternaDto> {
    try {
      const res = await this.http.post('/reservations', {
        flightClassId: data.flightClassId,
        passengers: data.passengers,
      });
      const body = res.data?.data ?? res.data;
      return this.toReservaDto(body);
    } catch (err) {
      this.logger.error(`[${PROV}] Error creando reserva de vuelo`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo crear la reserva de vuelo');
    }
  }

  async confirmarReservaVueloExterna(id: string): Promise<ReservaVueloExternaDto> {
    // VuelosApp no expone endpoint de confirmación explícita — la reserva queda
    // activa desde la creación. Devolvemos un DTO sintético para que la saga avance.
    this.logger.log(`[${PROV}] confirm no-op para reserva ${id}`);
    return { id, status: 'CONFIRMED' };
  }

  async cancelarReservaVueloExterna(id: string, reason?: string): Promise<ReservaVueloExternaDto> {
    try {
      if (reason) this.logger.log(`[${PROV}] Cancelando reserva ${id}. Razón: ${reason}`);
      const res = await this.http.patch(`/reservations/${id}/cancel`, {});
      const body = res.data?.data ?? res.data;
      return this.toReservaDto(body);
    } catch (err) {
      this.logger.error(`[${PROV}] Error cancelando reserva ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo cancelar la reserva de vuelo');
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
