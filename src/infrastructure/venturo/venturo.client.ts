import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IVenturoClient } from './i-venturo.client';
import type { Atraccion } from '../../interfaces/atracciones.interface';
import type { CrearReservaAtraccionExternaDto } from '../../business/atracciones/dtos/crear-reserva-atraccion-externa.dto';
import type { ReservaAtraccionExternaDto } from '../../business/atracciones/dtos/reserva-atraccion-externa.dto';
import { mapHttpToDomainError } from '../../business/vehiculos/errors/map-http-error';

@Injectable()
export class VenturoClient implements IVenturoClient {
  private readonly logger = new Logger(VenturoClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
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

      let raw: Record<string, any> | null = null;

      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const nested = (payload as Record<string, unknown>).items;
        if (Array.isArray(nested) && nested.length > 0) {
          raw = nested[0] as Record<string, any>;
        } else if ((payload as Record<string, unknown>).id) {
          raw = payload as Record<string, any>;
        }
      }

      if (Array.isArray(payload) && payload.length > 0) {
        raw = payload[0] as Record<string, any>;
      }

      if (raw) {
        const mappedProducts: any[] = [];
        const mappedSlots: any[] = [];

        if (raw.modalidades && Array.isArray(raw.modalidades)) {
          for (const mod of raw.modalidades) {
            mappedProducts.push({
              id: mod.id,
              title: mod.nombre || 'Pase',
              description: mod.descripcion || '',
              durationDescription: 'Duración regular',
              priceTiers: [
                {
                  id: mod.id,
                  price: Number(raw.precio || raw.startingPrice || 0),
                  currencyCode: String(raw.moneda || raw.currencyCode || 'USD'),
                  categoryName: 'General',
                },
              ],
            });

            if (mod.slots && Array.isArray(mod.slots)) {
              for (const slot of mod.slots) {
                mappedSlots.push({
                  slotId: slot.id,
                  fecha: slot.fecha,
                  horaInicio: slot.horaInicio,
                  cuposDisponibles: slot.cuposDisponibles,
                });
              }
            }
          }
        }

        return {
          ...raw,
          products: mappedProducts,
          slots: mappedSlots,
        } as any;
      }

      this.logger.warn(`[Venturo] Respuesta inesperada para slug "${slug}"`, payload);
      return null;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      this.logger.error(`[Venturo] Error al obtener atracción por slug: ${slug}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con Venturo');
    }
  }

  async crearReservaAtraccionExterna(data: CrearReservaAtraccionExternaDto): Promise<ReservaAtraccionExternaDto> {
    try {
      const nameParts = (data.contactName ?? '').trim().split(' ');
      const firstName = nameParts[0] || 'Invitado';
      const lastName = nameParts.slice(1).join(' ') || 'Invitado';

      const firstPassenger = data.passengers[0];
      const clientDocType = firstPassenger?.documentType ?? 'CI';
      const clientDocNum = firstPassenger?.documentNumber ?? '0000000000';

      const payload = {
        slotId: data.slotId,
        client: {
          firstName,
          lastName,
          documentType: clientDocType,
          documentNumber: clientDocNum,
          email: data.contactEmail || 'invitado@email.com',
        },
        tickets: data.passengers.map((p) => ({
          ticketCategoryId: data.productOptionId,
          firstName: p.firstName,
          lastName: p.lastName,
          documentNumber: p.documentNumber,
          documentType: p.documentType || 'CI',
        })),
        notas: 'Reserva centralizada',
      };

      const res = await this.http.post('/booking', payload);
      const resBody = res.data?.data ?? res.data;

      return {
        id: String(resBody.pnrCode || resBody.bookingId),
        reservationCode: String(resBody.pnrCode || ''),
        status: 'CONFIRMED',
      };
    } catch (err) {
      this.logger.error('[Venturo] Error creando reserva de atracción', err);
      throw mapHttpToDomainError(err, 'Venturo', 'No se pudo crear la reserva de atracción');
    }
  }

  async confirmarReservaAtraccionExterna(id: string): Promise<ReservaAtraccionExternaDto> {
    this.logger.log(`[Venturo] confirm no-op para reserva ${id}`);
    return { id, status: 'CONFIRMED' };
  }

  async cancelarReservaAtraccionExterna(id: string, reason?: string): Promise<ReservaAtraccionExternaDto> {
    try {
      await this.http.post(`/booking/${id}/cancel`, {
        cancelReason: reason || 'Cancelación solicitada por el usuario',
      });
      return {
        id,
        reservationCode: id,
        status: 'CANCELLED',
      };
    } catch (err) {
      this.logger.error(`[Venturo] Error cancelando reserva ${id}`, err);
      throw mapHttpToDomainError(err, 'Venturo', 'No se pudo cancelar la reserva de atracción');
    }
  }
}
