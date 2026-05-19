export type ReservaExternaStatus =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'ACTIVA'
  | 'COMPLETADA'
  | 'CANCELADA';

export interface ReservaExternaDto {
  id: string;
  codigoReserva?: string;
  status: ReservaExternaStatus;
  vehiculoId?: string;
  clienteId?: string;
  agenciaId?: string | null;
  fechaInicio?: string;
  fechaFin?: string;
}
