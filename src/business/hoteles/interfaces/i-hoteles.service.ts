import type { Hotel, PaginatedHoteles } from '../../../interfaces/hoteles.interface';

export const IHOTELES_SERVICE = 'IHOTELES_SERVICE';

export interface ListarHotelesParams {
  page?:  number;
  limit?: number;
}

export interface IHotelesService {
  listar(params: ListarHotelesParams): Promise<PaginatedHoteles>;
  obtenerPorId(id: number, proveedor?: string): Promise<Hotel>;
}
