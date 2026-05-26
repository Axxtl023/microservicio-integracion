import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IRodrigosClient } from './i-rodrigos.client';
import type { Hotel, Habitacion } from '../../interfaces/hoteles.interface';
import type { CrearReservaHotelDto } from '../../business/hoteles/dtos/crear-reserva-hotel.dto';
import type { DisponibilidadHotelDto } from '../../business/hoteles/dtos/disponibilidad-hotel.dto';
import type { ReservaHotelExternaDto } from '../../business/hoteles/dtos/reserva-hotel-externa.dto';

@Injectable()
export class RodrigosClient implements IRodrigosClient {
  private readonly logger = new Logger(RodrigosClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.RODRIGOS_API_URL ?? 'https://apigatway-0wjx.onrender.com',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── Catálogo ─────────────────────────────────────────────────────────────
  async getHoteles(): Promise<Hotel[]> {
    try {
      const res = await this.http.get('/api/v1/alojamientos-lucano');
      const payload: unknown = res.data ?? [];

      if (Array.isArray(payload)) {
        this.logger.log(`[Rodrigo's] ${payload.length} alojamientos recibidos`);
        return payload as Hotel[];
      }

      this.logger.warn("[Rodrigo's] Estructura inesperada al listar hoteles", payload);
      return [];
    } catch (err) {
      this.logger.error("[Rodrigo's] Error al obtener alojamientos", err);
      throw new ServiceUnavailableException("No se pudo conectar con Rodrigo's");
    }
  }

  async getHotelById(id: number): Promise<Hotel | null> {
    try {
      const res = await this.http.get(`/api/v1/alojamientos-lucano/${id}`);
      const payload: unknown = res.data ?? null;

      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return payload as Hotel;
      }

      this.logger.warn(`[Rodrigo's] Respuesta inesperada para hotel id=${id}`, payload);
      return null;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      this.logger.error(`[Rodrigo's] Error al obtener hotel id=${id}`, err);
      throw new ServiceUnavailableException("No se pudo conectar con Rodrigo's");
    }
  }

  async getHabitacionesPorAlojamiento(id: number): Promise<Habitacion[]> {
    try {
      const res = await this.http.get(`/api/v1/habitaciones-lucano/alojamiento/${id}`);
      const payload: unknown = res.data ?? [];

      if (Array.isArray(payload)) {
        this.logger.log(`[Rodrigo's] ${payload.length} habitaciones para alojamiento id=${id}`);
        return payload as Habitacion[];
      }

      this.logger.warn(`[Rodrigo's] Estructura inesperada en habitaciones para id=${id}`, payload);
      return [];
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return [];
      this.logger.error(`[Rodrigo's] Error al obtener habitaciones para id=${id}`, err);
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
        mensaje: exists ? 'Habitación disponible en catálogo' : "Habitación no encontrada en Rodrigo's",
      };
    } catch (err) {
      this.logger.error(`[Rodrigo's] Error verificando disponibilidad para alojamientoId=${alojamientoId} habitacionId=${habitacionId}`, err);
      return {
        alojamientoId,
        habitacionId,
        disponible: false,
        status: 'ERROR',
        mensaje: err instanceof Error ? err.message : "Error al conectar con Rodrigo's",
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
        this.logger.warn(`[Rodrigo's] No se pudo obtener precio dinámico, usando fallback.`, err);
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

      const res = await this.http.post('/api/v1/reservas-lucano', payload);
      const rawRes = res.data?.data ?? res.data;
      return {
        id: String(rawRes.reservaId ?? rawRes.id ?? 'RDG-' + Date.now()),
        codigoReserva: rawRes.codigoReserva ?? String(rawRes.reservaId ?? rawRes.id ?? ''),
        status: 'PENDIENTE',
        alojamientoId: data.alojamientoId,
        habitacionId: data.habitacionId,
        clienteId: data.clienteId,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
      };
    } catch (err) {
      this.logger.error(`[Rodrigo's] Error creando reserva`, err);
      throw err;
    }
  }

  async confirmarReservaHotel(id: string): Promise<ReservaHotelExternaDto> {
    try {
      await this.http.patch(`/api/v1/reservas-lucano/${id}/estado`, {
        estado: 'Confirmada',
      });
      return {
        id,
        status: 'CONFIRMADA',
      };
    } catch (err) {
      this.logger.error(`[Rodrigo's] Error confirmando reserva id=${id}`, err);
      throw err;
    }
  }

  async cancelarReservaHotel(id: string, reason?: string): Promise<ReservaHotelExternaDto> {
    try {
      await this.http.patch(`/api/v1/reservas-lucano/${id}/estado`, {
        estado: 'Cancelada',
      });
      return {
        id,
        status: 'CANCELADA',
      };
    } catch (err) {
      this.logger.error(`[Rodrigo's] Error cancelando reserva id=${id}`, err);
      throw err;
    }
  }
}
