import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import type { IDriveXClient } from './i-drivex.client';
import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';

@Injectable()
export class DriveXClient implements IDriveXClient {
  private readonly logger = new Logger(DriveXClient.name);
  private readonly http: AxiosInstance;

  constructor() {
    // La API de DriveX es pública — no requiere token de autenticación.
    this.http = axios.create({
      baseURL: process.env.DRIVEX_CATALOGO_URL ?? '',
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getVehiculos(_params: Record<string, unknown>): Promise<Vehiculo[]> {
    try {
      const res = await this.http.get('/vehiculos');
      // DriveX envuelve la lista en: { success: true, data: [...] }
      const items: Vehiculo[] = res.data?.data ?? [];
      this.logger.log(`[DriveX] ${items.length} vehículos obtenidos`);
      return Array.isArray(items) ? items : [];
    } catch (err) {
      this.logger.error('[DriveX] Error al obtener vehículos', err);
      throw new ServiceUnavailableException('No se pudo conectar con DriveX');
    }
  }

  async getVehiculoById(id: string): Promise<Vehiculo> {
    try {
      const res = await this.http.get(`/vehiculos/${id}`);
      const data: Vehiculo | null = res.data?.data ?? null;
      if (!data) throw new NotFoundException(`Vehículo ${id} no encontrado en DriveX`);
      return data;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if ((err as any)?.response?.status === 404) {
        throw new NotFoundException(`Vehículo ${id} no encontrado en DriveX`);
      }
      this.logger.error(`[DriveX] Error al obtener vehículo ${id}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con DriveX');
    }
  }

  async getDisponibilidad(id: string): Promise<Disponibilidad> {
    try {
      // DriveX exige fechaInicio y fechaFin; usamos hoy y mañana como rango mínimo.
      const hoy    = new Date().toISOString().split('T')[0];
      const manana = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
      const res = await this.http.get(`/vehiculos/${id}/disponibilidad`, {
        params: { fechaInicio: hoy, fechaFin: manana },
      });
      const raw = res.data?.data;
      if (!raw || typeof raw !== 'object') {
        throw new NotFoundException(`Disponibilidad de ${id} no encontrada en DriveX`);
      }
      const r = raw as Record<string, unknown>;
      // Normalización booleana estricta — DriveX retorna { vehiculoId, disponible, fechaInicio, fechaFin }
      return {
        vehiculoId: String(r.vehiculoId ?? id),
        disponible: r.disponible === true || r.disponible === 'true',
        status:     (r.status  as string | null) ?? null,
        mensaje:    (r.mensaje as string | null) ?? null,
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if ((err as any)?.response?.status === 404) {
        throw new NotFoundException(`Disponibilidad de ${id} no encontrada en DriveX`);
      }
      this.logger.error(`[DriveX] Error al obtener disponibilidad ${id}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con DriveX');
    }
  }
}
