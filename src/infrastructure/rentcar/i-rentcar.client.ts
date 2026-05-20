import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';

export const IRENTCAR_CLIENT = 'IRENTCAR_CLIENT';

export interface IRentcarClient {
  getVehiculos(params: Record<string, unknown>): Promise<Vehiculo[]>;
  getVehiculoById(id: string): Promise<Vehiculo>;
  getDisponibilidad(id: string): Promise<Disponibilidad>;
}
