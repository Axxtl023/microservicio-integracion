import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IAtraccionCaTsClient } from './i-atraccioncats.client';
import type { Atraccion, Product, PriceTier } from '../../interfaces/atracciones.interface';
import type { CrearReservaAtraccionExternaDto } from '../../business/atracciones/dtos/crear-reserva-atraccion-externa.dto';
import type { ReservaAtraccionExternaDto } from '../../business/atracciones/dtos/reserva-atraccion-externa.dto';
import { mapHttpToDomainError } from '../../business/vehiculos/errors/map-http-error';

@Injectable()
export class AtraccionCaTsClient implements IAtraccionCaTsClient {
  private readonly logger = new Logger(AtraccionCaTsClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
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
        this.logger.warn(`[AtraccionCaTs] No se pudieron obtener opciones para "${atraccion.id}"`);
      }

      // Fetch daily availability slots
      try {
        const availRes = await this.http.get(
          '/api/v1/booking/disponibilidad',
          { params: { attractionId: atraccion.id } }
        );
        const days: unknown = availRes.data?.data?.items ?? availRes.data?.data ?? availRes.data;

        const slots: any[] = [];
        if (Array.isArray(days)) {
          for (const day of days) {
            const d = day as Record<string, any>;
            if (d.horarios && Array.isArray(d.horarios)) {
              for (const h of d.horarios) {
                slots.push({
                  slotId: String(h.slotId || h.id),
                  fecha: String(d.fecha),
                  horaInicio: String(h.horaInicio),
                  cuposDisponibles: Number(h.cuposDisponibles ?? 0),
                });
              }
            }
          }
        }
        (atraccion as any).slots = slots;
      } catch (err) {
        this.logger.warn(`[AtraccionCaTs] No se pudieron obtener slots de disponibilidad para "${atraccion.id}"`);
      }

      return atraccion;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      this.logger.error(`[AtraccionCaTs] Error al obtener atracción por slug: ${slug}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con AtraccionCaTs');
    }
  }

  async crearReservaAtraccionExterna(data: CrearReservaAtraccionExternaDto): Promise<ReservaAtraccionExternaDto> {
    try {
      const payload = {
        slotId: data.slotId,
        attractionId: data.attractionId,
        productOptionId: data.productOptionId,
        contactName: data.contactName || 'Invitado',
        contactEmail: data.contactEmail || 'invitado@email.com',
        tickets: data.passengers.map((p) => ({
          priceTierId: data.productOptionId,
          firstName: p.firstName,
          lastName: p.lastName,
          documentNumber: p.documentNumber,
          documentType: p.documentType || 'CI',
        })),
        billing: {
          customerName: data.contactName || 'Invitado',
          taxId: data.passengers[0]?.documentNumber || '0000000000',
          email: data.contactEmail || 'invitado@email.com',
          address: 'Ecuador',
        },
        notas: 'Reserva centralizada',
      };

      const res = await this.http.post('/api/v1/booking', payload);
      const resBody = res.data?.data ?? res.data;

      return {
        id: String(resBody.bookingId),
        reservationCode: String(resBody.pnrCode || ''),
        status: 'CONFIRMED',
      };
    } catch (err) {
      this.logger.error('[AtraccionCaTs] Error creando reserva de atracción', err);
      throw mapHttpToDomainError(err, 'AtraccionCaTs', 'No se pudo crear la reserva de atracción');
    }
  }

  async confirmarReservaAtraccionExterna(id: string): Promise<ReservaAtraccionExternaDto> {
    this.logger.log(`[AtraccionCaTs] confirm no-op para reserva ${id}`);
    return { id, status: 'CONFIRMED' };
  }

  async cancelarReservaAtraccionExterna(id: string, reason?: string): Promise<ReservaAtraccionExternaDto> {
    try {
      if (reason) this.logger.log(`[AtraccionCaTs] Cancelando reserva ${id}. Razón: ${reason}`);
      await this.http.post(`/api/v1/booking/${id}/cancel`, {});
      return {
        id,
        status: 'CANCELLED',
      };
    } catch (err) {
      this.logger.error(`[AtraccionCaTs] Error cancelando reserva ${id}`, err);
      throw mapHttpToDomainError(err, 'AtraccionCaTs', 'No se pudo cancelar la reserva de atracción');
    }
  }
}
