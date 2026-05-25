import { Injectable, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { AxiosInstance, AxiosResponse } from 'axios';
import {
  URBANCAR_INVENTORY_HTTP,
  URBANCAR_OPERATIONS_HTTP,
  type IUrbancarClient,
} from './i-urbancar.client';
import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';
import type { CrearReservaExternaDto } from '../../business/vehiculos/dtos/crear-reserva-externa.dto';
import type { DisponibilidadDto } from '../../business/vehiculos/dtos/disponibilidad.dto';
import type { ReservaExternaDto } from '../../business/vehiculos/dtos/reserva-externa.dto';
import { mapHttpToDomainError } from '../../business/vehiculos/errors/map-http-error';

const PROV = 'UrbanCar';

@Injectable()
export class UrbancarClient implements IUrbancarClient {
  private readonly logger = new Logger(UrbancarClient.name);

  constructor(
    @Inject(URBANCAR_INVENTORY_HTTP)  private readonly inventoryHttp: AxiosInstance,
    @Inject(URBANCAR_OPERATIONS_HTTP) private readonly operationsHttp: AxiosInstance,
  ) {}

  // ─── Catálogo (inventory) ───────────────────────────────────────────────────
  async getVehiculos(params: Record<string, unknown>): Promise<Vehiculo[]> {
    try {
      const res: AxiosResponse<unknown> = await this.inventoryHttp.get('/vehiculos/booking', { params });
      const items = this.unwrap(res.data);
      return (Array.isArray(items) ? items : []) as Vehiculo[];
    } catch (err) {
      this.logger.error('Error fetching vehiculos', err);
      throw new ServiceUnavailableException('No se pudo conectar con UrbanCar EC');
    }
  }

  async getVehiculoById(id: string): Promise<Vehiculo> {
    try {
      const res: AxiosResponse<unknown> = await this.inventoryHttp.get(`/vehiculos/booking/${id}`);
      return this.unwrap(res.data) as Vehiculo;
    } catch (err) {
      this.logger.error(`Error fetching vehiculo ${id}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con UrbanCar EC');
    }
  }

  async getDisponibilidad(id: string): Promise<Disponibilidad> {
    try {
      const res: AxiosResponse<unknown> = await this.inventoryHttp.get(`/vehiculos/booking/${id}/disponibilidad`);
      return this.unwrap(res.data) as Disponibilidad;
    } catch (err) {
      this.logger.error(`Error fetching disponibilidad ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo consultar disponibilidad');
    }
  }

  // ─── Reservas externas (operations) ─────────────────────────────────────────
  async verificarDisponibilidadExterna(vehiculoId: string): Promise<DisponibilidadDto> {
    return this.getDisponibilidad(vehiculoId) as Promise<DisponibilidadDto>;
  }

  async crearReservaExterna(data: CrearReservaExternaDto): Promise<ReservaExternaDto> {
    try {
      const res = await this.operationsHttp.post('/reservas/booking', data);
      return this.unwrap(res.data) as ReservaExternaDto;
    } catch (err) {
      this.logger.error(`Error creando reserva externa para vehiculo ${data.vehiculoId}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo crear la reserva');
    }
  }

  async confirmarReservaExterna(id: string): Promise<ReservaExternaDto> {
    try {
      const res = await this.operationsHttp.patch(`/reservas/booking/${id}`, { status: 'CONFIRMADA' });
      return this.unwrap(res.data) as ReservaExternaDto;
    } catch (err) {
      this.logger.error(`Error confirmando reserva ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo confirmar la reserva');
    }
  }

  async cancelarReservaExterna(id: string, reason?: string): Promise<ReservaExternaDto> {
    try {
      if (reason) this.logger.log(`Cancelando reserva ${id}. Razón: ${reason}`);
      const res = await this.operationsHttp.patch(`/reservas/booking/${id}`, { status: 'CANCELADA' });
      return this.unwrap(res.data) as ReservaExternaDto;
    } catch (err) {
      this.logger.error(`Error cancelando reserva ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo cancelar la reserva');
    }
  }

  private unwrap(body: unknown): unknown {
    if (body && typeof body === 'object' && 'data' in (body as object)) {
      const inner = (body as { data: unknown }).data;
      if (inner && typeof inner === 'object' && 'data' in (inner as object)) {
        return (inner as { data: unknown }).data;
      }
      return inner;
    }
    return body;
  }
}
