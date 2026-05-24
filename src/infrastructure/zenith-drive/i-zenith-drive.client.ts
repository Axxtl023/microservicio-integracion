import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';

export const IZENITH_DRIVE_CLIENT = 'IZENITH_DRIVE_CLIENT';

export interface IZenithDriveClient {
  getVehiculos(params: Record<string, unknown>): Promise<Vehiculo[]>;
  getVehiculoById(id: string): Promise<Vehiculo>;
  getDisponibilidad(id: string): Promise<Disponibilidad>;
}
