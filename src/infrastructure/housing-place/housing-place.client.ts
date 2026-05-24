import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IHousingPlaceClient } from './i-housing-place.client';
import type { Habitacion } from '../../interfaces/hoteles.interface';

@Injectable()
export class HousingPlaceClient implements IHousingPlaceClient {
  private readonly logger = new Logger(HousingPlaceClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.HOUSING_PLACE_API_URL ?? '',
      timeout: 4_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getAlojamientos(): Promise<Record<string, unknown>[]> {
    try {
      const res   = await this.http.get('/alojamientos');
      const items = Array.isArray(res.data) ? res.data : [];
      this.logger.log(`[HousingPlace] ${items.length} alojamientos obtenidos`);
      return items as Record<string, unknown>[];
    } catch (err) {
      console.error('❌ [HousingPlace Error]:', err);
      this.logger.error('[HousingPlace] Error al obtener alojamientos', err);
      return [];
    }
  }

  async getAlojamientoById(id: number): Promise<Record<string, unknown> | null> {
    try {
      const res   = await this.http.get(`/alojamientos/${id}`);
      const items = Array.isArray(res.data) ? res.data : [];
      if (items.length > 0) return items[0] as Record<string, unknown>;
    } catch {
      // direct lookup failed — fall through to full-list filter
    }
    try {
      const res = await this.http.get('/alojamientos');
      const all = Array.isArray(res.data) ? res.data : [];
      const match = all.find(
        (h: unknown) => Number((h as Record<string, unknown>).alojamientoId) === id,
      );
      return (match as Record<string, unknown>) ?? null;
    } catch (err) {
      console.error('❌ [HousingPlace Error]:', err);
      this.logger.error(`[HousingPlace] Error al obtener alojamiento id=${id}`, err);
      return null;
    }
  }

  async getHabitacionesPorAlojamiento(id: number): Promise<Habitacion[]> {
    try {
      const res   = await this.http.get(`/habitaciones/alojamiento/${id}`);
      const items = Array.isArray(res.data) ? res.data : [];
      this.logger.log(`[HousingPlace] ${items.length} habitaciones para alojamiento id=${id}`);
      return items as Habitacion[];
    } catch (err) {
      console.error('❌ [HousingPlace Error]:', err);
      this.logger.error(`[HousingPlace] Error al obtener habitaciones para id=${id}`, err);
      return [];
    }
  }
}
