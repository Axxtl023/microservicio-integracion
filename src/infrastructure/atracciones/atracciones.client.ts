import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IAtraccionesClient } from './i-atracciones.client';
import type { Atraccion } from '../../interfaces/atracciones.interface';
import type { CrearReservaAtraccionExternaDto } from '../../business/atracciones/dtos/crear-reserva-atraccion-externa.dto';
import type { ReservaAtraccionExternaDto } from '../../business/atracciones/dtos/reserva-atraccion-externa.dto';
import { mapHttpToDomainError } from '../../business/vehiculos/errors/map-http-error';

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
        const raw = payload as Record<string, any>;
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
      this.logger.error('[TerraQuest] Error creando reserva de atracción', err);
      throw mapHttpToDomainError(err, 'TerraQuest', 'No se pudo crear la reserva de atracción');
    }
  }

  async confirmarReservaAtraccionExterna(id: string): Promise<ReservaAtraccionExternaDto> {
    this.logger.log(`[TerraQuest] confirm no-op para reserva ${id}`);
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
      this.logger.error(`[TerraQuest] Error cancelando reserva ${id}`, err);
      throw mapHttpToDomainError(err, 'TerraQuest', 'No se pudo cancelar la reserva de atracción');
    }
  }
}
