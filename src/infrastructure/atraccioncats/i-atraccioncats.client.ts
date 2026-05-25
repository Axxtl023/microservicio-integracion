import type { Atraccion } from '../../interfaces/atracciones.interface';
import type { IReservaExternaAtraccionClient } from '../../business/atracciones/i-reserva-externa-atraccion.client';

export const IATRACCIONCATS_CLIENT = 'IATRACCIONCATS_CLIENT';

export interface IAtraccionCaTsClient extends IReservaExternaAtraccionClient {
  getAtracciones(params: Record<string, unknown>): Promise<Atraccion[]>;
  getAtraccionBySlug(slug: string): Promise<Atraccion | null>;
}
