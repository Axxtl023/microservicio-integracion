import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IAlojaExpressClient } from './i-aloja-express.client';
import type { CrearReservaHotelDto } from '../../business/hoteles/dtos/crear-reserva-hotel.dto';
import type { DisponibilidadHotelDto } from '../../business/hoteles/dtos/disponibilidad-hotel.dto';
import type { ReservaHotelExternaDto } from '../../business/hoteles/dtos/reserva-hotel-externa.dto';

@Injectable()
export class AlojaExpressClient implements IAlojaExpressClient {
  private readonly logger = new Logger(AlojaExpressClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.ALOJAEXPRESS_API_URL ?? 'https://api-gateway-y75a.onrender.com/api/v1',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── Catálogo ─────────────────────────────────────────────────────────────
  async getAlojamientos(): Promise<Record<string, unknown>[]> {
    try {
      const res   = await this.http.get('/alojamientos');
      const items = Array.isArray(res.data) ? res.data : [];
      this.logger.log(`[AlojaExpress] ${items.length} alojamientos obtenidos`);
      return items as Record<string, unknown>[];
    } catch (err) {
      this.logger.error('[AlojaExpress] Error al obtener alojamientos', err);
      return [];
    }
  }

  async getAlojamientoById(id: string | number): Promise<Record<string, unknown> | null> {
    const cleanId = String(id).trim();
    try {
      const res = await this.http.get(`/alojamientos/${cleanId}`);
      if (Array.isArray(res.data)) {
        return res.data.length > 0 ? (res.data[0] as Record<string, unknown>) : null;
      }
      if (res.data && typeof res.data === 'object') {
        return res.data as Record<string, unknown>;
      }
      return null;
    } catch {
      // direct lookup failed — fall through to full-list filter
    }
    try {
      const res = await this.http.get('/alojamientos');
      const all = Array.isArray(res.data) ? res.data : [];
      const match = all.find(
        (h: unknown) => Number((h as Record<string, unknown>).alojamientoId) === Number(cleanId),
      );
      return (match as Record<string, unknown>) ?? null;
    } catch (err) {
      this.logger.error(`[AlojaExpress] Error al obtener alojamiento id=${cleanId}`, err);
      return null;
    }
  }

  async getHabitacionesPorAlojamiento(id: string | number): Promise<Record<string, unknown>[]> {
    const cleanId = String(id).trim();
    try {
      const res   = await this.http.get(`/habitaciones/alojamiento/${cleanId}`);
      const items = Array.isArray(res.data) ? res.data : [];
      this.logger.log(`[AlojaExpress] ${items.length} habitaciones para alojamiento id=${cleanId}`);
      return items as Record<string, unknown>[];
    } catch (err) {
      this.logger.error(`[AlojaExpress] Error al obtener habitaciones para id=${cleanId}`, err);
      return [];
    }
  }

  // ─── Reservas remotas ──────────────────────────────────────────────────────
  async verificarDisponibilidadHotel(alojamientoId: string, habitacionId: string): Promise<DisponibilidadHotelDto> {
    try {
      const habs = await this.getHabitacionesPorAlojamiento(alojamientoId);
      const exists = habs.some((h: any) => String(h.habitacionId) === habitacionId);
      return {
        alojamientoId,
        habitacionId,
        disponible: exists,
        status: exists ? 'DISPONIBLE' : 'NO_DISPONIBLE',
        mensaje: exists ? 'Habitación disponible en catálogo' : 'Habitación no encontrada en AlojaExpress',
      };
    } catch (err) {
      this.logger.error(`[AlojaExpress] Error verificando disponibilidad para alojamientoId=${alojamientoId} habitacionId=${habitacionId}`, err);
      return {
        alojamientoId,
        habitacionId,
        disponible: false,
        status: 'ERROR',
        mensaje: err instanceof Error ? err.message : 'Error al conectar con AlojaExpress',
      };
    }
  }

  async crearReservaHotel(data: CrearReservaHotelDto): Promise<ReservaHotelExternaDto> {
    try {
      const checkIn = data.fechaInicio.substring(0, 10);
      const checkOut = data.fechaFin.substring(0, 10);

      let precioPorNoche = 50; // Fallback
      try {
        const habs = await this.getHabitacionesPorAlojamiento(data.alojamientoId);
        const found = habs.find((h: any) => String(h.habitacionId) === data.habitacionId);
        if (found && found.precioNoche) {
          precioPorNoche = Number(found.precioNoche);
        }
      } catch (err) {
        this.logger.warn(`[AlojaExpress] No se pudo obtener precio dinámico, usando fallback.`, err);
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
          },
        ],
      };

      const res = await this.http.post('/reservas', payload);
      const rawRes = res.data?.data ?? res.data;
      return {
        id: String(rawRes.reservaId ?? rawRes.id ?? 'ALX-' + Date.now()),
        codigoReserva: rawRes.codigoReserva ?? String(rawRes.reservaId ?? rawRes.id ?? ''),
        status: 'PENDIENTE',
        alojamientoId: data.alojamientoId,
        habitacionId: data.habitacionId,
        clienteId: data.clienteId,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
      };
    } catch (err) {
      this.logger.error(`[AlojaExpress] Error creando reserva`, err);
      throw err;
    }
  }

  async confirmarReservaHotel(id: string): Promise<ReservaHotelExternaDto> {
    // AlojaExpress se confirma automáticamente en la creación/pago
    return {
      id,
      status: 'CONFIRMADA',
    };
  }

  async cancelarReservaHotel(id: string, reason?: string): Promise<ReservaHotelExternaDto> {
    try {
      await this.http.patch(`/reservas/${id}/cancelar`);
      return {
        id,
        status: 'CANCELADA',
      };
    } catch (err) {
      this.logger.error(`[AlojaExpress] Error cancelando reserva id=${id}`, err);
      throw err;
    }
  }
}
