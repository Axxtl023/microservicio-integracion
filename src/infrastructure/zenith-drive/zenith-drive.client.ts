import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IZenithDriveClient } from './i-zenith-drive.client';
import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';

@Injectable()
export class ZenithDriveClient implements IZenithDriveClient {
  private readonly logger = new Logger(ZenithDriveClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.ZENITH_DRIVE_API_URL ?? '',
      timeout: 4_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getVehiculos(_params: Record<string, unknown>): Promise<Vehiculo[]> {
    try {
      const res = await this.http.get('/v1/vehiculos/booking');
      // Tolera { data: [...] } y también un array plano en la raíz
      const items: unknown = res.data?.data ?? res.data ?? [];
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
      const res  = await this.http.get(`/v1/vehiculos/booking/${id}`);
      const data: unknown = res.data?.data ?? null;
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
      const res = await this.http.get(`/v1/vehiculos/booking/${id}/disponibilidad`);
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
}
