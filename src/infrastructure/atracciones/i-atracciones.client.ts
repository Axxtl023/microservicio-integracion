import type { Atraccion } from '../../interfaces/atracciones.interface';
import type { IReservaExternaAtraccionClient } from '../../business/atracciones/i-reserva-externa-atraccion.client';

export const IATRACCIONES_CLIENT = 'IATRACCIONES_CLIENT';

export interface IAtraccionesClient extends IReservaExternaAtraccionClient {
  getAtracciones(params: Record<string, unknown>): Promise<Atraccion[]>;
  getAtraccionBySlug(slug: string): Promise<Atraccion | null>;
}
