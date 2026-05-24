import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';

import type { IHotelesService, ListarHotelesParams } from './interfaces/i-hoteles.service';
import type { IHotelesClient } from '../../infrastructure/hoteles/i-hoteles.client';
import { IHOTELES_CLIENT } from '../../infrastructure/hoteles/i-hoteles.client';
import type { IHomiyaClient } from '../../infrastructure/homiya/i-homiya.client';
import { IHOMIYA_CLIENT } from '../../infrastructure/homiya/i-homiya.client';
import type { IRodrigosClient } from '../../infrastructure/rodrigos/i-rodrigos.client';
import { IRODRIGOS_CLIENT } from '../../infrastructure/rodrigos/i-rodrigos.client';
import type { Hotel, Habitacion, HabitacionUnificada, PaginatedHoteles } from '../../interfaces/hoteles.interface';

@Injectable()
export class HotelesService implements IHotelesService {
  private readonly logger = new Logger(HotelesService.name);

  constructor(
    @Inject(IHOTELES_CLIENT)  private readonly locus:    IHotelesClient,
    @Inject(IHOMIYA_CLIENT)   private readonly homiya:   IHomiyaClient,
    @Inject(IRODRIGOS_CLIENT) private readonly rodrigos: IRodrigosClient,
  ) {}

  private normalizarHabitaciones(raws: Habitacion[]): HabitacionUnificada[] {
    return raws.map((r) => ({
      id:             String(r.habitacionId),
      nombre:         r.nombre          ?? 'Habitación',
      precioNoche:    r.precioNoche     ?? 0,
      capacidadTotal: (r.capacidadAdultos ?? 0) + (r.capacidadNinos ?? 0),
      disponible:     true,
    }));
  }

  private mapHotel(h: Hotel, proveedor: string): Hotel {
    return {
      alojamientoId:        h.alojamientoId,
      nombre:               h.nombre               ?? '',
      ciudad:               h.ciudad               ?? '',
      direccion:            h.direccion            ?? '',
      descripcion:          h.descripcion          ?? null,
      estrellas:            h.estrellas            ?? null,
      calificacionPromedio: h.calificacionPromedio ?? 0,
      admiteMascotas:       h.admiteMascotas       ?? false,
      tienePiscina:         h.tienePiscina         ?? false,
      tieneParqueadero:     h.tieneParqueadero     ?? false,
      ...(h.precioBase   != null && { precioBase:   h.precioBase   }),
      ...(h.telefono     != null && { telefono:     h.telefono     }),
      ...(h.habitaciones != null && { habitaciones: h.habitaciones }),
      proveedor,
    };
  }

  async listar(params: ListarHotelesParams): Promise<PaginatedHoteles> {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.max(1, params.limit ?? 10);

    const [locusResult, homiyaResult, rodrigosResult] = await Promise.allSettled([
      this.locus.getHoteles(),
      this.homiya.getHoteles(),
      this.rodrigos.getHoteles(),
    ]);

    if (locusResult.status    === 'rejected') this.logger.error('[Locus] Error al obtener hoteles',     locusResult.reason);
    if (homiyaResult.status   === 'rejected') this.logger.error('[Homiya] Error al obtener hoteles',    homiyaResult.reason);
    if (rodrigosResult.status === 'rejected') this.logger.error("[Rodrigo's] Error al obtener hoteles", rodrigosResult.reason);

    const locusRaw    = locusResult.status    === 'fulfilled' ? locusResult.value : [];
    const homiyaRaw   = homiyaResult.status   === 'fulfilled' ? homiyaResult.value : [];
    const rodrigosRaw = rodrigosResult.status === 'fulfilled' ? rodrigosResult.value : [];

    const [locusItems, rodrigosItems] = await Promise.all([
      Promise.all(
        locusRaw.map(async (h) => {
          const habs       = await this.locus.getHabitacionesPorAlojamiento(h.alojamientoId);
          const unificadas = this.normalizarHabitaciones(habs);
          const precioBase = unificadas.length > 0
            ? Math.min(...unificadas.map((u) => u.precioNoche))
            : 40;
          return this.mapHotel({ ...h, precioBase }, 'Locus');
        }),
      ),
      Promise.all(
        rodrigosRaw.map(async (h) => {
          const habs       = await this.rodrigos.getHabitacionesPorAlojamiento(h.alojamientoId);
          const unificadas = this.normalizarHabitaciones(habs);
          const precioBase = unificadas.length > 0
            ? Math.min(...unificadas.map((u) => u.precioNoche))
            : 40;
          return this.mapHotel({ ...h, precioBase }, "Rodrigo's");
        }),
      ),
    ]);

    const homiyaItems: Hotel[] = await Promise.all(
      homiyaRaw.map(async (h) => {
        const habs       = await this.homiya.getHabitacionesPorAlojamiento(h.alojamientoId);
        const unificadas = this.normalizarHabitaciones(habs);
        const precioBase = unificadas.length > 0
          ? Math.min(...unificadas.map((u) => u.precioNoche))
          : (h.precioBase ?? 40);
        return this.mapHotel({ ...h, precioBase }, 'Homiya');
      }),
    );

    this.logger.log(`[Locus] ${locusItems.length} | [Homiya] ${homiyaItems.length} | [Rodrigo's] ${rodrigosItems.length} hoteles`);

    const all        = [...locusItems, ...homiyaItems, ...rodrigosItems];
    const total      = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage   = Math.min(page, totalPages);
    const items      = all.slice((safePage - 1) * limit, safePage * limit);

    return { items, total, page: safePage, limit, totalPages };
  }

  async obtenerPorId(id: number): Promise<Hotel> {
    const [locusResult, homiyaResult, rodrigosResult] = await Promise.allSettled([
      this.locus.getHotelById(id),
      this.homiya.getHotelById(id),
      this.rodrigos.getHotelById(id),
    ]);

    const locusRaw    = locusResult.status    === 'fulfilled' ? locusResult.value    : null;
    const homiyaRaw   = homiyaResult.status   === 'fulfilled' ? homiyaResult.value   : null;
    const rodrigosRaw = rodrigosResult.status === 'fulfilled' ? rodrigosResult.value : null;

    if (locusRaw) {
      const habitacionesRaw = await this.locus.getHabitacionesPorAlojamiento(id);
      const habitaciones    = this.normalizarHabitaciones(habitacionesRaw);
      const precioBase      = habitaciones.length > 0
        ? Math.min(...habitaciones.map((h) => h.precioNoche))
        : (locusRaw.precioBase ?? 40);
      return this.mapHotel({ ...locusRaw, alojamientoId: id, precioBase, habitaciones }, 'Locus');
    }

    if (homiyaRaw) {
      const habitacionesRaw = await this.homiya.getHabitacionesPorAlojamiento(id);
      const habitaciones    = this.normalizarHabitaciones(habitacionesRaw);
      const precioBase      = habitaciones.length > 0
        ? Math.min(...habitaciones.map((h) => h.precioNoche))
        : (homiyaRaw.precioBase ?? 40);
      return this.mapHotel({ ...homiyaRaw, alojamientoId: id, precioBase, habitaciones }, 'Homiya');
    }

    if (rodrigosRaw) {
      const habitacionesRaw = await this.rodrigos.getHabitacionesPorAlojamiento(id);
      const habitaciones    = this.normalizarHabitaciones(habitacionesRaw);
      const precioBase      = habitaciones.length > 0
        ? Math.min(...habitaciones.map((h) => h.precioNoche))
        : (rodrigosRaw.precioBase ?? 40);
      return this.mapHotel({ ...rodrigosRaw, alojamientoId: id, precioBase, habitaciones }, "Rodrigo's");
    }

    throw new NotFoundException(`Hotel con id "${id}" no encontrado en ningún proveedor`);
  }
}
