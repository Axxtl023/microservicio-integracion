import type { Vehiculo } from '../../interfaces/urbancar.interface';
import type { CrearReservaExternaDto } from './dtos/crear-reserva-externa.dto';
import type { DisponibilidadDto } from './dtos/disponibilidad.dto';
import type { ReservaExternaDto } from './dtos/reserva-externa.dto';

export const IURBANCAR_CLIENT = 'IURBANCAR_CLIENT';
export const URBANCAR_INVENTORY_HTTP = 'URBANCAR_INVENTORY_HTTP';
export const URBANCAR_OPERATIONS_HTTP = 'URBANCAR_OPERATIONS_HTTP';

export interface IUrbancarClient {
  getVehiculos(params: Record<string, unknown>): Promise<Vehiculo[]>;
  getVehiculoById(id: string): Promise<Vehiculo>;
  getDisponibilidad(id: string): Promise<DisponibilidadDto>;
  verificarDisponibilidadExterna(vehiculoId: string): Promise<DisponibilidadDto>;
  crearReservaExterna(data: CrearReservaExternaDto): Promise<ReservaExternaDto>;
  confirmarReservaExterna(id: string): Promise<ReservaExternaDto>;
  cancelarReservaExterna(id: string, reason?: string): Promise<ReservaExternaDto>;
}
