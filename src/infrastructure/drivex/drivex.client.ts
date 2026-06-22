import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
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
      baseURL: process.env.DRIVEX_OPERACIONES_URL ?? '',
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // DriveX V2 devuelve camelCase con fallback PascalCase (V1 legacy)
  private mapVehiculo(item: Record<string, unknown>, fallbackId = ''): Vehiculo {
    return {
      id:           String(item.id           ?? item.Id           ?? fallbackId),
      nombre:       String(item.nombre       ?? item.Nombre       ?? ''),
      descripcion:  ((item.descripcion ?? item.Descripcion) as string | null) ?? null,
      precioPorDia: Number(item.precioPorDia ?? item.PrecioPorDia ?? 0),
      moneda:       String(item.moneda       ?? item.Moneda       ?? 'USD'),
      categoria:    ((item.categoria  ?? item.Categoria)  as string | null) ?? null,
      agenciaId:    ((item.agenciaId  ?? item.AgenciaId)  as string | null) ?? null,
      disponible:   item.disponible === true || item.Disponible === true,
      status:       ((item.status     ?? item.Status)     as string | null) ?? null,
      imagenUrl:    ((item.imagenUrl  ?? item.ImagenUrl)  as string | null) ?? null,
    };
  }

  async getVehiculos(_params: Record<string, unknown>): Promise<Vehiculo[]> {
    try {
      const res    = await this.catalogoHttp.get('/vehiculos/booking');
      // API devuelve { success, data: { data: [...] } } — lista doblemente anidada
      const payload = res.data?.data?.data ?? res.data?.Data ?? res.data?.data ?? res.data;
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
      const res     = await this.catalogoHttp.get(`/vehiculos/booking/${id}`);
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
      const res = await this.catalogoHttp.get(`/vehiculos/booking/${id}/disponibilidad`, {
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
        fechaInicio: data.fechaInicio,
        fechaFin:    data.fechaFin,
        total:       50,
        // agenciaId no existe en DriveX — se omite
        // sucursalRetiroId / sucursalEntregaId son opcionales según el contrato
      };

      const idempotencyKey = (data as any).reservaId ?? (data as any).sagaId ?? crypto.randomUUID();

      const config = {
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        }
      };

      this.logger.log(`[${PROV}] Despachando POST real a /reservas/booking. Vehículo: ${payload.vehiculoId}`);

      // Endpoint correcto para integración externa: POST /reservas/booking
      // POST /reservas devuelve 400 — es el endpoint interno de DriveX, no el de integración
      const res = await this.operacionesHttp.post('/reservas', payload, config);
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
      const res = await this.operacionesHttp.patch(`/reservas/booking/${id}`, { status: 'CONFIRMADA', estado: 'CONFIRMADA' });
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
      const res = await this.operacionesHttp.patch(`/reservas/booking/${id}`, { status: 'CANCELADA', estado: 'CANCELADA' });
      const updated = res.data?.data ?? res.data;
      if (!updated || typeof updated !== 'object') throw new Error('Respuesta inválida del proveedor');
      return updated as ReservaExternaDto;
    } catch (err) {
      this.logger.error(`[${PROV}] Error cancelando reserva ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo cancelar la reserva');
    }
  }
}
