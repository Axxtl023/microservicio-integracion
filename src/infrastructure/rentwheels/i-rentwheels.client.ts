import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';

export const IRENTWHEELS_CLIENT = 'IRENTWHEELS_CLIENT';

export interface IRentWheelsClient {
  getVehiculos(params: Record<string, unknown>): Promise<Vehiculo[]>;
  getVehiculoById(id: string): Promise<Vehiculo>;
  getDisponibilidad(id: string): Promise<Disponibilidad>;
}
