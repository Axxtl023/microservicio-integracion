import type { Atraccion } from '../../interfaces/atracciones.interface';

export const IVENTURO_CLIENT = 'IVENTURO_CLIENT';

export interface IVenturoClient {
  getAtracciones(params: Record<string, unknown>): Promise<Atraccion[]>;
  getAtraccionBySlug(slug: string): Promise<Atraccion | null>;
}
