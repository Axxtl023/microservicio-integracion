import type { Atraccion } from '../../interfaces/atracciones.interface';

export const IATRACCIONCATS_CLIENT = 'IATRACCIONCATS_CLIENT';

export interface IAtraccionCaTsClient {
  getAtracciones(params: Record<string, unknown>): Promise<Atraccion[]>;
  getAtraccionBySlug(slug: string): Promise<Atraccion | null>;
}
