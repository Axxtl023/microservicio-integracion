export type ReservaHotelExternaStatus =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'ACTIVA'
  | 'COMPLETADA'
  | 'CANCELADA';

export interface ReservaHotelExternaDto {
  id: string;
  codigoReserva?: string;
  status: ReservaHotelExternaStatus;
  alojamientoId?: string;
  habitacionId?: string;
  clienteId?: string;
  fechaInicio?: string;
  fechaFin?: string;
}
