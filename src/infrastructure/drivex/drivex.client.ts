import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import type { IDriveXClient } from './i-drivex.client';
import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';
import type { CrearReservaExternaDto } from '../../business/vehiculos/dtos/crear-reserva-externa.dto';
import type { DisponibilidadDto } from '../../business/vehiculos/dtos/disponibilidad.dto';
import type { ReservaExternaDto } from '../../business/vehiculos/dtos/reserva-externa.dto';
import { mapHttpToDomainError } from '../../business/vehiculos/errors/map-http-error';

const PROV = 'DriveX';

@Injectable()
export class DriveXClient implements IDriveXClient {
  private readonly logger = new Logger(DriveXClient.name);
  private readonly catalogoHttp: AxiosInstance;
  private readonly operacionesHttp: AxiosInstance;

  constructor() {
    this.catalogoHttp = axios.create({
      baseURL: process.env.DRIVEX_CATALOGO_URL ?? '',
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
    });
    this.operacionesHttp = axios.create({
      baseURL: process.env.DRIVEX_OPERACIONES_URL ?? process.env.DRIVEX_CATALOGO_URL ?? '',
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getVehiculos(_params: Record<string, unknown>): Promise<Vehiculo[]> {
    try {
      const res    = await this.catalogoHttp.get('/vehiculos');
      const payload = res.data?.data ?? res.data;
      const raw     = Array.isArray(payload) ? payload : [];
      const items: Vehiculo[] = raw.map((item: Record<string, unknown>) => ({
        id:           String(item.id           ?? ''),
        nombre:       String(item.nombre       ?? ''),
        descripcion:  (item.descripcion  as string | null) ?? null,
        precioPorDia: Number(item.precioPorDia || 0),
        moneda:       String(item.moneda       ?? 'USD'),
        categoria:    (item.categoria    as string | null) ?? null,
        agenciaId:    null,
        disponible:   item.disponible === true || item.disponible === 'true',
        status:       null,
        imagenUrl:    (item.imagenUrl    as string | null) ?? null,
      }));
      this.logger.log(`[${PROV}] ${items.length} vehículos obtenidos`);
      return items;
    } catch (err) {
      this.logger.error(`[${PROV}] Error al obtener vehículos`, err);
      throw new ServiceUnavailableException(`No se pudo conectar con ${PROV}`);
    }
  }

  async getVehiculoById(id: string): Promise<Vehiculo> {
    try {
      const res     = await this.catalogoHttp.get(`/vehiculos/${id}`);
      const payload = res.data?.data ?? res.data;
      if (!payload || typeof payload !== 'object') {
        throw new NotFoundException(`Vehículo ${id} no encontrado en ${PROV}`);
      }
      const item = payload as Record<string, unknown>;
      return {
        id:           String(item.id           ?? id),
        nombre:       String(item.nombre       ?? ''),
        descripcion:  (item.descripcion  as string | null) ?? null,
        precioPorDia: Number(item.precioPorDia || 0),
        moneda:       String(item.moneda       ?? 'USD'),
        categoria:    (item.categoria    as string | null) ?? null,
        agenciaId:    null,
        disponible:   item.disponible === true || item.disponible === 'true',
        status:       null,
        imagenUrl:    (item.imagenUrl    as string | null) ?? null,
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        throw new NotFoundException(`Vehículo ${id} no encontrado en ${PROV}`);
      }
      this.logger.error(`[${PROV}] Error al obtener vehículo ${id}`, err);
      throw new ServiceUnavailableException(`No se pudo conectar con ${PROV}`);
    }
  }

  async getDisponibilidad(id: string): Promise<Disponibilidad> {
    try {
      const hoy    = new Date().toISOString().split('T')[0];
      const manana = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
      const res = await this.catalogoHttp.get(`/vehiculos/${id}/disponibilidad`, {
        params: { fechaInicio: hoy, fechaFin: manana },
      });
      const payload = res.data?.data ?? res.data;
      if (!payload || typeof payload !== 'object') {
        throw new NotFoundException(`Disponibilidad de ${id} no encontrada en ${PROV}`);
      }
      const r = payload as Record<string, unknown>;
      return {
        vehiculoId: String(r.vehiculoId ?? id),
        disponible: r.disponible === true || r.disponible === 'true',
        status:     null,
        mensaje:    null,
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        throw new NotFoundException(`Disponibilidad de ${id} no encontrada en ${PROV}`);
      }
      this.logger.error(`[${PROV}] Error al obtener disponibilidad ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo consultar disponibilidad');
    }
  }

  // ─── Reservas externas ──────────────────────────────────────────────────────
  async verificarDisponibilidadExterna(vehiculoId: string): Promise<DisponibilidadDto> {
    return this.getDisponibilidad(vehiculoId) as Promise<DisponibilidadDto>;
  }

  async crearReservaExterna(data: CrearReservaExternaDto): Promise<ReservaExternaDto> {
    try {
      const res = await this.operacionesHttp.post('/reservas', data);
      const created = res.data?.data ?? res.data;
      if (!created || typeof created !== 'object') throw new Error('Respuesta inválida del proveedor');
      return created as ReservaExternaDto;
    } catch (err) {
      this.logger.error(`[${PROV}] Error creando reserva para vehiculo ${data.vehiculoId}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo crear la reserva');
    }
  }

  async confirmarReservaExterna(id: string): Promise<ReservaExternaDto> {
    try {
      const res = await this.operacionesHttp.patch(`/reservas/${id}`, { status: 'CONFIRMADA', estado: 'CONFIRMADA' });
      const updated = res.data?.data ?? res.data;
      if (!updated || typeof updated !== 'object') throw new Error('Respuesta inválida del proveedor');
      return updated as ReservaExternaDto;
    } catch (err) {
      this.logger.error(`[${PROV}] Error confirmando reserva ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo confirmar la reserva');
    }
  }

  async cancelarReservaExterna(id: string, reason?: string): Promise<ReservaExternaDto> {
    try {
      if (reason) this.logger.log(`[${PROV}] Cancelando reserva ${id}. Razón: ${reason}`);
      const res = await this.operacionesHttp.patch(`/reservas/${id}`, { status: 'CANCELADA', estado: 'CANCELADA' });
      const updated = res.data?.data ?? res.data;
      if (!updated || typeof updated !== 'object') throw new Error('Respuesta inválida del proveedor');
      return updated as ReservaExternaDto;
    } catch (err) {
      this.logger.error(`[${PROV}] Error cancelando reserva ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo cancelar la reserva');
    }
  }
}
