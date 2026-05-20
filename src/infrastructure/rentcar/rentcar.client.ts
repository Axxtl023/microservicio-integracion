import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import type { IRentcarClient } from './i-rentcar.client';
import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';
import type {
  RentCarApiResponse,
  RentCarListApiResponse,
} from '../../interfaces/rentcar.interface';

@Injectable()
export class RentcarClient implements IRentcarClient {
  private readonly logger = new Logger(RentcarClient.name);
  private readonly http: AxiosInstance;

  constructor() {
    const baseURL = process.env.RENTCAR_BASE_URL ?? '';
    const token   = process.env.RENTCAR_TOKEN   ?? '';

    this.http = axios.create({
      baseURL,
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    // Intercepta errores de aplicación { success: false, error: { code, message } }
    this.http.interceptors.response.use(
      (response) => response,
      (error) => {
        const apiError = error.response?.data?.error as
          | { code?: string; message?: string }
          | undefined;
        if (apiError) {
          this.logger.error(
            `[RentCar EC] Error de aplicación: ${apiError.code} — ${apiError.message}`,
          );
          return Promise.reject(new Error(apiError.message ?? 'Error del proveedor RentCar EC'));
        }
        return Promise.reject(error);
      },
    );
  }

  async getVehiculos(params: Record<string, unknown>): Promise<Vehiculo[]> {
    try {
      const res = await this.http.get<RentCarListApiResponse<Vehiculo>>(
        'vehiculos/booking',
        { params },
      );
      const body = res.data;
      if (!body.success) {
        this.logger.warn('[RentCar EC] success=false al listar vehículos');
        return [];
      }
      return body.data?.data ?? [];
    } catch (err) {
      this.logger.error('Error al obtener vehículos de RentCar EC', err);
      throw new ServiceUnavailableException('No se pudo conectar con RentCar EC');
    }
  }

  async getVehiculoById(id: string): Promise<Vehiculo> {
    try {
      const res = await this.http.get<RentCarApiResponse<Vehiculo>>(
        `vehiculos/booking/${id}`,
      );
      const body = res.data;
      if (!body.success || !body.data) {
        throw new NotFoundException(`Vehículo ${id} no encontrado en RentCar EC`);
      }
      return body.data;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if ((err as any)?.response?.status === 404) {
        throw new NotFoundException(`Vehículo ${id} no encontrado en RentCar EC`);
      }
      this.logger.error(`Error al obtener vehículo ${id} de RentCar EC`, err);
      throw new ServiceUnavailableException('No se pudo conectar con RentCar EC');
    }
  }

  async getDisponibilidad(id: string): Promise<Disponibilidad> {
    try {
      const res = await this.http.get<RentCarApiResponse<Disponibilidad>>(
        `vehiculos/booking/${id}/disponibilidad`,
      );
      const body = res.data;
      if (!body.success || !body.data) {
        throw new NotFoundException(`Disponibilidad de ${id} no encontrada en RentCar EC`);
      }
      return body.data;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if ((err as any)?.response?.status === 404) {
        throw new NotFoundException(`Disponibilidad de ${id} no encontrada en RentCar EC`);
      }
      this.logger.error(`Error al obtener disponibilidad ${id} de RentCar EC`, err);
      throw new ServiceUnavailableException('No se pudo conectar con RentCar EC');
    }
  }
}
