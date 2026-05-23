import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';

export const IDRIVEX_CLIENT = 'IDRIVEX_CLIENT';

export interface IDriveXClient {
  getVehiculos(params: Record<string, unknown>): Promise<Vehiculo[]>;
  getVehiculoById(id: string): Promise<Vehiculo>;
  getDisponibilidad(id: string): Promise<Disponibilidad>;
}
