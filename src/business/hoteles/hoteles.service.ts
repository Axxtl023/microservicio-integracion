import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';

import type { IHotelesService, ListarHotelesParams } from './interfaces/i-hoteles.service';
import type { IHotelesClient } from '../../infrastructure/hoteles/i-hoteles.client';
import { IHOTELES_CLIENT } from '../../infrastructure/hoteles/i-hoteles.client';
import type { IHomiyaClient } from '../../infrastructure/homiya/i-homiya.client';
import { IHOMIYA_CLIENT } from '../../infrastructure/homiya/i-homiya.client';
import type { IRodrigosClient } from '../../infrastructure/rodrigos/i-rodrigos.client';
import { IRODRIGOS_CLIENT } from '../../infrastructure/rodrigos/i-rodrigos.client';
import type { Hotel, Habitacion, PaginatedHoteles } from '../../interfaces/hoteles.interface';

@Injectable()
export class HotelesService implements IHotelesService {
  private readonly logger = new Logger(HotelesService.name);

  constructor(
    @Inject(IHOTELES_CLIENT)  private readonly locus:    IHotelesClient,
    @Inject(IHOMIYA_CLIENT)   private readonly homiya:   IHomiyaClient,
    @Inject(IRODRIGOS_CLIENT) private readonly rodrigos: IRodrigosClient,
  ) {}

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

    const locusItems:    Hotel[] = locusResult.status    === 'fulfilled' ? locusResult.value.map((h)    => this.mapHotel(h, 'Locus'))     : [];
    const homiyaItems:   Hotel[] = homiyaResult.status   === 'fulfilled' ? homiyaResult.value.map((h)   => this.mapHotel(h, 'Homiya'))    : [];
    // Rodrigo's no incluye precioBase en el catálogo — fallback 40 para que la tarjeta no muestre NaN
    const rodrigosItems: Hotel[] = rodrigosResult.status === 'fulfilled'
      ? rodrigosResult.value.map((h) => this.mapHotel({ ...h, precioBase: h.precioBase ?? 40 }, "Rodrigo's"))
      : [];

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

    if (locusRaw && locusRaw.alojamientoId) {
      return this.mapHotel(locusRaw, 'Locus');
    }

    if (homiyaRaw && homiyaRaw.alojamientoId) {
      return this.mapHotel(homiyaRaw, 'Homiya');
    }

    if (rodrigosRaw && rodrigosRaw.alojamientoId) {
      const habitaciones: Habitacion[] = await this.rodrigos.getHabitacionesPorAlojamiento(rodrigosRaw.alojamientoId);
      const precioBase = habitaciones.length > 0
        ? Math.min(...habitaciones.map((hab) => hab.precioNoche ?? 40))
        : (rodrigosRaw.precioBase ?? 40);
      return this.mapHotel({ ...rodrigosRaw, precioBase, habitaciones }, "Rodrigo's");
    }

    throw new NotFoundException(`Hotel con id "${id}" no encontrado en ningún proveedor`);
  }
}
