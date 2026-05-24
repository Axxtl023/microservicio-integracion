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
      const res     = await this.http.get('/Alojamiento');
      const payload: unknown = res.data || [];
      const items   = Array.isArray(payload) ? payload : [];
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
      const res     = await this.http.get(`/Alojamiento/${id}`);
      const payload: unknown = res.data || null;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
      return payload as Record<string, unknown>;
    } catch (err) {
      console.error('❌ [HousingPlace Error]:', err);
      this.logger.error(`[HousingPlace] Error al obtener alojamiento id=${id}`, err);
      return null;
    }
  }

  async getHabitacionesPorAlojamiento(id: number): Promise<Habitacion[]> {
    try {
      const res     = await this.http.get(`/habitaciones/alojamiento/${id}`);
      const payload: unknown = res.data || [];
      const items   = Array.isArray(payload) ? payload : [];
      this.logger.log(`[HousingPlace] ${items.length} habitaciones para alojamiento id=${id}`);
      return items as Habitacion[];
    } catch (err) {
      console.error('❌ [HousingPlace Error]:', err);
      this.logger.error(`[HousingPlace] Error al obtener habitaciones para id=${id}`, err);
      return [];
    }
  }
}
