import type { CrearReservaHotelDto } from './dtos/crear-reserva-hotel.dto';
import type { DisponibilidadHotelDto } from './dtos/disponibilidad-hotel.dto';
import type { ReservaHotelExternaDto } from './dtos/reserva-hotel-externa.dto';

// Interfaz común para todos los proveedores HOTEL de reserva externa.
export interface IReservaHotelClient {
  verificarDisponibilidadHotel(alojamientoId: string, habitacionId: string): Promise<DisponibilidadHotelDto>;
  crearReservaHotel(data: CrearReservaHotelDto): Promise<ReservaHotelExternaDto>;
  confirmarReservaHotel(id: string): Promise<ReservaHotelExternaDto>;
  cancelarReservaHotel(id: string, reason?: string): Promise<ReservaHotelExternaDto>;
}
