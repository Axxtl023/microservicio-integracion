import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IAtraccionCaTsClient } from './i-atraccioncats.client';
import type { Atraccion, Product, PriceTier } from '../../interfaces/atracciones.interface';

@Injectable()
export class AtraccionCaTsClient implements IAtraccionCaTsClient {
  private readonly logger = new Logger(AtraccionCaTsClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    // La API de AtraccionCaTs es pública — no requiere token de autenticación.
    this.http = axios.create({
      baseURL: process.env.ATRACCIONCATS_API_URL ?? '',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private mapRaw(raw: Record<string, unknown>): Atraccion {
    const imageRaw = (raw.imageUrl as string) || (raw.mainImageUrl as string) || '';
    return {
      id:               String(raw.id ?? ''),
      slug:             String(raw.slug ?? raw.id ?? ''),
      name:             String(raw.name ?? ''),
      descriptionShort: (raw.descriptionShort as string) ?? null,
      locationName:     (raw.locationName as string)     ?? null,
      mainImageUrl:     imageRaw || null,
      startingPrice:    Number(raw.startingPrice ?? 0),
      currencyCode:     String(raw.currencyCode ?? 'USD'),
      isActive:         Boolean(raw.isActive ?? true),
      isPublished:      Boolean(raw.isPublished ?? true),
      modalityCount:    (raw.modalityCount as number)    ?? null,
    };
  }

  async getAtracciones(_params: Record<string, unknown>): Promise<Atraccion[]> {
    try {
      const res = await this.http.get('/api/v1/attraction', {
        params: { pageNumber: 1, pageSize: 1000 },
      });

      // Envelope: { success, data: { items: [...], totalCount } }
      const items: unknown[] =
        res.data?.data?.items ?? res.data?.data ?? res.data ?? [];

      if (!Array.isArray(items)) {
        this.logger.warn('[AtraccionCaTs] Estructura inesperada — retornando []', items);
        return [];
      }

      const mapped = items.map((a) => this.mapRaw(a as Record<string, unknown>));
      this.logger.log(`[AtraccionCaTs] ${mapped.length} atracciones obtenidas`);
      return mapped;
    } catch (err) {
      this.logger.error('[AtraccionCaTs] Error de red al llamar /api/v1/attraction', err);
      throw new ServiceUnavailableException('No se pudo conectar con AtraccionCaTs');
    }
  }

  async getAtraccionBySlug(slug: string): Promise<Atraccion | null> {
    try {
      const detailRes = await this.http.get(`/api/v1/attraction/${slug}`);
      const raw: unknown = detailRes.data?.data ?? detailRes.data;

      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

      const atraccion = this.mapRaw(raw as Record<string, unknown>);

      // Fetch price options using the attraction's ID (sequential — need ID from step 1)
      try {
        const optRes = await this.http.get(
          `/api/v1/productoption/by-attraction/${atraccion.id}`,
        );
        const opts: unknown[] =
          optRes.data?.data?.items ?? optRes.data?.data ?? optRes.data ?? [];

        if (Array.isArray(opts) && opts.length > 0) {
          atraccion.products = opts.map((opt, idx) => {
            const o = opt as Record<string, unknown>;
            const tier: PriceTier = {
              id:           String(o.id ?? idx),
              price:        Number(o.price ?? o.precio ?? o.startingPrice ?? 0),
              currencyCode: String(o.currencyCode ?? o.moneda ?? 'USD'),
              categoryName: ((o.categoryName ?? o.nombre ?? o.name) as string) || undefined,
            };
            const product: Product = {
              id:                  String(o.id ?? idx),
              title:               String(o.name ?? o.nombre ?? o.title ?? 'Pase'),
              description:         ((o.description ?? o.descripcion) as string) || undefined,
              durationDescription: ((o.durationDescription ?? o.duracion) as string) || undefined,
              priceTiers:          [tier],
            };
            return product;
          });
        }
      } catch {
        // Opciones de precio son opcionales — no impiden retornar el detalle
        this.logger.warn(`[AtraccionCaTs] No se pudieron obtener opciones para "${atraccion.id}"`);
      }

      return atraccion;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      this.logger.error(`[AtraccionCaTs] Error al obtener atracción por slug: ${slug}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con AtraccionCaTs');
    }
  }
}
