import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';
import type { IReservaExternaClient } from '../../business/vehiculos/i-reserva-externa.client';

export const IRENTWHEELS_CLIENT = 'IRENTWHEELS_CLIENT';

export interface IRentWheelsClient extends IReservaExternaClient {
  getVehiculos(params: Record<string, unknown>): Promise<Vehiculo[]>;
  getVehiculoById(id: string): Promise<Vehiculo>;
  getDisponibilidad(id: string): Promise<Disponibilidad>;
}
