import type { IReservaHotelClient } from '../../business/hoteles/i-reserva-hotel.client';

export const IALOJAEXPRESS_CLIENT = 'IALOJAEXPRESS_CLIENT';

export interface IAlojaExpressClient extends IReservaHotelClient {
  getAlojamientos(): Promise<Record<string, unknown>[]>;
  getAlojamientoById(id: string | number): Promise<Record<string, unknown> | null>;
  getHabitacionesPorAlojamiento(id: string | number): Promise<Record<string, unknown>[]>;
}
