import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { INextStopClient } from './i-nextstop.client';
import type { Atraccion } from '../../interfaces/atracciones.interface';
import type { CrearReservaAtraccionExternaDto } from '../../business/atracciones/dtos/crear-reserva-atraccion-externa.dto';
import type { ReservaAtraccionExternaDto } from '../../business/atracciones/dtos/reserva-atraccion-externa.dto';
import { mapHttpToDomainError } from '../../business/vehiculos/errors/map-http-error';

@Injectable()
export class NextStopClient implements INextStopClient {
  private readonly logger = new Logger(NextStopClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.NEXTSTOP_API_URL ?? '',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getAtracciones(_params: Record<string, unknown>): Promise<Atraccion[]> {
    try {
      const res = await this.http.get('/attraction');

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

      let atraccion: Atraccion | null = null;

      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const nested = (payload as Record<string, unknown>).items;
        if (Array.isArray(nested) && nested.length > 0) {
          atraccion = nested[0] as Atraccion;
        } else if ((payload as Record<string, unknown>).id) {
          atraccion = payload as Atraccion;
        }
      }

      if (Array.isArray(payload) && payload.length > 0) {
        atraccion = payload[0] as Atraccion;
      }

      if (atraccion) {
        // Fetch daily availability slots
        try {
          const availRes = await this.http.get(
            `/booking/${atraccion.id}/availability`
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
          this.logger.warn(`[NextStop] No se pudieron obtener slots de disponibilidad para "${atraccion.id}"`);
        }

        return atraccion;
      }

      this.logger.warn(`[NextStop] Respuesta inesperada para slug "${slug}"`, payload);
      return null;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      this.logger.error(`[NextStop] Error al obtener atracción por slug: ${slug}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con NextStop');
    }
  }

  async crearReservaAtraccionExterna(data: CrearReservaAtraccionExternaDto): Promise<ReservaAtraccionExternaDto> {
    try {
      let attractionName = 'Atracción';
      let productTitle = 'Pase';
      let currency = 'USD';
      let priceTierId = data.productOptionId;

      try {
        const attraction = await this.getAtraccionBySlug(data.attractionId);
        if (attraction) {
          attractionName = attraction.name || attractionName;
          currency = attraction.currencyCode || currency;
          const product = attraction.products?.find((p) => p.id === data.productOptionId);
          if (product) {
            productTitle = product.title || productTitle;
            if (product.priceTiers && product.priceTiers.length > 0) {
              priceTierId = product.priceTiers[0].id || priceTierId;
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`No se pudo obtener información adicional de NextStop para crear reserva: ${err.message}`);
      }

      const payload = {
        slotId: data.slotId,
        attractionId: data.attractionId,
        productOptionId: data.productOptionId,
        attractionName,
        productTitle,
        currency,
        contactName: data.contactName || 'Invitado',
        contactEmail: data.contactEmail || 'invitado@email.com',
        isPosSale: false,
        notas: 'Reserva centralizada',
        passengers: data.passengers.map((p) => ({
          ticketCategoryId: data.productOptionId,
          priceTierId: priceTierId,
          firstName: p.firstName,
          lastName: p.lastName,
          documentNumber: p.documentNumber,
          documentType: p.documentType || 'CI',
          quantity: 1,
        })),
      };

      const res = await this.http.post('/booking', payload);
      const resBody = res.data?.data ?? res.data;

      return {
        id: String(resBody.bookingId),
        reservationCode: String(resBody.pnrCode || ''),
        status: 'CONFIRMED',
      };
    } catch (err) {
      this.logger.error('[NextStop] Error creando reserva de atracción', err);
      throw mapHttpToDomainError(err, 'NextStop', 'No se pudo crear la reserva de atracción');
    }
  }

  async confirmarReservaAtraccionExterna(id: string): Promise<ReservaAtraccionExternaDto> {
    this.logger.log(`[NextStop] confirm no-op para reserva ${id}`);
    return { id, status: 'CONFIRMED' };
  }

  async cancelarReservaAtraccionExterna(id: string, reason?: string): Promise<ReservaAtraccionExternaDto> {
    try {
      if (reason) this.logger.log(`[NextStop] Cancelando reserva ${id}. Razón: ${reason}`);
      await this.http.post(`/booking/${id}/cancel`, {});
      return {
        id,
        status: 'CANCELLED',
      };
    } catch (err) {
      this.logger.error(`[NextStop] Error cancelando reserva ${id}`, err);
      throw mapHttpToDomainError(err, 'NextStop', 'No se pudo cancelar la reserva de atracción');
    }
  }
}
