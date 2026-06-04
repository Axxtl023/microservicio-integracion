import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';

import type { IAtraccionesService, ListarAtraccionesParams } from './interfaces/i-atracciones.service';
import type { IAtraccionesClient } from '../../infrastructure/atracciones/i-atracciones.client';
import { IATRACCIONES_CLIENT } from '../../infrastructure/atracciones/i-atracciones.client';
import type { IAtraccionCaTsClient } from '../../infrastructure/atraccioncats/i-atraccioncats.client';
import { IATRACCIONCATS_CLIENT } from '../../infrastructure/atraccioncats/i-atraccioncats.client';
import type { IVenturoClient } from '../../infrastructure/venturo/i-venturo.client';
import { IVENTURO_CLIENT } from '../../infrastructure/venturo/i-venturo.client';
import type { INextStopClient } from '../../infrastructure/nextstop/i-nextstop.client';
import { INEXTSTOP_CLIENT } from '../../infrastructure/nextstop/i-nextstop.client';
import type { Atraccion, PaginatedAtracciones } from '../../interfaces/atracciones.interface';

@Injectable()
export class AtraccionesService implements IAtraccionesService {
  private readonly logger = new Logger(AtraccionesService.name);

  constructor(
    @Inject(IATRACCIONES_CLIENT)    private readonly terraQuest:    IAtraccionesClient,
    @Inject(IATRACCIONCATS_CLIENT)  private readonly atraccionCaTs: IAtraccionCaTsClient,
    @Inject(IVENTURO_CLIENT)        private readonly venturo:        IVenturoClient,
    @Inject(INEXTSTOP_CLIENT)       private readonly nextStop:       INextStopClient,
  ) {}

  async listar(params: ListarAtraccionesParams): Promise<PaginatedAtracciones> {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.max(1, params.limit ?? 10);

    const [tqResult, catsResult, venturoResult, nextStopResult] = await Promise.allSettled([
      this.terraQuest.getAtracciones({ page: 1, pageSize: 1000 }),
      this.atraccionCaTs.getAtracciones({}),
      this.venturo.getAtracciones({}),
      this.nextStop.getAtracciones({}),
    ]);

    if (tqResult.status       === 'rejected') this.logger.error('[TerraQuest] Error al obtener atracciones',    tqResult.reason);
    if (catsResult.status     === 'rejected') this.logger.error('[AtraccionCaTs] Error al obtener atracciones', catsResult.reason);
    if (venturoResult.status  === 'rejected') this.logger.error('[Venturo] Error al obtener atracciones',       venturoResult.reason);
    if (nextStopResult.status === 'rejected') this.logger.error('[NextStop] Error al obtener atracciones',      nextStopResult.reason);

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

    const venturoItems: Atraccion[] = venturoResult.status === 'fulfilled'
      ? venturoResult.value.map((a: any) => ({
          id:                  a.id,
          slug:                a.slug               ?? '',
          name:                a.nombre             ?? a.name               ?? '',
          descriptionShort:    a.descripcion        ?? a.descriptionShort   ?? null,
          locationName:        a.ubicacion          ?? a.locationName        ?? null,
          locationCountryCode: a.locationCountryCode ?? null,
          categoryName:        a.categoryName        ?? null,
          subcategoryName:     a.subcategoryName     ?? null,
          ratingAverage:       a.ratingAverage       ?? null,
          ratingCount:         a.ratingCount         ?? null,
          difficultyLevel:     a.difficultyLevel     ?? null,
          mainImageUrl:        a.imagenUrl          ?? a.mainImageUrl        ?? null,
          startingPrice:       a.precio             ?? a.startingPrice       ?? 0,
          currencyCode:        a.moneda             ?? a.currencyCode        ?? 'USD',
          isActive:            a.disponible         ?? a.isActive            ?? true,
          isPublished:         a.isPublished         ?? true,
          modalityCount:       a.modalityCount       ?? null,
          proveedor:           'Venturo',
        }))
      : [];

    const nextStopItems: Atraccion[] = nextStopResult.status === 'fulfilled'
      ? nextStopResult.value.map((a) => ({
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
          proveedor:           'NextStop',
        }))
      : [];

    this.logger.log(
      `[TerraQuest] ${tqItems.length} | [AtraccionCaTs] ${catsItems.length} | [Venturo] ${venturoItems.length} | [NextStop] ${nextStopItems.length} atracciones`,
    );

    const all        = [...tqItems, ...catsItems, ...venturoItems, ...nextStopItems];
    const total      = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage   = Math.min(page, totalPages);
    const items      = all.slice((safePage - 1) * limit, safePage * limit);

    return { items, total, page: safePage, limit, totalPages };
  }

  async obtenerPorSlug(slug: string): Promise<Atraccion> {
    const [tqResult, catsResult, venturoResult, nextStopResult] = await Promise.allSettled([
      this.terraQuest.getAtraccionBySlug(slug),
      this.atraccionCaTs.getAtraccionBySlug(slug),
      this.venturo.getAtraccionBySlug(slug),
      this.nextStop.getAtraccionBySlug(slug),
    ]);

    const tqRaw       = tqResult.status       === 'fulfilled' ? tqResult.value       : null;
    const catsRaw     = catsResult.status     === 'fulfilled' ? catsResult.value     : null;
    const venturoRaw  = venturoResult.status  === 'fulfilled' ? venturoResult.value  : null;
    const nextStopRaw = nextStopResult.status === 'fulfilled' ? nextStopResult.value : null;

    if (tqRaw && tqRaw.id) {
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
        slots:               (tqRaw as any).slots      ?? [],
        startingPrice:       tqRaw.startingPrice       ?? 0,
        currencyCode:        tqRaw.currencyCode        ?? 'USD',
        isActive:            tqRaw.isActive            ?? true,
        isPublished:         tqRaw.isPublished         ?? true,
        modalityCount:       tqRaw.modalityCount       ?? null,
        proveedor:           'TerraQuest',
      };
    }

    if (catsRaw && catsRaw.id) {
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
        slots:            (catsRaw as any).slots   ?? [],
        startingPrice:    catsRaw.startingPrice    ?? 0,
        currencyCode:     catsRaw.currencyCode     ?? 'USD',
        isActive:         catsRaw.isActive         ?? true,
        isPublished:      catsRaw.isPublished      ?? true,
        modalityCount:    catsRaw.modalityCount    ?? null,
        proveedor:        'AtraccionCaTs',
      };
    }

    if (venturoRaw && venturoRaw.id) {
      const vr = venturoRaw as any;
      return {
        id:                  vr.id,
        slug:                vr.slug               ?? '',
        name:                vr.nombre             ?? vr.name               ?? '',
        descriptionShort:    vr.descripcion        ?? vr.descriptionShort   ?? null,
        descriptionFull:     vr.descripcion        ?? vr.descriptionFull    ?? null,
        locationName:        vr.ubicacion          ?? vr.locationName        ?? null,
        locationCountryCode: vr.locationCountryCode ?? null,
        categoryName:        vr.categoryName        ?? null,
        ratingAverage:       vr.ratingAverage       ?? null,
        ratingCount:         vr.ratingCount         ?? null,
        mainImageUrl:        vr.imagenUrl          ?? vr.mainImageUrl        ?? null,
        gallery:             vr.gallery             ?? [],
        products:            vr.products            ?? [],
        slots:               vr.slots               ?? [],
        startingPrice:       vr.precio             ?? vr.startingPrice       ?? 0,
        currencyCode:        vr.moneda             ?? vr.currencyCode        ?? 'USD',
        isActive:            vr.disponible         ?? vr.isActive            ?? true,
        isPublished:         vr.isPublished         ?? true,
        modalityCount:       vr.modalityCount       ?? null,
        proveedor:           'Venturo',
      };
    }

    if (nextStopRaw && nextStopRaw.id) {
      return {
        id:                  nextStopRaw.id,
        slug:                nextStopRaw.slug               ?? '',
        name:                nextStopRaw.name               ?? '',
        descriptionShort:    nextStopRaw.descriptionShort   ?? null,
        descriptionFull:     nextStopRaw.descriptionFull    ?? null,
        locationName:        nextStopRaw.locationName        ?? null,
        locationCountryCode: nextStopRaw.locationCountryCode ?? null,
        categoryName:        nextStopRaw.categoryName        ?? null,
        ratingAverage:       nextStopRaw.ratingAverage       ?? null,
        ratingCount:         nextStopRaw.ratingCount         ?? null,
        mainImageUrl:        nextStopRaw.mainImageUrl        ?? null,
        gallery:             nextStopRaw.gallery             ?? [],
        products:            nextStopRaw.products            ?? [],
        slots:               (nextStopRaw as any).slots     ?? [],
        startingPrice:       nextStopRaw.startingPrice       ?? 0,
        currencyCode:        nextStopRaw.currencyCode        ?? 'USD',
        isActive:            nextStopRaw.isActive            ?? true,
        isPublished:         nextStopRaw.isPublished         ?? true,
        modalityCount:       nextStopRaw.modalityCount       ?? null,
        proveedor:           'NextStop',
      };
    }

    throw new NotFoundException(`Atracción con slug "${slug}" no encontrada en ningún proveedor`);
  }
}
