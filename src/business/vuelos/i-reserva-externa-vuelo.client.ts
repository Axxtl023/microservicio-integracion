import type { CrearReservaVueloExternaDto } from './dtos/crear-reserva-vuelo-externa.dto';
import type { ReservaVueloExternaDto } from './dtos/reserva-vuelo-externa.dto';

// Interfaz común para proveedores FLIGHT que soportan reservas.
// SkyBook es catálogo-solo y no implementa esta interfaz.
export interface IReservaExternaVueloClient {
  crearReservaVueloExterna(data: CrearReservaVueloExternaDto): Promise<ReservaVueloExternaDto>;
  confirmarReservaVueloExterna(id: string): Promise<ReservaVueloExternaDto>;
  cancelarReservaVueloExterna(id: string, reason?: string): Promise<ReservaVueloExternaDto>;
}
