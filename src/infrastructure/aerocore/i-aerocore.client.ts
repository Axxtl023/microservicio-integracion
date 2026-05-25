import type { IReservaExternaVueloClient } from '../../business/vuelos/i-reserva-externa-vuelo.client';

export const IAEROCORE_CLIENT = 'IAEROCORE_CLIENT';

export interface IAeroCoreClient extends IReservaExternaVueloClient {
  getVuelos(query: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  getVueloById(id: string): Promise<Record<string, unknown> | null>;
}
