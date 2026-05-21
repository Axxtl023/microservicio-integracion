import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IAtraccionesClient } from './i-atracciones.client';
import type { Atraccion } from '../../interfaces/atracciones.interface';

@Injectable()
export class AtraccionesClient implements IAtraccionesClient {
  private readonly logger = new Logger(AtraccionesClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.ATRACCIONES_API_URL ?? '',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getAtraccionBySlug(slug: string): Promise<Atraccion | null> {
    try {
      const res = await this.http.get(`/attraction/${slug}`);
      const payload: unknown = res.data?.data ?? res.data;
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return payload as Atraccion;
      }
      this.logger.warn(`[TerraQuest] Respuesta inesperada para slug "${slug}"`, payload);
      return null;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      this.logger.error(`[TerraQuest] Error al obtener atracción por slug: ${slug}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con TerraQuest');
    }
  }

  async getAtracciones(params: Record<string, unknown>): Promise<Atraccion[]> {
    try {
      const res = await this.http.get('/attraction', { params });

      console.log('[TerraQuest Backend] Respuesta cruda del proveedor:', JSON.stringify(res.data));

      // Handles the three most common envelope shapes from external APIs:
      //   Shape A: res.data = Atraccion[]                       (bare array)
      //   Shape B: res.data = { data: Atraccion[], ... }        (standard envelope)
      //   Shape C: res.data = { data: { items: Atraccion[] } }  (nested paginated envelope)
      const payload: unknown = res.data?.data ?? res.data;

      if (Array.isArray(payload)) {
        this.logger.log(`[TerraQuest] Forma A/B: ${payload.length} items encontrados`);
        return payload as Atraccion[];
      }

      if (payload && typeof payload === 'object') {
        const nested = (payload as Record<string, unknown>).items;
        if (Array.isArray(nested)) {
          this.logger.log(`[TerraQuest] Forma C (nested items): ${nested.length} items encontrados`);
          return nested as Atraccion[];
        }
      }

      this.logger.warn('[TerraQuest] Estructura de respuesta inesperada — retornando []', payload);
      return [];
    } catch (err) {
      this.logger.error('[TerraQuest] Error de red al llamar /attraction', err);
      throw new ServiceUnavailableException('No se pudo conectar con TerraQuest');
    }
  }
}
