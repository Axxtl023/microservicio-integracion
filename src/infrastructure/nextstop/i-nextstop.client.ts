import type { Atraccion } from '../../interfaces/atracciones.interface';
import type { IReservaExternaAtraccionClient } from '../../business/atracciones/i-reserva-externa-atraccion.client';

export const INEXTSTOP_CLIENT = 'INEXTSTOP_CLIENT';

export interface INextStopClient extends IReservaExternaAtraccionClient {
  getAtracciones(params: Record<string, unknown>): Promise<Atraccion[]>;
  getAtraccionBySlug(slug: string): Promise<Atraccion | null>;
}
