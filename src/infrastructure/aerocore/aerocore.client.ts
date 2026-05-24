import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IAeroCoreClient } from './i-aerocore.client';

@Injectable()
export class AeroCoreClient implements IAeroCoreClient {
  private readonly logger = new Logger(AeroCoreClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.AEROCORE_API_URL ?? '',
      timeout: 4_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getVuelos(query: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    try {
      const res = await this.http.get('/flights', { params: query });
      const payload: unknown = res.data?.data ?? res.data ?? [];
      const items = Array.isArray(payload) ? payload : [];
      this.logger.log(`[AeroCore] ${items.length} vuelos obtenidos`);
      return items as Record<string, unknown>[];
    } catch (err) {
      console.error('❌ [AeroCore Error]:', err);
      this.logger.error('[AeroCore] Error al obtener vuelos', err);
      return [];
    }
  }

  async getVueloById(id: string): Promise<Record<string, unknown> | null> {
    try {
      const res = await this.http.get(`/flights/${id}`);
      const payload: unknown = res.data?.data ?? res.data ?? null;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
      return payload as Record<string, unknown>;
    } catch (err) {
      console.error('❌ [AeroCore Error]:', err);
      this.logger.error(`[AeroCore] Error al obtener vuelo ${id}`, err);
      return null;
    }
  }
}
