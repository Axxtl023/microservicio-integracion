import { Injectable, Inject } from '@nestjs/common';
import type { IVuelosService, ListarVuelosParams } from './interfaces/i-vuelos.service';
import type { IVuelosClient } from '../../infrastructure/vuelos/i-vuelos.client';
import { IVUELOS_CLIENT } from '../../infrastructure/vuelos/i-vuelos.client';
import type { PaginatedVuelos } from '../../interfaces/vuelos.interface';

@Injectable()
export class VuelosService implements IVuelosService {
  constructor(
    @Inject(IVUELOS_CLIENT) private readonly vuelosApp: IVuelosClient,
  ) {}

  async listar(params: ListarVuelosParams): Promise<PaginatedVuelos> {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.max(1, params.limit ?? 10);

    const all = await this.vuelosApp.getVuelos({})
      .then((items) => items.map((v) => ({ ...v, proveedor: 'VuelosApp' })))
      .catch(() => []);

    const total      = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage   = Math.min(page, totalPages);
    const items      = all.slice((safePage - 1) * limit, safePage * limit);

    return { items, total, page: safePage, limit, totalPages };
  }
}
