import type { Vuelo } from '../../interfaces/vuelos.interface';

export const IVUELOS_CLIENT = 'IVUELOS_CLIENT';

export interface IVuelosClient {
  getVuelos(params: Record<string, unknown>): Promise<Vuelo[]>;
}
