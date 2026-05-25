import type { CrearReservaAtraccionExternaDto } from './dtos/crear-reserva-atraccion-externa.dto';
import type { ReservaAtraccionExternaDto } from './dtos/reserva-atraccion-externa.dto';

export interface IReservaExternaAtraccionClient {
  crearReservaAtraccionExterna(data: CrearReservaAtraccionExternaDto): Promise<ReservaAtraccionExternaDto>;
  confirmarReservaAtraccionExterna(id: string): Promise<ReservaAtraccionExternaDto>;
  cancelarReservaAtraccionExterna(id: string, reason?: string): Promise<ReservaAtraccionExternaDto>;
}
