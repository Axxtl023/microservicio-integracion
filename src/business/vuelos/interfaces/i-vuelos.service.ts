import type { Vuelo, PaginatedVuelos } from '../../../interfaces/vuelos.interface';

export const IVUELOS_SERVICE = 'IVUELOS_SERVICE';

export interface ListarVuelosParams {
  page?:  number;
  limit?: number;
}

export interface IVuelosService {
  listar(params: ListarVuelosParams): Promise<PaginatedVuelos>;
  obtenerPorId(id: string): Promise<Vuelo | null>;
}
