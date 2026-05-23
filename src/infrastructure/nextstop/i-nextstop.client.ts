import type { Atraccion } from '../../interfaces/atracciones.interface';

export const INEXTSTOP_CLIENT = 'INEXTSTOP_CLIENT';

export interface INextStopClient {
  getAtracciones(params: Record<string, unknown>): Promise<Atraccion[]>;
  getAtraccionBySlug(slug: string): Promise<Atraccion | null>;
}
