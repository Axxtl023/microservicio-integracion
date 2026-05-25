import type { Vuelo } from '../../interfaces/vuelos.interface';
import type { IReservaExternaVueloClient } from '../../business/vuelos/i-reserva-externa-vuelo.client';

export const IVUELOS_CLIENT = 'IVUELOS_CLIENT';

export interface IVuelosClient extends IReservaExternaVueloClient {
  getVuelos(params: Record<string, unknown>): Promise<Vuelo[]>;
}
