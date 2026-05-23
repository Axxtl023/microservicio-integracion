import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { INextStopClient } from './i-nextstop.client';
import type { Atraccion } from '../../interfaces/atracciones.interface';

@Injectable()
export class NextStopClient implements INextStopClient {
  private readonly logger = new Logger(NextStopClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    // La API de NextStop es pública — no requiere token de autenticación.
    this.http = axios.create({
      baseURL: process.env.NEXTSTOP_API_URL ?? '',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getAtracciones(_params: Record<string, unknown>): Promise<Atraccion[]> {
    try {
      const res = await this.http.get('/attraction');

      // Fallback elástico de 3 niveles para cubrir variaciones del sobre
      const items: unknown[] =
        res.data?.data?.items ||
        res.data?.items       ||
        res.data?.data        ||
        [];

      if (!Array.isArray(items)) {
        this.logger.warn('[NextStop] Estructura inesperada — retornando []', res.data);
        return [];
      }

      this.logger.log(`[NextStop] ${items.length} atracciones obtenidas`);
      return items as Atraccion[];
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: unknown }; message?: string };
      console.error('❌ [NextStop Error]:', axiosErr.response?.data || axiosErr.message);
      this.logger.error(`[NextStop] HTTP ${axiosErr.response?.status ?? 'red'} al llamar /attraction`);
      throw new ServiceUnavailableException('No se pudo conectar con NextStop');
    }
  }

  async getAtraccionBySlug(slug: string): Promise<Atraccion | null> {
    try {
      const res = await this.http.get(`/attraction/${slug}`);
      const payload: unknown = res.data?.data;

      // Forma A: { data: { items: [singleItem] } }
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const nested = (payload as Record<string, unknown>).items;
        if (Array.isArray(nested) && nested.length > 0) {
          return nested[0] as Atraccion;
        }
        // Forma B: { data: { ...singleItem } }
        if ((payload as Record<string, unknown>).id) {
          return payload as Atraccion;
        }
      }

      // Forma C: { data: [...] } bare array
      if (Array.isArray(payload) && payload.length > 0) {
        return payload[0] as Atraccion;
      }

      this.logger.warn(`[NextStop] Respuesta inesperada para slug "${slug}"`, payload);
      return null;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      this.logger.error(`[NextStop] Error al obtener atracción por slug: ${slug}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con NextStop');
    }
  }
}
