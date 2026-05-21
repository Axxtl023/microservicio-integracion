import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IAtraccionesService, ListarAtraccionesParams } from './interfaces/i-atracciones.service';
import type { IAtraccionesClient } from '../../infrastructure/atracciones/i-atracciones.client';
import { IATRACCIONES_CLIENT } from '../../infrastructure/atracciones/i-atracciones.client';
import type { Atraccion, PaginatedAtracciones } from '../../interfaces/atracciones.interface';

@Injectable()
export class AtraccionesService implements IAtraccionesService {
  private readonly logger = new Logger(AtraccionesService.name);

  constructor(
    @Inject(IATRACCIONES_CLIENT) private readonly terraQuest: IAtraccionesClient,
  ) {}

  async listar(params: ListarAtraccionesParams): Promise<PaginatedAtracciones> {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.max(1, params.limit ?? 10);

    let mapped: Atraccion[] = [];

    try {
      const raw = await this.terraQuest.getAtracciones({ page: 1, pageSize: 1000 });

      // Explicit field mapping — safe defaults for every field so a missing key
      // from the provider never produces undefined in the response.
      mapped = raw.map((a) => ({
        id:                  a.id,
        slug:                a.slug               ?? '',
        name:                a.name               ?? '',
        descriptionShort:    a.descriptionShort   ?? null,
        locationName:        a.locationName        ?? null,
        locationCountryCode: a.locationCountryCode ?? null,
        categoryName:        a.categoryName        ?? null,
        subcategoryName:     a.subcategoryName     ?? null,
        ratingAverage:       a.ratingAverage       ?? null,
        ratingCount:         a.ratingCount         ?? null,
        difficultyLevel:     a.difficultyLevel     ?? null,
        mainImageUrl:        a.mainImageUrl        ?? null,
        startingPrice:       a.startingPrice       ?? 0,
        currencyCode:        a.currencyCode        ?? 'USD',
        isActive:            a.isActive            ?? true,
        isPublished:         a.isPublished         ?? true,
        modalityCount:       a.modalityCount       ?? null,
        proveedor:           'TerraQuest',
      }));

      this.logger.log(`[TerraQuest] ${mapped.length} atracciones mapeadas correctamente`);
    } catch (err) {
      this.logger.error('[TerraQuest] Error al obtener atracciones — retornando lista vacía', err);
      mapped = [];
    }

    const total      = mapped.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage   = Math.min(page, totalPages);
    const items      = mapped.slice((safePage - 1) * limit, safePage * limit);

    return { items, total, page: safePage, limit, totalPages };
  }
}
