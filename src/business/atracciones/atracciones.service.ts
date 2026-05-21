import { Injectable, Inject } from '@nestjs/common';
import type { IAtraccionesService, ListarAtraccionesParams } from './interfaces/i-atracciones.service';
import type { IAtraccionesClient } from '../../infrastructure/atracciones/i-atracciones.client';
import { IATRACCIONES_CLIENT } from '../../infrastructure/atracciones/i-atracciones.client';
import type { PaginatedAtracciones } from '../../interfaces/atracciones.interface';

@Injectable()
export class AtraccionesService implements IAtraccionesService {
  constructor(
    @Inject(IATRACCIONES_CLIENT) private readonly terraQuest: IAtraccionesClient,
  ) {}

  async listar(params: ListarAtraccionesParams): Promise<PaginatedAtracciones> {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.max(1, params.limit ?? 10);

    const all = await this.terraQuest.getAtracciones({})
      .then((items) => items.map((a) => ({ ...a, proveedor: 'TerraQuest' })))
      .catch(() => []);

    const total      = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage   = Math.min(page, totalPages);
    const items      = all.slice((safePage - 1) * limit, safePage * limit);

    return { items, total, page: safePage, limit, totalPages };
  }
}
