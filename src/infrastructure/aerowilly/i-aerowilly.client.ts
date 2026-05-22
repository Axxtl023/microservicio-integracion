import type { Vuelo } from '../../interfaces/vuelos.interface';

export const IAEROWI_LLY_CLIENT = 'IAEROWI_LLY_CLIENT';

export interface IAeroWillyClient {
  getVuelos(): Promise<Vuelo[]>;
}
