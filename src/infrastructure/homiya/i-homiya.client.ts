import type { Hotel, Habitacion } from '../../interfaces/hoteles.interface';

import type { IReservaHotelClient } from '../../business/hoteles/i-reserva-hotel.client';

export const IHOMIYA_CLIENT = 'IHOMIYA_CLIENT';

export interface IHomiyaClient extends IReservaHotelClient {
  getHoteles(): Promise<Hotel[]>;
  getHotelById(id: number): Promise<Hotel | null>;
  getHabitacionesPorAlojamiento(id: number): Promise<Habitacion[]>;
}
