import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { AxiosResponse } from 'axios';
import type { IUrbancarClient } from './i-urbancar.client';
import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';

@Injectable()
export class UrbancarClient implements IUrbancarClient {
  private readonly logger = new Logger(UrbancarClient.name);

  constructor(private readonly http: HttpService) {}

  async getVehiculos(params: Record<string, unknown>): Promise<Vehiculo[]> {
    try {
      const res: AxiosResponse<unknown> = await firstValueFrom(
        this.http.get<unknown>('/vehiculos/booking', { params }),
      );
      const items = this.unwrap(res.data);
      return (Array.isArray(items) ? items : []) as Vehiculo[];
    } catch (err) {
      this.logger.error('Error fetching vehiculos', err);
      throw new ServiceUnavailableException('No se pudo conectar con UrbanCar EC');
    }
  }

  async getVehiculoById(id: string): Promise<Vehiculo> {
    try {
      const res: AxiosResponse<unknown> = await firstValueFrom(
        this.http.get<unknown>(`/vehiculos/booking/${id}`),
      );
      return this.unwrap(res.data) as Vehiculo;
    } catch (err) {
      this.logger.error(`Error fetching vehiculo ${id}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con UrbanCar EC');
    }
  }

  async getDisponibilidad(id: string): Promise<Disponibilidad> {
    try {
      const res: AxiosResponse<unknown> = await firstValueFrom(
        this.http.get<unknown>(`/vehiculos/booking/${id}/disponibilidad`),
      );
      return this.unwrap(res.data) as Disponibilidad;
    } catch (err) {
      this.logger.error(`Error fetching disponibilidad ${id}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con UrbanCar EC');
    }
  }

  // Handles { data: T } and { data: { data: T } } response shapes
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
