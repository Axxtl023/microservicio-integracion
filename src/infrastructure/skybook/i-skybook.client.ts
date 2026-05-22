import type { Vuelo } from '../../interfaces/vuelos.interface';

export const ISKYBOOK_CLIENT = 'ISKYBOOK_CLIENT';

export interface ISkybookClient {
  getVuelos(): Promise<Vuelo[]>;
}
