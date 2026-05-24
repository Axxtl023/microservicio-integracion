import { Injectable, Inject } from '@nestjs/common';
import type { IVuelosService, ListarVuelosParams } from './interfaces/i-vuelos.service';
import type { IVuelosClient } from '../../infrastructure/vuelos/i-vuelos.client';
import { IVUELOS_CLIENT } from '../../infrastructure/vuelos/i-vuelos.client';
import type { ISkybookClient } from '../../infrastructure/skybook/i-skybook.client';
import { ISKYBOOK_CLIENT } from '../../infrastructure/skybook/i-skybook.client';
import type { IAeroWillyClient } from '../../infrastructure/aerowilly/i-aerowilly.client';
import { IAEROWI_LLY_CLIENT } from '../../infrastructure/aerowilly/i-aerowilly.client';
import type { IAeroCoreClient } from '../../infrastructure/aerocore/i-aerocore.client';
import { IAEROCORE_CLIENT } from '../../infrastructure/aerocore/i-aerocore.client';
import type { Vuelo, PaginatedVuelos, FlightClass } from '../../interfaces/vuelos.interface';

@Injectable()
export class VuelosService implements IVuelosService {
  constructor(
    @Inject(IVUELOS_CLIENT)     private readonly vuelosApp:  IVuelosClient,
    @Inject(ISKYBOOK_CLIENT)    private readonly skybook:    ISkybookClient,
    @Inject(IAEROWI_LLY_CLIENT) private readonly aeroWilly: IAeroWillyClient,
    @Inject(IAEROCORE_CLIENT)   private readonly aerocore:  IAeroCoreClient,
  ) {}

  private mapAeroCore(raw: Record<string, unknown>): Vuelo {
    const airlineObj = raw.airline as { id?: string; iataCode?: string; name?: string; logoUrl?: string | null } | null;
    const airlineName = String(airlineObj?.name ?? raw.aerolinea ?? 'AeroCore');
    const flightId    = String(raw.id ?? '');

    const flightClasses: FlightClass[] = Array.isArray(raw.flightClasses)
      ? (raw.flightClasses as Record<string, unknown>[]).map((fc) => ({
          id:             String(fc.id ?? ''),
          flightId,
          cabinClass:     String(fc.cabinClass ?? ''),
          availableSeats: Number(fc.availableSeats ?? 0),
          basePrice:      Number(fc.basePrice ?? 0),
          classType:      String(fc.cabinClass ?? ''),
        }))
      : [];

    return {
      id:                     flightId,
      flightNumber:           String(raw.flightNumber ?? 'N/A'),
      status:                 (raw.status as string | null) ?? 'SCHEDULED',
      originAirportIata:      String(raw.originAirportIata ?? raw.origin ?? ''),
      destinationAirportIata: String(raw.destinationAirportIata ?? raw.destination ?? ''),
      departureDateTime:      String(raw.departureDateTime ?? raw.departureDate ?? ''),
      arrivalDateTime:        String(raw.arrivalDateTime ?? ''),
      duration:               Number(raw.duration ?? 0),
      stops:                  Number(raw.stops ?? 0),
      lowestPrice:            Number(raw.lowestPrice || raw.precio || 0),
      airline: {
        id:       String(airlineObj?.id ?? ''),
        iataCode: String(airlineObj?.iataCode ?? ''),
        name:     airlineName,
        logoUrl:  (airlineObj?.logoUrl ?? null) as string | null,
      },
      aircraft:      (raw.aircraft as string | null) ?? null,
      flightClasses,
      proveedor:     'AeroCore',
    };
  }

  async listar(params: ListarVuelosParams): Promise<PaginatedVuelos> {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.max(1, params.limit ?? 10);

    const [fromVuelosApp, fromSkyBook, fromAeroWilly, fromAeroCore] = await Promise.allSettled([
      this.vuelosApp.getVuelos({})
        .then((items) => items.map((v) => ({ ...v, proveedor: 'VuelosApp' }))),

      this.skybook.getVuelos()
        .then((items) => items.map((v) => ({
          ...v,
          status:        v.status        ?? 'SCHEDULED',
          duration:      v.duration      ?? 0,
          stops:         v.stops         ?? 0,
          flightClasses: v.flightClasses ?? [],
          proveedor:     'SkyBook',
        }))),

      // AeroWilly realiza el mapeo completo internamente y aplica proveedor: 'AeroWilly'
      this.aeroWilly.getVuelos(),

      this.aerocore.getVuelos({})
        .then((items) => items.map((raw) => this.mapAeroCore(raw))),
    ]);

    const all = [
      ...(fromVuelosApp.status  === 'fulfilled' ? fromVuelosApp.value  : []),
      ...(fromSkyBook.status    === 'fulfilled' ? fromSkyBook.value    : []),
      ...(fromAeroWilly.status  === 'fulfilled' ? fromAeroWilly.value  : []),
      ...(fromAeroCore.status   === 'fulfilled' ? fromAeroCore.value   : []),
    ];

    const total      = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage   = Math.min(page, totalPages);
    const items      = all.slice((safePage - 1) * limit, safePage * limit);

    return { items, total, page: safePage, limit, totalPages };
  }

  async obtenerPorId(id: string): Promise<Vuelo | null> {
    const raw = await this.aerocore.getVueloById(id);
    if (!raw) return null;
    return this.mapAeroCore(raw);
  }
}
