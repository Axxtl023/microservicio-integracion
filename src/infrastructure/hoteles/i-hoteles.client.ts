import type { Hotel, Habitacion } from '../../interfaces/hoteles.interface';

import type { IReservaHotelClient } from '../../business/hoteles/i-reserva-hotel.client';

export const IHOTELES_CLIENT = 'IHOTELES_CLIENT';

export interface IHotelesClient extends IReservaHotelClient {
  getHoteles(): Promise<Hotel[]>;
  getHotelById(id: number): Promise<Hotel | null>;
  getHabitacionesPorAlojamiento(id: number): Promise<Habitacion[]>;
}
