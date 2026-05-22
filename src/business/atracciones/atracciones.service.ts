import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';

import type { IAtraccionesService, ListarAtraccionesParams } from './interfaces/i-atracciones.service';
import type { IAtraccionesClient } from '../../infrastructure/atracciones/i-atracciones.client';
import { IATRACCIONES_CLIENT } from '../../infrastructure/atracciones/i-atracciones.client';
import type { IAtraccionCaTsClient } from '../../infrastructure/atraccioncats/i-atraccioncats.client';
import { IATRACCIONCATS_CLIENT } from '../../infrastructure/atraccioncats/i-atraccioncats.client';
import type { Atraccion, PaginatedAtracciones } from '../../interfaces/atracciones.interface';

@Injectable()
export class AtraccionesService implements IAtraccionesService {
  private readonly logger = new Logger(AtraccionesService.name);

  constructor(
    @Inject(IATRACCIONES_CLIENT)    private readonly terraQuest:    IAtraccionesClient,
    @Inject(IATRACCIONCATS_CLIENT)  private readonly atraccionCaTs: IAtraccionCaTsClient,
  ) {}

  async listar(params: ListarAtraccionesParams): Promise<PaginatedAtracciones> {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.max(1, params.limit ?? 10);

    const [tqResult, catsResult] = await Promise.allSettled([
      this.terraQuest.getAtracciones({ page: 1, pageSize: 1000 }),
      this.atraccionCaTs.getAtracciones({}),
    ]);

    if (tqResult.status   === 'rejected') this.logger.error('[TerraQuest] Error al obtener atracciones', tqResult.reason);
    if (catsResult.status === 'rejected') this.logger.error('[AtraccionCaTs] Error al obtener atracciones', catsResult.reason);

    const tqItems: Atraccion[] = tqResult.status === 'fulfilled'
      ? tqResult.value.map((a) => ({
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
        }))
      : [];

    const catsItems: Atraccion[] = catsResult.status === 'fulfilled'
      ? catsResult.value.map((a) => ({
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
          proveedor:           'AtraccionCaTs',
        }))
      : [];

    this.logger.log(`[TerraQuest] ${tqItems.length} | [AtraccionCaTs] ${catsItems.length} atracciones`);

    const all        = [...tqItems, ...catsItems];
    const total      = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage   = Math.min(page, totalPages);
    const items      = all.slice((safePage - 1) * limit, safePage * limit);

    return { items, total, page: safePage, limit, totalPages };
  }

  async obtenerPorSlug(slug: string): Promise<Atraccion> {
    const [tqResult, catsResult] = await Promise.allSettled([
      this.terraQuest.getAtraccionBySlug(slug),
      this.atraccionCaTs.getAtraccionBySlug(slug),
    ]);

    const tqRaw   = tqResult.status   === 'fulfilled' ? tqResult.value   : null;
    const catsRaw = catsResult.status === 'fulfilled' ? catsResult.value : null;

    if (tqRaw) {
      return {
        id:                  tqRaw.id,
        slug:                tqRaw.slug               ?? '',
        name:                tqRaw.name               ?? '',
        descriptionShort:    tqRaw.descriptionShort   ?? null,
        descriptionFull:     tqRaw.descriptionFull    ?? null,
        locationName:        tqRaw.locationName        ?? null,
        locationCountryCode: tqRaw.locationCountryCode ?? null,
        categoryName:        tqRaw.categoryName        ?? null,
        subcategoryName:     tqRaw.subcategoryName     ?? null,
        ratingAverage:       tqRaw.ratingAverage       ?? null,
        ratingCount:         tqRaw.ratingCount         ?? null,
        difficultyLevel:     tqRaw.difficultyLevel     ?? null,
        mainImageUrl:        tqRaw.mainImageUrl        ?? null,
        address:             tqRaw.address             ?? null,
        meetingPoint:        tqRaw.meetingPoint        ?? null,
        gallery:             tqRaw.gallery             ?? [],
        products:            tqRaw.products            ?? [],
        startingPrice:       tqRaw.startingPrice       ?? 0,
        currencyCode:        tqRaw.currencyCode        ?? 'USD',
        isActive:            tqRaw.isActive            ?? true,
        isPublished:         tqRaw.isPublished         ?? true,
        modalityCount:       tqRaw.modalityCount       ?? null,
        proveedor:           'TerraQuest',
      };
    }

    if (catsRaw) {
      return {
        id:               catsRaw.id,
        slug:             catsRaw.slug             ?? '',
        name:             catsRaw.name             ?? '',
        descriptionShort: catsRaw.descriptionShort ?? null,
        descriptionFull:  catsRaw.descriptionFull  ?? null,
        locationName:     catsRaw.locationName     ?? null,
        mainImageUrl:     catsRaw.mainImageUrl     ?? null,
        gallery:          catsRaw.gallery          ?? [],
        products:         catsRaw.products         ?? [],
        startingPrice:    catsRaw.startingPrice    ?? 0,
        currencyCode:     catsRaw.currencyCode     ?? 'USD',
        isActive:         catsRaw.isActive         ?? true,
        isPublished:      catsRaw.isPublished      ?? true,
        modalityCount:    catsRaw.modalityCount    ?? null,
        proveedor:        'AtraccionCaTs',
      };
    }

    throw new NotFoundException(`Atracción con slug "${slug}" no encontrada en ningún proveedor`);
  }
}
