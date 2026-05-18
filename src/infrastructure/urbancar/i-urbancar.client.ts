import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';

export const IURBANCAR_CLIENT = 'IURBANCAR_CLIENT';

export interface IUrbancarClient {
  getVehiculos(params: Record<string, unknown>): Promise<Vehiculo[]>;
  getVehiculoById(id: string): Promise<Vehiculo>;
  getDisponibilidad(id: string): Promise<Disponibilidad>;
}
