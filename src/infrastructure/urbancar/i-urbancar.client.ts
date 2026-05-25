import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';
import type { IReservaExternaClient } from '../../business/vehiculos/i-reserva-externa.client';

export const IURBANCAR_CLIENT = 'IURBANCAR_CLIENT';
export const URBANCAR_INVENTORY_HTTP = 'URBANCAR_INVENTORY_HTTP';
export const URBANCAR_OPERATIONS_HTTP = 'URBANCAR_OPERATIONS_HTTP';

export interface IUrbancarClient extends IReservaExternaClient {
  getVehiculos(params: Record<string, unknown>): Promise<Vehiculo[]>;
  getVehiculoById(id: string): Promise<Vehiculo>;
  getDisponibilidad(id: string): Promise<Disponibilidad>;
}
