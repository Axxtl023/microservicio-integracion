import type { CrearReservaExternaDto } from './dtos/crear-reserva-externa.dto';
import type { DisponibilidadDto } from './dtos/disponibilidad.dto';
import type { ReservaExternaDto } from './dtos/reserva-externa.dto';

// Interfaz común para todos los proveedores VEHICLE de reserva externa.
// Cada provider client (urbancar, rentcar, rentwheels, drivex, zenith)
// la implementa traduciendo a su contrato REST particular.
export interface IReservaExternaClient {
  verificarDisponibilidadExterna(vehiculoId: string): Promise<DisponibilidadDto>;
  crearReservaExterna(data: CrearReservaExternaDto): Promise<ReservaExternaDto>;
  confirmarReservaExterna(id: string): Promise<ReservaExternaDto>;
  cancelarReservaExterna(id: string, reason?: string): Promise<ReservaExternaDto>;
}
