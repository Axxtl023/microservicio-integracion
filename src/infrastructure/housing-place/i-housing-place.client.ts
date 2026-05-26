import type { Habitacion } from '../../interfaces/hoteles.interface';

import type { IReservaHotelClient } from '../../business/hoteles/i-reserva-hotel.client';

export const IHOUSING_PLACE_CLIENT = 'IHOUSING_PLACE_CLIENT';

export interface IHousingPlaceClient extends IReservaHotelClient {
  getAlojamientos(): Promise<Record<string, unknown>[]>;
  getAlojamientoById(id: number): Promise<Record<string, unknown> | null>;
  getHabitacionesPorAlojamiento(id: number): Promise<Habitacion[]>;
}
