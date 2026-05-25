import type { Vuelo } from '../../interfaces/vuelos.interface';
import type { IReservaExternaVueloClient } from '../../business/vuelos/i-reserva-externa-vuelo.client';

export const IAEROWI_LLY_CLIENT = 'IAEROWI_LLY_CLIENT';

export interface IAeroWillyClient extends IReservaExternaVueloClient {
  getVuelos(): Promise<Vuelo[]>;
}
