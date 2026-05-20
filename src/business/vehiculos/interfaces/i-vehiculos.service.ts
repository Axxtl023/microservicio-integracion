import type { Vehiculo, PaginatedVehiculos, Disponibilidad } from '../../../interfaces/urbancar.interface';

export const IVEHICULOS_SERVICE = 'IVEHICULOS_SERVICE';

export interface ListarVehiculosParams {
  agenciaId?:   string;
  categoriaId?: string;
  status?:      string;
  page?:        number;
  limit?:       number;
}

export interface IVehiculosService {
  listar(params: ListarVehiculosParams): Promise<PaginatedVehiculos>;
  obtenerPorId(id: string): Promise<Vehiculo>;
  obtenerDisponibilidad(id: string): Promise<Disponibilidad>;
}
