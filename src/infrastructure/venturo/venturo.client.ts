import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IVenturoClient } from './i-venturo.client';
import type { Atraccion } from '../../interfaces/atracciones.interface';

@Injectable()
export class VenturoClient implements IVenturoClient {
  private readonly logger = new Logger(VenturoClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    // La API de Venturo es pública — no requiere token de autenticación.
    this.http = axios.create({
      baseURL: process.env.VENTURO_API_URL ?? '',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getAtracciones(_params: Record<string, unknown>): Promise<Atraccion[]> {
    try {
      const res = await this.http.get('/attraction', {
        params: { page: 1, pageSize: 1000 },
      });

      // Venturo envuelve la lista en: { success: true, data: { items: [...] } }
      const items: unknown[] = res.data?.data?.items ?? res.data?.data ?? res.data ?? [];

      if (!Array.isArray(items)) {
        this.logger.warn('[Venturo] Estructura inesperada — retornando []', items);
        return [];
      }

      this.logger.log(`[Venturo] ${items.length} atracciones obtenidas`);
      return items as Atraccion[];
    } catch (err) {
      this.logger.error('[Venturo] Error de red al llamar /attraction', err);
      throw new ServiceUnavailableException('No se pudo conectar con Venturo');
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

      this.logger.warn(`[Venturo] Respuesta inesperada para slug "${slug}"`, payload);
      return null;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      this.logger.error(`[Venturo] Error al obtener atracción por slug: ${slug}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con Venturo');
    }
  }
}
