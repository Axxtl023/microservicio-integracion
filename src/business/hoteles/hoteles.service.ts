import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';

import type { IHotelesService, ListarHotelesParams } from './interfaces/i-hoteles.service';
import type { IHotelesClient } from '../../infrastructure/hoteles/i-hoteles.client';
import { IHOTELES_CLIENT } from '../../infrastructure/hoteles/i-hoteles.client';
import type { IHomiyaClient } from '../../infrastructure/homiya/i-homiya.client';
import { IHOMIYA_CLIENT } from '../../infrastructure/homiya/i-homiya.client';
import type { IRodrigosClient } from '../../infrastructure/rodrigos/i-rodrigos.client';
import { IRODRIGOS_CLIENT } from '../../infrastructure/rodrigos/i-rodrigos.client';
import type { IHousingPlaceClient } from '../../infrastructure/housing-place/i-housing-place.client';
import { IHOUSING_PLACE_CLIENT } from '../../infrastructure/housing-place/i-housing-place.client';
import type { IAlojaExpressClient } from '../../infrastructure/aloja-express/i-aloja-express.client';
import { IALOJAEXPRESS_CLIENT } from '../../infrastructure/aloja-express/i-aloja-express.client';
import type { Hotel, Habitacion, HabitacionUnificada, PaginatedHoteles } from '../../interfaces/hoteles.interface';

@Injectable()
export class HotelesService implements IHotelesService {
  private readonly logger = new Logger(HotelesService.name);

  constructor(
    @Inject(IHOTELES_CLIENT)       private readonly locus:        IHotelesClient,
    @Inject(IHOMIYA_CLIENT)        private readonly homiya:        IHomiyaClient,
    @Inject(IRODRIGOS_CLIENT)      private readonly rodrigos:      IRodrigosClient,
    @Inject(IHOUSING_PLACE_CLIENT) private readonly housingPlace:  IHousingPlaceClient,
    @Inject(IALOJAEXPRESS_CLIENT)  private readonly alojaExpress:  IAlojaExpressClient,
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

  private mapHousingPlace(raw: Record<string, unknown>): Hotel {
    return {
      alojamientoId:        Number(raw.alojamientoId        ?? 0),
      nombre:               String(raw.nombre               ?? 'Alojamiento'),
      ciudad:               String(raw.ciudad               ?? ''),
      direccion:            String(raw.direccion            ?? ''),
      descripcion:          (raw.descripcion as string | null) ?? null,
      estrellas:            raw.estrellas != null ? Number(raw.estrellas) : null,
      calificacionPromedio: Number(raw.calificacionPromedio ?? 0),
      admiteMascotas:       Boolean(raw.admiteMascotas      ?? false),
      tienePiscina:         Boolean(raw.tienePiscina        ?? false),
      tieneParqueadero:     Boolean(raw.tieneParqueadero    ?? false),
    };
  }

  private mapAlojaExpress(raw: Record<string, unknown>): Hotel {
    return {
      alojamientoId:        Number(raw.alojamientoId        ?? 0),
      nombre:               String(raw.nombre               ?? 'Alojamiento'),
      ciudad:               String(raw.ciudad               ?? ''),
      direccion:            String(raw.direccion            ?? ''),
      descripcion:          (raw.descripcion as string | null) ?? null,
      estrellas:            raw.estrellas != null ? Number(raw.estrellas) : null,
      calificacionPromedio: Number(raw.calificacionPromedio ?? 0),
      admiteMascotas:       Boolean(raw.admiteMascotas      ?? false),
      tienePiscina:         Boolean(raw.tienePiscina        ?? false),
      tieneParqueadero:     Boolean(raw.tieneParqueadero    ?? false),
    };
  }

  async listar(params: ListarHotelesParams): Promise<PaginatedHoteles> {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.max(1, params.limit ?? 10);

    const [locusResult, homiyaResult, rodrigosResult, housingPlaceResult, alojaExpressResult] = await Promise.allSettled([
      this.locus.getHoteles(),
      this.homiya.getHoteles(),
      this.rodrigos.getHoteles(),
      this.housingPlace.getAlojamientos(),
      this.alojaExpress.getAlojamientos(),
    ]);

    if (locusResult.status        === 'rejected') this.logger.error('[Locus] Error al obtener hoteles',        locusResult.reason);
    if (homiyaResult.status       === 'rejected') this.logger.error('[Homiya] Error al obtener hoteles',       homiyaResult.reason);
    if (rodrigosResult.status     === 'rejected') this.logger.error("[Rodrigo's] Error al obtener hoteles",    rodrigosResult.reason);
    if (housingPlaceResult.status === 'rejected') this.logger.error('[HousingPlace] Error al obtener hoteles', housingPlaceResult.reason);
    if (alojaExpressResult.status === 'rejected') this.logger.error('[AlojaExpress] Error al obtener hoteles', alojaExpressResult.reason);

    const locusRaw    = locusResult.status    === 'fulfilled' ? locusResult.value    : [];
    const homiyaRaw   = homiyaResult.status   === 'fulfilled' ? homiyaResult.value   : [];
    const rodrigosRaw = rodrigosResult.status === 'fulfilled' ? rodrigosResult.value : [];

    const rawHousingValue = housingPlaceResult.status === 'fulfilled' ? housingPlaceResult.value : [];
    const housingPlaceRaw: Record<string, unknown>[] = Array.isArray(rawHousingValue) ? rawHousingValue : [];

    const rawAlojaExpressValue = alojaExpressResult.status === 'fulfilled' ? alojaExpressResult.value : [];
    const alojaExpressRaw: Record<string, unknown>[] = Array.isArray(rawAlojaExpressValue) ? rawAlojaExpressValue : [];

    this.logger.log(
      `[HousingPlace] ${housingPlaceRaw.length} ítems recibidos del cliente` +
      (housingPlaceRaw.length > 0
        ? ` · claves del primer ítem: [${Object.keys(housingPlaceRaw[0]).join(', ')}]`
        : ' · array vacío'),
    );
    this.logger.log(
      `[AlojaExpress] ${alojaExpressRaw.length} ítems recibidos del cliente` +
      (alojaExpressRaw.length > 0
        ? ` · claves del primer ítem: [${Object.keys(alojaExpressRaw[0]).join(', ')}]`
        : ' · array vacío'),
    );

    const [locusSettled, rodrigosSettled, housingPlaceSettled, alojaExpressSettled] = await Promise.allSettled([
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
      Promise.all(
        housingPlaceRaw.map(async (rawHotel) => {
          const mapped     = this.mapHousingPlace(rawHotel);
          const habs       = await this.housingPlace.getHabitacionesPorAlojamiento(mapped.alojamientoId);
          const unificadas = this.normalizarHabitaciones(habs);
          const precioBase = unificadas.length > 0
            ? Math.min(...unificadas.map((u) => u.precioNoche))
            : 40;
          return { ...mapped, precioBase, proveedor: 'HousingPlace' };
        }),
      ),
      Promise.all(
        alojaExpressRaw.map(async (rawHotel) => {
          const mapped     = this.mapAlojaExpress(rawHotel);
          const habs       = await this.alojaExpress.getHabitacionesPorAlojamiento(mapped.alojamientoId);
          const unificadas = (habs as unknown as Record<string, unknown>[]).map((r) => ({
            precioNoche: Number(r.precioNoche) || 0,
          }));
          const precioBase = unificadas.length > 0
            ? Math.min(...unificadas.map((u) => u.precioNoche))
            : 40;
          return { ...mapped, precioBase, proveedor: 'AlojaExpress' };
        }),
      ),
    ]);

    if (locusSettled.status        === 'rejected') this.logger.error('[Locus] Error al procesar hoteles',        locusSettled.reason);
    if (rodrigosSettled.status     === 'rejected') this.logger.error("[Rodrigo's] Error al procesar hoteles",    rodrigosSettled.reason);
    if (housingPlaceSettled.status === 'rejected') this.logger.error('[HousingPlace] Error al procesar hoteles', housingPlaceSettled.reason);
    if (alojaExpressSettled.status === 'rejected') this.logger.error('[AlojaExpress] Error al procesar hoteles', alojaExpressSettled.reason);

    const locusItems        = locusSettled.status        === 'fulfilled' ? locusSettled.value        : [];
    const rodrigosItems     = rodrigosSettled.status     === 'fulfilled' ? rodrigosSettled.value     : [];
    const housingPlaceItems = housingPlaceSettled.status === 'fulfilled' ? housingPlaceSettled.value : [];
    const alojaExpressItems = alojaExpressSettled.status === 'fulfilled' ? alojaExpressSettled.value : [];

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

    this.logger.log(
      `[Locus] ${locusItems.length} | [Homiya] ${homiyaItems.length} | [Rodrigo's] ${rodrigosItems.length} | [HousingPlace] ${housingPlaceItems.length} | [AlojaExpress] ${alojaExpressItems.length} hoteles`,
    );

    const all        = [...locusItems, ...homiyaItems, ...rodrigosItems, ...housingPlaceItems, ...alojaExpressItems];
    const total      = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage   = Math.min(page, totalPages);
    const items      = all.slice((safePage - 1) * limit, safePage * limit);

    return { items, total, page: safePage, limit, totalPages };
  }

  async obtenerPorId(id: number, proveedor?: string): Promise<Hotel> {
    if (proveedor === 'AlojaExpress') {
      const raw = await this.alojaExpress.getAlojamientoById(id);
      if (raw) {
        const mapped          = this.mapAlojaExpress(raw);
        const habitacionesRaw = await this.alojaExpress.getHabitacionesPorAlojamiento(id);
        const habitaciones: HabitacionUnificada[] = (habitacionesRaw as unknown as Record<string, unknown>[]).map((r) => ({
          id:             String(r.habitacionId ?? 0),
          nombre:         String(r.nombre       ?? 'Habitación'),
          precioNoche:    Number(r.precioNoche)  || 0,
          capacidadTotal: Number(r.capacidadAdultos ?? 0) + Number(r.capacidadNinos ?? 0),
          disponible:     true,
        }));
        const precioBase = habitaciones.length > 0
          ? Math.min(...habitaciones.map((h) => h.precioNoche))
          : (mapped.precioBase ?? 40);
        return { ...mapped, precioBase, proveedor: 'AlojaExpress', habitaciones };
      }
      throw new NotFoundException(`Hotel AlojaExpress con id "${id}" no encontrado`);
    }

    if (proveedor === 'HousingPlace') {
      const housingPlaceRaw = await this.housingPlace.getAlojamientoById(id);
      if (housingPlaceRaw) {
        const mapped          = this.mapHousingPlace(housingPlaceRaw);
        const habitacionesRaw = await this.housingPlace.getHabitacionesPorAlojamiento(id);
        const habitaciones: HabitacionUnificada[] = (habitacionesRaw as unknown as Record<string, unknown>[]).map((r) => ({
          id:             String(r.habitacionId ?? 0),
          nombre:         String(r.nombre       ?? 'Habitación'),
          precioNoche:    Number(r.precioNoche)  || 0,
          capacidadTotal: Number(r.capacidadAdultos ?? 0) + Number(r.capacidadNinos ?? 0),
          disponible:     true,
        }));
        const precioBase = habitaciones.length > 0
          ? Math.min(...habitaciones.map((h) => h.precioNoche))
          : (mapped.precioBase ?? 40);
        return { ...mapped, precioBase, proveedor: 'HousingPlace', habitaciones };
      }
      throw new NotFoundException(`Hotel HousingPlace con id "${id}" no encontrado`);
    }

    if (proveedor === 'Locus') {
      const locusRaw = await this.locus.getHotelById(id).catch(() => null);
      if (locusRaw) {
        const habitacionesRaw = await this.locus.getHabitacionesPorAlojamiento(id);
        const habitaciones    = this.normalizarHabitaciones(habitacionesRaw);
        const precioBase      = habitaciones.length > 0 ? Math.min(...habitaciones.map((h) => h.precioNoche)) : (locusRaw.precioBase ?? 40);
        return { ...this.mapHotel({ ...locusRaw, alojamientoId: id, precioBase }, 'Locus'), habitaciones };
      }
      throw new NotFoundException(`Hotel Locus con id "${id}" no encontrado`);
    }

    if (proveedor === 'Homiya') {
      const homiyaRaw = await this.homiya.getHotelById(id).catch(() => null);
      if (homiyaRaw) {
        const habitacionesRaw = await this.homiya.getHabitacionesPorAlojamiento(id);
        const habitaciones    = this.normalizarHabitaciones(habitacionesRaw);
        const precioBase      = habitaciones.length > 0 ? Math.min(...habitaciones.map((h) => h.precioNoche)) : (homiyaRaw.precioBase ?? 40);
        return { ...this.mapHotel({ ...homiyaRaw, alojamientoId: id, precioBase }, 'Homiya'), habitaciones };
      }
      throw new NotFoundException(`Hotel Homiya con id "${id}" no encontrado`);
    }

    if (proveedor === "Rodrigo's") {
      const rodrigosRaw = await this.rodrigos.getHotelById(id).catch(() => null);
      if (rodrigosRaw) {
        const habitacionesRaw = await this.rodrigos.getHabitacionesPorAlojamiento(id);
        const habitaciones    = this.normalizarHabitaciones(habitacionesRaw);
        const precioBase      = habitaciones.length > 0 ? Math.min(...habitaciones.map((h) => h.precioNoche)) : (rodrigosRaw.precioBase ?? 40);
        return { ...this.mapHotel({ ...rodrigosRaw, alojamientoId: id, precioBase }, "Rodrigo's"), habitaciones };
      }
      throw new NotFoundException(`Hotel Rodrigo's con id "${id}" no encontrado`);
    }

    // Fallback: scan all providers concurrently (no proveedor specified)
    const [locusResult, homiyaResult, rodrigosResult, housingPlaceResult, alojaExpressResult] = await Promise.allSettled([
      this.locus.getHotelById(id),
      this.homiya.getHotelById(id),
      this.rodrigos.getHotelById(id),
      this.housingPlace.getAlojamientoById(id),
      this.alojaExpress.getAlojamientoById(id),
    ]);

    const locusRaw        = locusResult.status        === 'fulfilled' ? locusResult.value        : null;
    const homiyaRaw       = homiyaResult.status       === 'fulfilled' ? homiyaResult.value       : null;
    const rodrigosRaw     = rodrigosResult.status     === 'fulfilled' ? rodrigosResult.value     : null;
    const housingPlaceRaw = housingPlaceResult.status === 'fulfilled' ? housingPlaceResult.value : null;
    const alojaExpressRaw = alojaExpressResult.status === 'fulfilled' ? alojaExpressResult.value : null;

    if (locusRaw) {
      const habitacionesRaw = await this.locus.getHabitacionesPorAlojamiento(id);
      const habitaciones    = this.normalizarHabitaciones(habitacionesRaw);
      const precioBase      = habitaciones.length > 0
        ? Math.min(...habitaciones.map((h) => h.precioNoche))
        : (locusRaw.precioBase ?? 40);
      return { ...this.mapHotel({ ...locusRaw, alojamientoId: id, precioBase }, 'Locus'), habitaciones };
    }

    if (homiyaRaw) {
      const habitacionesRaw = await this.homiya.getHabitacionesPorAlojamiento(id);
      const habitaciones    = this.normalizarHabitaciones(habitacionesRaw);
      const precioBase      = habitaciones.length > 0
        ? Math.min(...habitaciones.map((h) => h.precioNoche))
        : (homiyaRaw.precioBase ?? 40);
      return { ...this.mapHotel({ ...homiyaRaw, alojamientoId: id, precioBase }, 'Homiya'), habitaciones };
    }

    if (rodrigosRaw) {
      const habitacionesRaw = await this.rodrigos.getHabitacionesPorAlojamiento(id);
      const habitaciones    = this.normalizarHabitaciones(habitacionesRaw);
      const precioBase      = habitaciones.length > 0
        ? Math.min(...habitaciones.map((h) => h.precioNoche))
        : (rodrigosRaw.precioBase ?? 40);
      return { ...this.mapHotel({ ...rodrigosRaw, alojamientoId: id, precioBase }, "Rodrigo's"), habitaciones };
    }

    if (housingPlaceRaw) {
      const mapped          = this.mapHousingPlace(housingPlaceRaw);
      const habitacionesRaw = await this.housingPlace.getHabitacionesPorAlojamiento(id);
      const habitaciones: HabitacionUnificada[] = (habitacionesRaw as unknown as Record<string, unknown>[]).map((r) => ({
        id:             String(r.habitacionId ?? 0),
        nombre:         String(r.nombre       ?? 'Habitación'),
        precioNoche:    Number(r.precioNoche)  || 0,
        capacidadTotal: Number(r.capacidadAdultos ?? 0) + Number(r.capacidadNinos ?? 0),
        disponible:     true,
      }));
      const precioBase = habitaciones.length > 0
        ? Math.min(...habitaciones.map((h) => h.precioNoche))
        : (mapped.precioBase ?? 40);
      return { ...mapped, precioBase, proveedor: 'HousingPlace', habitaciones };
    }

    if (alojaExpressRaw) {
      const mapped          = this.mapAlojaExpress(alojaExpressRaw);
      const habitacionesRaw = await this.alojaExpress.getHabitacionesPorAlojamiento(id);
      const habitaciones: HabitacionUnificada[] = (habitacionesRaw as unknown as Record<string, unknown>[]).map((r) => ({
        id:             String(r.habitacionId ?? 0),
        nombre:         String(r.nombre       ?? 'Habitación'),
        precioNoche:    Number(r.precioNoche)  || 0,
        capacidadTotal: Number(r.capacidadAdultos ?? 0) + Number(r.capacidadNinos ?? 0),
        disponible:     true,
      }));
      const precioBase = habitaciones.length > 0
        ? Math.min(...habitaciones.map((h) => h.precioNoche))
        : (mapped.precioBase ?? 40);
      return { ...mapped, precioBase, proveedor: 'AlojaExpress', habitaciones };
    }

    throw new NotFoundException(`Hotel con id "${id}" no encontrado en ningún proveedor`);
  }
}
