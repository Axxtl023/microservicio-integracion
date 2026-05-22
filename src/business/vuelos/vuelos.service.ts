import { Injectable, Inject } from '@nestjs/common';
import type { IVuelosService, ListarVuelosParams } from './interfaces/i-vuelos.service';
import type { IVuelosClient } from '../../infrastructure/vuelos/i-vuelos.client';
import { IVUELOS_CLIENT } from '../../infrastructure/vuelos/i-vuelos.client';
import type { ISkybookClient } from '../../infrastructure/skybook/i-skybook.client';
import { ISKYBOOK_CLIENT } from '../../infrastructure/skybook/i-skybook.client';
import type { IAeroWillyClient } from '../../infrastructure/aerowilly/i-aerowilly.client';
import { IAEROWI_LLY_CLIENT } from '../../infrastructure/aerowilly/i-aerowilly.client';
import type { PaginatedVuelos } from '../../interfaces/vuelos.interface';

@Injectable()
export class VuelosService implements IVuelosService {
  constructor(
    @Inject(IVUELOS_CLIENT)    private readonly vuelosApp:  IVuelosClient,
    @Inject(ISKYBOOK_CLIENT)   private readonly skybook:    ISkybookClient,
    @Inject(IAEROWI_LLY_CLIENT) private readonly aeroWilly: IAeroWillyClient,
  ) {}

  async listar(params: ListarVuelosParams): Promise<PaginatedVuelos> {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.max(1, params.limit ?? 10);

    const [fromVuelosApp, fromSkyBook, fromAeroWilly] = await Promise.all([
      this.vuelosApp.getVuelos({})
        .then((items) => items.map((v) => ({ ...v, proveedor: 'VuelosApp' })))
        .catch(() => []),

      this.skybook.getVuelos()
        .then((items) => items.map((v) => ({
          ...v,
          // SkyBook no incluye estos campos — aplicamos defaults para la interfaz unificada
          status:        v.status        ?? 'SCHEDULED',
          duration:      v.duration      ?? 0,
          stops:         v.stops         ?? 0,
          flightClasses: v.flightClasses ?? [],
          proveedor:     'SkyBook',
        })))
        .catch(() => []),

      // AeroWilly client ya realiza el mapeo completo y aplica proveedor: 'AeroWilly'
      this.aeroWilly.getVuelos()
        .catch(() => []),
    ]);

    const all = [...fromVuelosApp, ...fromSkyBook, ...fromAeroWilly];

    const total      = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage   = Math.min(page, totalPages);
    const items      = all.slice((safePage - 1) * limit, safePage * limit);

    return { items, total, page: safePage, limit, totalPages };
  }
}
