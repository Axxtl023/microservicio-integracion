import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IAlojaExpressClient } from './i-aloja-express.client';

@Injectable()
export class AlojaExpressClient implements IAlojaExpressClient {
  private readonly logger = new Logger(AlojaExpressClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.ALOJAEXPRESS_API_URL ?? 'https://api-gateway-y75a.onrender.com/api/v1',
      timeout: 4_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getAlojamientos(): Promise<Record<string, unknown>[]> {
    try {
      const res   = await this.http.get('/alojamientos');
      const items = Array.isArray(res.data) ? res.data : [];
      this.logger.log(`[AlojaExpress] ${items.length} alojamientos obtenidos`);
      return items as Record<string, unknown>[];
    } catch (err) {
      this.logger.error('[AlojaExpress] Error al obtener alojamientos', err);
      return [];
    }
  }

  async getAlojamientoById(id: string | number): Promise<Record<string, unknown> | null> {
    const cleanId = String(id).trim();
    try {
      const res = await this.http.get(`/alojamientos/${cleanId}`);
      if (Array.isArray(res.data)) {
        return res.data.length > 0 ? (res.data[0] as Record<string, unknown>) : null;
      }
      if (res.data && typeof res.data === 'object') {
        return res.data as Record<string, unknown>;
      }
      return null;
    } catch {
      // direct lookup failed — fall through to full-list filter
    }
    try {
      const res = await this.http.get('/alojamientos');
      const all = Array.isArray(res.data) ? res.data : [];
      const match = all.find(
        (h: unknown) => Number((h as Record<string, unknown>).alojamientoId) === Number(cleanId),
      );
      return (match as Record<string, unknown>) ?? null;
    } catch (err) {
      this.logger.error(`[AlojaExpress] Error al obtener alojamiento id=${cleanId}`, err);
      return null;
    }
  }

  async getHabitacionesPorAlojamiento(id: string | number): Promise<Record<string, unknown>[]> {
    const cleanId = String(id).trim();
    try {
      const res   = await this.http.get(`/habitaciones/alojamiento/${cleanId}`);
      const items = Array.isArray(res.data) ? res.data : [];
      this.logger.log(`[AlojaExpress] ${items.length} habitaciones para alojamiento id=${cleanId}`);
      return items as Record<string, unknown>[];
    } catch (err) {
      this.logger.error(`[AlojaExpress] Error al obtener habitaciones para id=${cleanId}`, err);
      return [];
    }
  }
}
