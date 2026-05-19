import type { Vehiculo } from '../../../interfaces/urbancar.interface';
import type { CrearReservaExternaDto } from '../../../infrastructure/urbancar/dtos/crear-reserva-externa.dto';
import type { DisponibilidadDto } from '../../../infrastructure/urbancar/dtos/disponibilidad.dto';
import type { ReservaExternaDto } from '../../../infrastructure/urbancar/dtos/reserva-externa.dto';

export const IVEHICULOS_SERVICE = 'IVEHICULOS_SERVICE';

export interface ListarVehiculosParams {
  agenciaId?:   string;
  categoriaId?: string;
  status?:      string;
  page?:        number;
  limit?:       number;
}

export interface IVehiculosService {
  listar(params: ListarVehiculosParams): Promise<Vehiculo[]>;
  obtenerPorId(id: string): Promise<Vehiculo>;
  obtenerDisponibilidad(id: string): Promise<DisponibilidadDto>;
  verificarDisponibilidadExterna(vehiculoId: string): Promise<DisponibilidadDto>;
  crearReservaExterna(data: CrearReservaExternaDto): Promise<ReservaExternaDto>;
  confirmarReservaExterna(id: string): Promise<ReservaExternaDto>;
  cancelarReservaExterna(id: string, reason?: string): Promise<ReservaExternaDto>;
}
