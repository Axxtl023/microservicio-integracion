import type { Vuelo } from '../../interfaces/vuelos.interface';
import type { IReservaExternaVueloClient } from '../../business/vuelos/i-reserva-externa-vuelo.client';

export const ISKYBOOK_CLIENT = 'ISKYBOOK_CLIENT';

export interface ISkybookClient extends IReservaExternaVueloClient {
  getVuelos(): Promise<Vuelo[]>;
}
