import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IHousingPlaceClient } from './i-housing-place.client';
import type { Habitacion } from '../../interfaces/hoteles.interface';
import type { CrearReservaHotelDto } from '../../business/hoteles/dtos/crear-reserva-hotel.dto';
import type { DisponibilidadHotelDto } from '../../business/hoteles/dtos/disponibilidad-hotel.dto';
import type { ReservaHotelExternaDto } from '../../business/hoteles/dtos/reserva-hotel-externa.dto';

@Injectable()
export class HousingPlaceClient implements IHousingPlaceClient {
  private readonly logger = new Logger(HousingPlaceClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.HOUSING_PLACE_API_URL ?? 'https://alojamientosapigateway.onrender.com/api/v1/naomy-analuisa',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── Catálogo ─────────────────────────────────────────────────────────────
  async getAlojamientos(): Promise<Record<string, unknown>[]> {
    try {
      const res   = await this.http.get('/alojamientos');
      const items = Array.isArray(res.data) ? res.data : [];
      this.logger.log(`[HousingPlace] ${items.length} alojamientos obtenidos`);
      return items as Record<string, unknown>[];
    } catch (err) {
      console.error('❌ [HousingPlace Error]:', err);
      this.logger.error('[HousingPlace] Error al obtener alojamientos', err);
      return [];
    }
  }

  async getAlojamientoById(id: number): Promise<Record<string, unknown> | null> {
    try {
      const res   = await this.http.get(`/alojamientos/${id}`);
      const items = Array.isArray(res.data) ? res.data : [];
      if (items.length > 0) return items[0] as Record<string, unknown>;
    } catch {
      // direct lookup failed — fall through to full-list filter
    }
    try {
      const res = await this.http.get('/alojamientos');
      const all = Array.isArray(res.data) ? res.data : [];
      const match = all.find(
        (h: unknown) => Number((h as Record<string, unknown>).alojamientoId) === id,
      );
      return (match as Record<string, unknown>) ?? null;
    } catch (err) {
      console.error('❌ [HousingPlace Error]:', err);
      this.logger.error(`[HousingPlace] Error al obtener alojamiento id=${id}`, err);
      return null;
    }
  }

  async getHabitacionesPorAlojamiento(id: number): Promise<Habitacion[]> {
    try {
      const res   = await this.http.get(`/habitaciones/alojamiento/${id}`);
      const items = Array.isArray(res.data) ? res.data : [];
      this.logger.log(`[HousingPlace] ${items.length} habitaciones para alojamiento id=${id}`);
      return items as Habitacion[];
    } catch (err) {
      console.error('❌ [HousingPlace Error]:', err);
      this.logger.error(`[HousingPlace] Error al obtener habitaciones para id=${id}`, err);
      return [];
    }
  }

  // ─── Reservas remotas ──────────────────────────────────────────────────────
  async verificarDisponibilidadHotel(alojamientoId: string, habitacionId: string): Promise<DisponibilidadHotelDto> {
    try {
      const habs = await this.getHabitacionesPorAlojamiento(Number(alojamientoId));
      const exists = habs.some((h: any) => String(h.habitacionId) === habitacionId);
      return {
        alojamientoId,
        habitacionId,
        disponible: exists,
        status: exists ? 'DISPONIBLE' : 'NO_DISPONIBLE',
        mensaje: exists ? 'Habitación disponible en catálogo' : 'Habitación no encontrada en HousingPlace',
      };
    } catch (err) {
      this.logger.error(`[HousingPlace] Error verificando disponibilidad para alojamientoId=${alojamientoId} habitacionId=${habitacionId}`, err);
      return {
        alojamientoId,
        habitacionId,
        disponible: false,
        status: 'ERROR',
        mensaje: err instanceof Error ? err.message : 'Error al conectar con HousingPlace',
      };
    }
  }

  async crearReservaHotel(data: CrearReservaHotelDto): Promise<ReservaHotelExternaDto> {
    try {
      const checkIn = data.fechaInicio.substring(0, 10);
      const checkOut = data.fechaFin.substring(0, 10);
      const date1 = new Date(checkIn);
      const date2 = new Date(checkOut);
      const diffTime = Math.abs(date2.getTime() - date1.getTime());
      const numNoches = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

      let precioPorNoche = 50; // Fallback
      try {
        const habs = await this.getHabitacionesPorAlojamiento(Number(data.alojamientoId));
        const found = habs.find((h: any) => String(h.habitacionId) === data.habitacionId);
        if (found && found.precioNoche) {
          precioPorNoche = Number(found.precioNoche);
        }
      } catch (err) {
        this.logger.warn(`[HousingPlace] No se pudo obtener precio dinámico, usando fallback.`, err);
      }

      const payload = {
        clienteId: Number(data.clienteId) || 1,
        alojamientoId: Number(data.alojamientoId),
        fechaCheckIn: checkIn,
        fechaCheckOut: checkOut,
        numAdultos: 2,
        numNinos: 0,
        llevaMascotas: false,
        codigoDescuento: null,
        habitaciones: [
          {
            habitacionId: Number(data.habitacionId),
            precioPorNoche,
            numNoches,
          },
        ],
      };

      const res = await this.http.post('/booking', payload);
      const rawRes = res.data?.data ?? res.data;
      return {
        id: String(rawRes.reservaId ?? rawRes.id ?? 'HSP-' + Date.now()),
        codigoReserva: rawRes.codigoReserva ?? String(rawRes.reservaId ?? rawRes.id ?? ''),
        status: 'PENDIENTE',
        alojamientoId: data.alojamientoId,
        habitacionId: data.habitacionId,
        clienteId: data.clienteId,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
      };
    } catch (err) {
      this.logger.error(`[HousingPlace] Error creando reserva`, err);
      throw err;
    }
  }

  async confirmarReservaHotel(id: string): Promise<ReservaHotelExternaDto> {
    try {
      await this.http.patch(`/booking/${id}/estado`, {
        estado: 'Confirmada',
      });
      return {
        id,
        status: 'CONFIRMADA',
      };
    } catch (err) {
      this.logger.error(`[HousingPlace] Error confirmando reserva id=${id}`, err);
      throw err;
    }
  }

  async cancelarReservaHotel(id: string, reason?: string): Promise<ReservaHotelExternaDto> {
    try {
      await this.http.patch(`/booking/${id}/estado`, {
        estado: 'Cancelada',
      });
      return {
        id,
        status: 'CANCELADA',
      };
    } catch (err) {
      this.logger.error(`[HousingPlace] Error cancelando reserva id=${id}`, err);
      throw err;
    }
  }
}
