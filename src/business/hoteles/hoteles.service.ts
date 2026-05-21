import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';

import type { IHotelesService, ListarHotelesParams } from './interfaces/i-hoteles.service';
import type { IHotelesClient } from '../../infrastructure/hoteles/i-hoteles.client';
import { IHOTELES_CLIENT } from '../../infrastructure/hoteles/i-hoteles.client';
import type { Hotel, PaginatedHoteles } from '../../interfaces/hoteles.interface';

@Injectable()
export class HotelesService implements IHotelesService {
  private readonly logger = new Logger(HotelesService.name);

  constructor(
    @Inject(IHOTELES_CLIENT) private readonly locus: IHotelesClient,
  ) {}

  async listar(params: ListarHotelesParams): Promise<PaginatedHoteles> {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.max(1, params.limit ?? 10);

    let mapped: Hotel[] = [];

    try {
      const raw = await this.locus.getHoteles();

      mapped = raw.map((h) => ({
        alojamientoId:       h.alojamientoId,
        nombre:              h.nombre              ?? '',
        ciudad:              h.ciudad              ?? '',
        direccion:           h.direccion           ?? '',
        descripcion:         h.descripcion         ?? null,
        estrellas:           h.estrellas           ?? null,
        calificacionPromedio: h.calificacionPromedio ?? 0,
        admiteMascotas:      h.admiteMascotas      ?? false,
        tienePiscina:        h.tienePiscina        ?? false,
        tieneParqueadero:    h.tieneParqueadero    ?? false,
        proveedor:           'Locus',
      }));

      this.logger.log(`[Locus] ${mapped.length} hoteles mapeados correctamente`);
    } catch (err) {
      this.logger.error('[Locus] Error al obtener hoteles — retornando lista vacía', err);
      mapped = [];
    }

    const total      = mapped.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage   = Math.min(page, totalPages);
    const items      = mapped.slice((safePage - 1) * limit, safePage * limit);

    return { items, total, page: safePage, limit, totalPages };
  }

  async obtenerPorId(id: number): Promise<Hotel> {
    const raw = await this.locus.getHotelById(id);
    if (!raw) throw new NotFoundException(`Hotel con id "${id}" no encontrado`);

    return {
      alojamientoId:       raw.alojamientoId,
      nombre:              raw.nombre              ?? '',
      ciudad:              raw.ciudad              ?? '',
      direccion:           raw.direccion           ?? '',
      descripcion:         raw.descripcion         ?? null,
      estrellas:           raw.estrellas           ?? null,
      calificacionPromedio: raw.calificacionPromedio ?? 0,
      admiteMascotas:      raw.admiteMascotas      ?? false,
      tienePiscina:        raw.tienePiscina        ?? false,
      tieneParqueadero:    raw.tieneParqueadero    ?? false,
      proveedor:           'Locus',
    };
  }
}
