import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import {
  URBANCAR_INVENTORY_HTTP,
  URBANCAR_OPERATIONS_HTTP,
  type IUrbancarClient,
} from './i-urbancar.client';
import { Inject } from '@nestjs/common';
import type { Vehiculo } from '../../interfaces/urbancar.interface';
import type { CrearReservaExternaDto } from './dtos/crear-reserva-externa.dto';
import type { DisponibilidadDto } from './dtos/disponibilidad.dto';
import type { ReservaExternaDto } from './dtos/reserva-externa.dto';
import {
  ProveedorIndisponibleError,
  ReservaInvalidaError,
  ReservaNoDisponibleError,
  ReservaNoEncontradaError,
} from './urbancar.errors';

@Injectable()
export class UrbancarClient implements IUrbancarClient {
  private readonly logger = new Logger(UrbancarClient.name);

  constructor(
    @Inject(URBANCAR_INVENTORY_HTTP)
    private readonly inventoryHttp: AxiosInstance,
    @Inject(URBANCAR_OPERATIONS_HTTP)
    private readonly operationsHttp: AxiosInstance,
  ) {}

  async getVehiculos(params: Record<string, unknown>): Promise<Vehiculo[]> {
    try {
      const res: AxiosResponse<unknown> = await this.inventoryHttp.get('/vehiculos/booking', {
        params,
      });
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

  async getDisponibilidad(id: string): Promise<DisponibilidadDto> {
    try {
      const res: AxiosResponse<unknown> = await this.inventoryHttp.get(
        `/vehiculos/booking/${id}/disponibilidad`,
      );
      return this.unwrap(res.data) as DisponibilidadDto;
    } catch (err) {
      this.logger.error(`Error fetching disponibilidad ${id}`, err);
      throw this.mapUrbanCarError(err, 'No se pudo consultar la disponibilidad en UrbanCar');
    }
  }

  async verificarDisponibilidadExterna(vehiculoId: string): Promise<DisponibilidadDto> {
    return this.getDisponibilidad(vehiculoId);
  }

  async crearReservaExterna(data: CrearReservaExternaDto): Promise<ReservaExternaDto> {
    try {
      const res: AxiosResponse<unknown> = await this.operationsHttp.post('/reservas/booking', data);
      return this.unwrap(res.data) as ReservaExternaDto;
    } catch (err) {
      this.logger.error(
        `Error creating external reservation for vehicle ${data.vehiculoId}`,
        err,
      );
      throw this.mapUrbanCarError(err, 'No se pudo crear la reserva en UrbanCar');
    }
  }

  async confirmarReservaExterna(id: string): Promise<ReservaExternaDto> {
    try {
      const res: AxiosResponse<unknown> = await this.operationsHttp.patch(
        `/reservas/booking/${id}`,
        { status: 'CONFIRMADA' },
      );
      return this.unwrap(res.data) as ReservaExternaDto;
    } catch (err) {
      this.logger.error(`Error confirming external reservation ${id}`, err);
      throw this.mapUrbanCarError(err, 'No se pudo confirmar la reserva en UrbanCar');
    }
  }

  async cancelarReservaExterna(id: string, reason?: string): Promise<ReservaExternaDto> {
    try {
      if (reason) {
        this.logger.log(`Cancelling external reservation ${id}. Reason: ${reason}`);
      }
      const res: AxiosResponse<unknown> = await this.operationsHttp.patch(
        `/reservas/booking/${id}`,
        { status: 'CANCELADA' },
      );
      return this.unwrap(res.data) as ReservaExternaDto;
    } catch (err) {
      this.logger.error(`Error cancelling external reservation ${id}`, err);
      throw this.mapUrbanCarError(err, 'No se pudo cancelar la reserva en UrbanCar');
    }
  }

  // Maneja respuestas { data: T } y { data: { data: T } }.
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

  private mapUrbanCarError(err: unknown, fallbackMessage: string): Error {
    if (!axios.isAxiosError(err)) {
      if (err instanceof Error) {
        return new ProveedorIndisponibleError(err.message || fallbackMessage);
      }
      return new ProveedorIndisponibleError(fallbackMessage);
    }

    const status = err.response?.status;
    const message = this.extractErrorMessage(err.response?.data) ?? fallbackMessage;

    if (status === 400) return new ReservaInvalidaError(message);
    if (status === 404) return new ReservaNoEncontradaError(message);
    if (status === 409 || status === 422) return new ReservaNoDisponibleError(message);

    return new ProveedorIndisponibleError(message);
  }

  private extractErrorMessage(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const candidate = body as { message?: unknown; error?: unknown };
    if (typeof candidate.message === 'string') return candidate.message;
    if (typeof candidate.error === 'string') return candidate.error;
    return undefined;
  }
}
