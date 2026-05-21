import type { Atraccion } from '../../interfaces/atracciones.interface';

export const IATRACCIONES_CLIENT = 'IATRACCIONES_CLIENT';

export interface IAtraccionesClient {
  getAtracciones(params: Record<string, unknown>): Promise<Atraccion[]>;
}
