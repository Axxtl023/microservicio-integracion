import type { Hotel, Habitacion } from '../../interfaces/hoteles.interface';

export const IHOTELES_CLIENT = 'IHOTELES_CLIENT';

export interface IHotelesClient {
  getHoteles(): Promise<Hotel[]>;
  getHotelById(id: number): Promise<Hotel | null>;
  getHabitacionesPorAlojamiento(id: number): Promise<Habitacion[]>;
}
