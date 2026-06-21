import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IPaleAtraccionesClient } from './i-paleatracciones.client';
import type { Atraccion } from '../../interfaces/atracciones.interface';
import type { CrearReservaAtraccionExternaDto } from '../../business/atracciones/dtos/crear-reserva-atraccion-externa.dto';
import type { ReservaAtraccionExternaDto } from '../../business/atracciones/dtos/reserva-atraccion-externa.dto';
import { mapHttpToDomainError } from '../../business/vehiculos/errors/map-http-error';

const PROV = 'PaleAtracctions';

@Injectable()
export class PaleAtraccionesClient implements IPaleAtraccionesClient {
  private readonly logger = new Logger(PaleAtraccionesClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.PALE_ATRACCTIONS_API_URL ?? '',
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private mapAtraccion(raw: Record<string, any>): Atraccion {
    return {
      id:                  String(raw.id ?? ''),
      slug:                String(raw.slug ?? raw.id ?? ''),
      name:                String(raw.name ?? ''),
      descriptionShort:    (raw.descriptionShort  as string | null) ?? null,
      descriptionFull:     (raw.descriptionFull   as string | null) ?? null,
      locationName:        (raw.locationName       as string | null) ?? null,
      locationCountryCode: (raw.locationCountryCode as string | null) ?? null,
      categoryName:        (raw.categoryName       as string | null) ?? null,
      subcategoryName:     (raw.subcategoryName    as string | null) ?? null,
      ratingAverage:       raw.ratingAverage != null ? Number(raw.ratingAverage) : null,
      ratingCount:         raw.ratingCount   != null ? Number(raw.ratingCount)   : null,
      difficultyLevel:     (raw.difficultyLevel    as string | null) ?? null,
      mainImageUrl:        (raw.mainImageUrl        as string | null) ?? null,
      address:             (raw.address             as string | null) ?? null,
      meetingPoint:        (raw.meetingPoint        as string | null) ?? null,
      gallery:             Array.isArray(raw.gallery)  ? raw.gallery  : [],
      products:            Array.isArray(raw.products) ? raw.products : [],
      startingPrice:       Number(raw.startingPrice ?? 0),
      currencyCode:        String(raw.currencyCode ?? 'USD'),
      isActive:            raw.isActive    !== false,
      isPublished:         raw.isPublished !== false,
      modalityCount:       (raw.modalityCount as number | null) ?? null,
    };
  }

  async getAtracciones(_params: Record<string, unknown>): Promise<Atraccion[]> {
    try {
      const res = await this.http.get('/catalog/attraction');
      // Respuesta: { success, data: { items: [...] } }
      const payload: unknown = res.data?.data?.items ?? res.data?.data ?? res.data;
      const raw = Array.isArray(payload) ? payload : [];
      this.logger.log(`[${PROV}] ${raw.length} atracciones obtenidas`);
      return (raw as Record<string, any>[]).map(item => this.mapAtraccion(item));
    } catch (err) {
      this.logger.error(`[${PROV}] Error de red al llamar /catalog/attraction`, err);
      return [];
    }
  }

  async getAtraccionBySlug(slug: string): Promise<Atraccion | null> {
    try {
      const res = await this.http.get(`/catalog/attraction/${slug}`);
      // Respuesta: { success, data: { ... } }
      const data: unknown = res.data?.data ?? res.data ?? null;
      if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
      return this.mapAtraccion(data as Record<string, any>);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      this.logger.error(`[${PROV}] Error al obtener atracción por slug: ${slug}`, err);
      return null;
    }
  }

  async crearReservaAtraccionExterna(data: CrearReservaAtraccionExternaDto): Promise<ReservaAtraccionExternaDto> {
    try {
      const res = await this.http.post('/catalog/booking', {
        slotId:         data.slotId,
        attractionId:   data.attractionId,
        productOptionId: data.productOptionId,
        contactName:    data.contactName  || 'Invitado',
        contactEmail:   data.contactEmail || 'invitado@email.com',
        tickets: data.passengers.map((p) => ({
          priceTierId:    data.productOptionId,
          firstName:      p.firstName,
          lastName:       p.lastName,
          documentNumber: p.documentNumber,
          documentType:   p.documentType || 'CI',
        })),
      });
      const resBody = res.data?.data ?? res.data;
      return {
        id:              String(resBody.bookingId || resBody.id || ''),
        reservationCode: String(resBody.pnrCode   || resBody.reservationCode || ''),
        status:          'CONFIRMED',
      };
    } catch (err) {
      this.logger.error(`[${PROV}] Error creando reserva de atracción`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo crear la reserva de atracción');
    }
  }

  async confirmarReservaAtraccionExterna(id: string): Promise<ReservaAtraccionExternaDto> {
    this.logger.log(`[${PROV}] confirm no-op para reserva ${id}`);
    return { id, status: 'CONFIRMED' };
  }

  async cancelarReservaAtraccionExterna(id: string, reason?: string): Promise<ReservaAtraccionExternaDto> {
    try {
      if (reason) this.logger.log(`[${PROV}] Cancelando reserva ${id}. Razón: ${reason}`);
      await this.http.post(`/catalog/booking/${id}/cancel`, {
        cancelReason: reason || 'Cancelación solicitada por el usuario',
      });
      return { id, status: 'CANCELLED' };
    } catch (err) {
      this.logger.error(`[${PROV}] Error cancelando reserva ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo cancelar la reserva de atracción');
    }
  }
}
