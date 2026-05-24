import type { Habitacion } from '../../interfaces/hoteles.interface';

export const IHOUSING_PLACE_CLIENT = 'IHOUSING_PLACE_CLIENT';

export interface IHousingPlaceClient {
  getAlojamientos(): Promise<Record<string, unknown>[]>;
  getAlojamientoById(id: number): Promise<Record<string, unknown> | null>;
  getHabitacionesPorAlojamiento(id: number): Promise<Habitacion[]>;
}
