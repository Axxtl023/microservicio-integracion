import type { Atraccion, PaginatedAtracciones } from '../../../interfaces/atracciones.interface';

export const IATRACCIONES_SERVICE = 'IATRACCIONES_SERVICE';

export interface ListarAtraccionesParams {
  page?:  number;
  limit?: number;
}

export interface IAtraccionesService {
  listar(params: ListarAtraccionesParams): Promise<PaginatedAtracciones>;
  obtenerPorSlug(slug: string): Promise<Atraccion>;
}
