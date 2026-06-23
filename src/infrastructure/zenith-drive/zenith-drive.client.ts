import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IZenithDriveClient } from './i-zenith-drive.client';
import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';
import type { CrearReservaExternaDto } from '../../business/vehiculos/dtos/crear-reserva-externa.dto';
import type { DisponibilidadDto } from '../../business/vehiculos/dtos/disponibilidad.dto';
import type { ReservaExternaDto } from '../../business/vehiculos/dtos/reserva-externa.dto';
import { mapHttpToDomainError } from '../../business/vehiculos/errors/map-http-error';

const PROV = 'ZenithDrive';

@Injectable()
export class ZenithDriveClient implements IZenithDriveClient {
  private readonly logger = new Logger(ZenithDriveClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.ZENITH_DRIVE_API_URL ?? '',
      // Zenith está en Azure Container Apps con cold start de ~10-11s. El timeout
      // anterior (10s) producía UNAVAILABLE en la primera request tras inactividad.
      // 30s deja margen para cold start + procesamiento normal (~1.5s).
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private mapVehiculo(raw: Record<string, unknown>): Vehiculo {
    return {
      id:           String(raw.id ?? ''),
      nombre:       String(raw.nombre ?? ''),
      descripcion:  (raw.descripcion as string | null) ?? null,
      precioPorDia: Number(raw.precioPorDia ?? raw.precioDia ?? 0),
      moneda:       String(raw.moneda ?? 'USD'),
      categoria:    (raw.categoria as string | null) ?? null,
      agenciaId:    (raw.agenciaId as string | null) ?? null,
      disponible:   raw.disponible === true || raw.status === 'DISPONIBLE',
      status:       (raw.status as string | null) ?? null,
      imagenUrl:    (raw.imagenUrl as string | null) ?? null,
    };
  }

  async getVehiculos(_params: Record<string, unknown>): Promise<Vehiculo[]> {
    try {
      const res    = await this.http.get('/v1/vehiculos');
      // Respuesta real: { success, data: { data: [...] } }
      const payload: unknown = res.data?.data?.data ?? res.data?.data ?? res.data;
      const raw    = Array.isArray(payload) ? payload : [];
      this.logger.log(`[ZenithDrive] ${raw.length} vehículos obtenidos`);
      return (raw as Record<string, unknown>[]).map(item => this.mapVehiculo(item));
    } catch (err) {
      this.logger.error('[ZenithDrive] Error al obtener vehículos', err);
      throw new ServiceUnavailableException('No se pudo conectar con Zenith Drive');
    }
  }

  async getVehiculoById(id: string): Promise<Vehiculo> {
    try {
      const res  = await this.http.get(`/v1/vehiculos/${id}`);
      // Respuesta real: { success, data: { id, nombre, precioPorDia, ... } }
      const data: unknown = res.data?.data ?? res.data ?? null;
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new NotFoundException(`Vehículo ${id} no encontrado en Zenith Drive`);
      }
      return this.mapVehiculo(data as Record<string, unknown>);
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
      // Path V1: probado con curl directo y devuelve 200/201 CONFIRMADA.
      // El path V2 que se intentó (/api/v2/mateodavid/operaciones/reservas)
      // devuelve 405 Not Allowed (POST no soportado) — el nginx de Zenith
      // no acepta el verbo POST en esa ruta V2. Reverted a V1 que sí funciona.
      const res = await this.http.post('/v1/reservas/booking', {
        vehiculoId: data.vehiculoId,
        clienteId:  data.clienteId,
        agenciaId:  data.agenciaId,
        fechaInicio: this.toDateOnly(data.fechaInicio),
        fechaFin:    this.toDateOnly(data.fechaFin),
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
