import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';
import type { IReservaExternaClient } from '../../business/vehiculos/i-reserva-externa.client';

export const IRENTCAR_CLIENT = 'IRENTCAR_CLIENT';

export interface IRentcarClient extends IReservaExternaClient {
  getVehiculos(params: Record<string, unknown>): Promise<Vehiculo[]>;
  getVehiculoById(id: string): Promise<Vehiculo>;
  getDisponibilidad(id: string): Promise<Disponibilidad>;
}
