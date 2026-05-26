import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IHotelesClient } from './i-hoteles.client';
import type { Hotel, Habitacion } from '../../interfaces/hoteles.interface';
import type { CrearReservaHotelDto } from '../../business/hoteles/dtos/crear-reserva-hotel.dto';
import type { DisponibilidadHotelDto } from '../../business/hoteles/dtos/disponibilidad-hotel.dto';
import type { ReservaHotelExternaDto } from '../../business/hoteles/dtos/reserva-hotel-externa.dto';

@Injectable()
export class HotelesClient implements IHotelesClient {
  private readonly logger = new Logger(HotelesClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.HOTELES_API_URL ?? 'https://israel-apigateway.onrender.com',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── Catálogo ─────────────────────────────────────────────────────────────
  async getHoteles(): Promise<Hotel[]> {
    try {
      const res = await this.http.get('/api/v1/israel-hernandez/alojamientos');
      const payload: unknown = res.data?.data ?? res.data;

      if (Array.isArray(payload)) {
        this.logger.log(`[Locus] ${payload.length} alojamientos recibidos`);
        return payload as Hotel[];
      }

      this.logger.warn('[Locus] Estructura inesperada al listar hoteles', payload);
      return [];
    } catch (err) {
      this.logger.error('[Locus] Error al obtener alojamientos', err);
      throw new ServiceUnavailableException('No se pudo conectar con Locus');
    }
  }

  async getHotelById(id: number): Promise<Hotel | null> {
    try {
      const res = await this.http.get(`/api/v1/israel-hernandez/alojamientos/${id}`);
      const payload: unknown = res.data?.data ?? res.data;

      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return payload as Hotel;
      }

      this.logger.warn(`[Locus] Respuesta inesperada para hotel id=${id}`, payload);
      return null;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      this.logger.error(`[Locus] Error al obtener hotel id=${id}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con Locus');
    }
  }

  async getHabitacionesPorAlojamiento(id: number): Promise<Habitacion[]> {
    try {
      const res = await this.http.get(`/api/v1/israel-hernandez/alojamientos/${id}/habitaciones`);
      const payload: unknown = res.data?.data ?? res.data ?? [];

      if (Array.isArray(payload)) {
        this.logger.log(`[Locus] ${payload.length} habitaciones para alojamiento id=${id}`);
        return payload as Habitacion[];
      }

      this.logger.warn(`[Locus] Estructura inesperada en habitaciones para id=${id}`, payload);
      return [];
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return [];
      this.logger.error(`[Locus] Error al obtener habitaciones para id=${id}`, err);
      return [];
    }
  }

  // ─── Reservas remotas ──────────────────────────────────────────────────────
  async verificarDisponibilidadHotel(alojamientoId: string, habitacionId: string): Promise<DisponibilidadHotelDto> {
    try {
      const res = await this.http.get(`/api/v1/israel-hernandez/alojamientos/${alojamientoId}/habitaciones`);
      const payload = res.data?.data ?? res.data ?? [];
      const exists = Array.isArray(payload) && payload.some((h: any) => String(h.habitacionId) === habitacionId);
      return {
        alojamientoId,
        habitacionId,
        disponible: exists,
        status: exists ? 'DISPONIBLE' : 'NO_DISPONIBLE',
        mensaje: exists ? 'Habitación disponible' : 'Habitación no encontrada o no disponible en Locus',
      };
    } catch (err) {
      this.logger.error(`[Locus] Error verificando disponibilidad para alojamientoId=${alojamientoId} habitacionId=${habitacionId}`, err);
      return {
        alojamientoId,
        habitacionId,
        disponible: false,
        status: 'ERROR',
        mensaje: err instanceof Error ? err.message : 'Error al conectar con Locus',
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

      // Intentar obtener el precio real de la habitación
      let precioPorNoche = 50; // Fallback
      try {
        const habs = await this.getHabitacionesPorAlojamiento(Number(data.alojamientoId));
        const found = habs.find((h: any) => String(h.habitacionId) === data.habitacionId);
        if (found && found.precioNoche) {
          precioPorNoche = Number(found.precioNoche);
        }
      } catch (err) {
        this.logger.warn(`[Locus] No se pudo obtener el precio dinámico de la habitación ${data.habitacionId}, usando fallback.`, err);
      }

      const payload = {
        clienteId: Number(data.clienteId) || 1,
        alojamientoId: Number(data.alojamientoId),
        fechaCheckIn: checkIn,
        fechaCheckOut: checkOut,
        numAdultos: 2,
        numNinos: 0,
        llevaMascotas: false,
        codigoDescuento: '',
        habitaciones: [
          {
            habitacionId: Number(data.habitacionId),
            precioPorNoche,
            numNoches,
          },
        ],
      };

      const res = await this.http.post('/api/v1/israel-hernandez/booking', payload);
      const rawRes = res.data?.data ?? res.data;
      return {
        id: String(rawRes.reservaId ?? rawRes.id ?? 'LCS-' + Date.now()),
        codigoReserva: rawRes.codigoReserva ?? String(rawRes.reservaId ?? rawRes.id ?? ''),
        status: 'PENDIENTE',
        alojamientoId: data.alojamientoId,
        habitacionId: data.habitacionId,
        clienteId: data.clienteId,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
      };
    } catch (err) {
      this.logger.error(`[Locus] Error creando reserva`, err);
      throw err;
    }
  }

  async confirmarReservaHotel(id: string): Promise<ReservaHotelExternaDto> {
    try {
      await this.http.patch(`/api/v1/israel-hernandez/booking/${id}/estado`, {
        estado: 'Confirmada',
      });
      return {
        id,
        status: 'CONFIRMADA',
      };
    } catch (err) {
      this.logger.error(`[Locus] Error confirmando reserva id=${id}`, err);
      throw err;
    }
  }

  async cancelarReservaHotel(id: string, reason?: string): Promise<ReservaHotelExternaDto> {
    try {
      await this.http.patch(`/api/v1/israel-hernandez/booking/${id}/estado`, {
        estado: 'Cancelada',
      });
      return {
        id,
        status: 'CANCELADA',
      };
    } catch (err) {
      this.logger.error(`[Locus] Error cancelando reserva id=${id}`, err);
      throw err;
    }
  }
}
