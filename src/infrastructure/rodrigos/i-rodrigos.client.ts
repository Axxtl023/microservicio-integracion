import type { Hotel, Habitacion } from '../../interfaces/hoteles.interface';

export const IRODRIGOS_CLIENT = 'IRODRIGOS_CLIENT';

export interface IRodrigosClient {
  getHoteles(): Promise<Hotel[]>;
  getHotelById(id: number): Promise<Hotel | null>;
  getHabitacionesPorAlojamiento(id: number): Promise<Habitacion[]>;
}
