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

  // DriveX devuelve PascalCase: { Success, Message, Data: [...], Errors }
  // Los campos del item también son PascalCase: Id, Nombre, PrecioPorDia, Disponible, etc.
  private mapVehiculo(item: Record<string, unknown>, fallbackId = ''): Vehiculo {
    return {
      id:           String(item.Id           ?? item.id           ?? fallbackId),
      nombre:       String(item.Nombre       ?? item.nombre       ?? ''),
      descripcion:  ((item.Descripcion ?? item.descripcion) as string | null) ?? null,
      precioPorDia: Number(item.PrecioPorDia ?? item.precioPorDia ?? 0),
      moneda:       String(item.Moneda       ?? item.moneda       ?? 'USD'),
      categoria:    ((item.Categoria  ?? item.categoria)  as string | null) ?? null,
      agenciaId:    null,
      disponible:   item.Disponible === true || item.disponible === true,
      status:       null,
      imagenUrl:    ((item.ImagenUrl  ?? item.imagenUrl)  as string | null) ?? null,
    };
  }

  async getVehiculos(_params: Record<string, unknown>): Promise<Vehiculo[]> {
    try {
      const res    = await this.catalogoHttp.get('/vehiculos');
      // API devuelve { Data: [...] } en PascalCase — leer con fallback camelCase
      const payload = res.data?.Data ?? res.data?.data ?? res.data;
      const raw     = Array.isArray(payload) ? payload : [];
      const items: Vehiculo[] = raw.map((item: Record<string, unknown>) => this.mapVehiculo(item));
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
      const payload = res.data?.Data ?? res.data?.data ?? res.data;
      if (!payload || typeof payload !== 'object') {
        throw new NotFoundException(`Vehículo ${id} no encontrado en ${PROV}`);
      }
      return this.mapVehiculo(payload as Record<string, unknown>, id);
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
      // API devuelve { Data: { Disponible, Mensaje } } en PascalCase
      const payload = res.data?.Data ?? res.data?.data ?? res.data;
      if (!payload || typeof payload !== 'object') {
        throw new NotFoundException(`Disponibilidad de ${id} no encontrada en ${PROV}`);
      }
      const r = payload as Record<string, unknown>;
      return {
        vehiculoId: String(r.VehiculoId ?? r.vehiculoId ?? id),
        disponible: r.Disponible === true || r.disponible === true,
        status:     null,
        mensaje:    ((r.Mensaje ?? r.mensaje) as string | null) ?? null,
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

  // DriveX espera fechas en formato YYYY-MM-DD, no ISO datetime
  private toDateOnly(iso: string): string {
    return iso.split('T')[0];
  }

  async crearReservaExterna(data: CrearReservaExternaDto): Promise<ReservaExternaDto> {
    try {
      const payload = {
        vehiculoId:  data.vehiculoId,
        clienteId:   data.clienteId,
        fechaInicio: this.toDateOnly(data.fechaInicio),
        fechaFin:    this.toDateOnly(data.fechaFin),
        total:       0,
        // agenciaId no existe en DriveX — se omite
        // sucursalRetiroId / sucursalEntregaId son opcionales según el contrato
      };
      // Endpoint correcto para integración externa: POST /reservas/booking
      // POST /reservas devuelve 400 — es el endpoint interno de DriveX, no el de integración
      const res = await this.operacionesHttp.post('/reservas/booking', payload);
      // Respuesta directa sin wrapper: { id, estado, total }
      const created = res.data?.data ?? res.data?.Data ?? res.data;
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
