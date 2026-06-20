import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IZenithDriveClient } from './i-zenith-drive.client';
import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';
import type { CrearReservaExternaDto } from '../../business/vehiculos/dtos/crear-reserva-externa.dto';
import type { DisponibilidadDto } from '../../business/vehiculos/dtos/disponibilidad.dto';
import type { ReservaExternaDto } from '../../business/vehiculos/dtos/reserva-externa.dto';
import { mapHttpToDomainError } from '../../business/vehiculos/errors/map-http-error';
import { JwtTokenCache } from '../../business/vehiculos/jwt-token-cache';

const PROV = 'ZenithDrive';

@Injectable()
export class ZenithDriveClient implements IZenithDriveClient {
  private readonly logger = new Logger(ZenithDriveClient.name);
  private readonly http:   AxiosInstance;
  private readonly auth?: JwtTokenCache;

  constructor() {
    const baseURL = process.env.ZENITH_DRIVE_API_URL ?? '';
    this.http = axios.create({
      baseURL,
      timeout: 4_000,
      headers: { 'Content-Type': 'application/json' },
    });

    if (process.env.ZENITH_DRIVE_BEARER_TOKEN) {
      this.http.interceptors.request.use((config) => {
        config.headers.Authorization = `Bearer ${process.env.ZENITH_DRIVE_BEARER_TOKEN}`;
        return config;
      });
    } else if (process.env.ZENITH_DRIVE_SERVICE_EMAIL && process.env.ZENITH_DRIVE_SERVICE_PASSWORD) {
      this.auth = new JwtTokenCache({
        proveedor: PROV,
        loginUrl: `${baseURL}/v1/auth/login`,
        email: process.env.ZENITH_DRIVE_SERVICE_EMAIL,
        password: process.env.ZENITH_DRIVE_SERVICE_PASSWORD,
      });

      this.http.interceptors.request.use(async (config) => {
        const token = await this.auth!.getValidToken();
        config.headers.Authorization = `Bearer ${token}`;
        return config;
      });

      this.http.interceptors.response.use(
        (response) => response,
        async (error) => {
          const original = error.config;
          if (error.response?.status === 401 && !original?._retry) {
            original._retry = true;
            this.auth!.invalidate();
            const token = await this.auth!.getValidToken();
            original.headers.Authorization = `Bearer ${token}`;
            return this.http.request(original);
          }
          return Promise.reject(error);
        },
      );
    }
  }

  async getVehiculos(_params: Record<string, unknown>): Promise<Vehiculo[]> {
    try {
      const res = await this.http.get('/v1/vehiculos');
      // Tolera { data: [...] } y también un array plano en la raíz
      const items: unknown = res.data?.data?.data || res.data?.data || res.data || [];
      this.logger.log(`[ZenithDrive] ${Array.isArray(items) ? items.length : 0} vehículos obtenidos`);
      return (Array.isArray(items) ? items : []) as Vehiculo[];
    } catch (err) {
      console.error('❌ [ZenithDrive List Error]:', err);
      this.logger.error('[ZenithDrive] Error al obtener vehículos', err);
      throw new ServiceUnavailableException('No se pudo conectar con Zenith Drive');
    }
  }

  async getVehiculoById(id: string): Promise<Vehiculo> {
    try {
      const res  = await this.http.get(`/v1/vehiculos/${id}`);
      const data: unknown = res.data?.data?.data ?? res.data?.data ?? null;
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new NotFoundException(`Vehículo ${id} no encontrado en Zenith Drive`);
      }
      return data as Vehiculo;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if ((err as any)?.response?.status === 404) {
        throw new NotFoundException(`Vehículo ${id} no encontrado en Zenith Drive`);
      }
      this.logger.error(`[ZenithDrive] Error al obtener vehículo ${id}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con Zenith Drive');
    }
  }

  async getDisponibilidad(id: string): Promise<Disponibilidad> {
    try {
      const res = await this.http.get(`/v1/vehiculos/${id}/disponibilidad`);
      const raw: unknown = res.data?.data ?? res.data ?? null;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new NotFoundException(`Disponibilidad de ${id} no encontrada en Zenith Drive`);
      }
      const r = raw as Record<string, unknown>;
      return {
        vehiculoId: String(r.vehiculoId ?? id),
        disponible: r.disponible === true || r.disponible === 'true',
        status:     (r.status  as string | null) ?? null,
        mensaje:    (r.mensaje as string | null) ?? null,
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if ((err as any)?.response?.status === 404) {
        throw new NotFoundException(`Disponibilidad de ${id} no encontrada en Zenith Drive`);
      }
      this.logger.error(`[ZenithDrive] Error al obtener disponibilidad ${id}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con Zenith Drive');
    }
  }

  async verificarDisponibilidadExterna(vehiculoId: string): Promise<DisponibilidadDto> {
    return this.getDisponibilidad(vehiculoId) as Promise<DisponibilidadDto>;
  }

  async crearReservaExterna(data: CrearReservaExternaDto): Promise<ReservaExternaDto> {
    try {
      const res = await this.http.post('/v1/reservas/booking', {
        vehiculoId: data.vehiculoId,
        clienteId: data.clienteId,
        agenciaId: data.agenciaId,
        fechaInicio: this.toDateOnly(data.fechaInicio),
        fechaFin: this.toDateOnly(data.fechaFin),
      });
      return this.unwrap(res.data) as ReservaExternaDto;
    } catch (err) {
      this.logger.error(`[${PROV}] Error creando reserva para vehiculo ${data.vehiculoId}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo crear la reserva');
    }
  }

  async confirmarReservaExterna(id: string): Promise<ReservaExternaDto> {
    try {
      const res = await this.http.patch(`/v1/reservas/booking/${id}`, { status: 'CONFIRMADA' });
      return this.unwrap(res.data) as ReservaExternaDto;
    } catch (err) {
      this.logger.error(`[${PROV}] Error confirmando reserva ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo confirmar la reserva');
    }
  }

  async cancelarReservaExterna(id: string, reason?: string): Promise<ReservaExternaDto> {
    try {
      if (reason) this.logger.log(`[${PROV}] Cancelando reserva ${id}. Razon: ${reason}`);
      const res = await this.http.patch(`/v1/reservas/booking/${id}`, { status: 'CANCELADA' });
      return this.unwrap(res.data) as ReservaExternaDto;
    } catch (err) {
      this.logger.error(`[${PROV}] Error cancelando reserva ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo cancelar la reserva');
    }
  }

  private unwrap(body: unknown): unknown {
    if (body && typeof body === 'object' && 'data' in body) {
      return (body as { data: unknown }).data;
    }
    return body;
  }

  private toDateOnly(value: string): string {
    return value.includes('T') ? value.slice(0, 10) : value;
  }
}
