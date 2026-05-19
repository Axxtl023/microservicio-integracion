export interface CrearReservaExternaDto {
  vehiculoId: string;
  clienteId: string;
  agenciaId?: string;
  fechaInicio: string;
  fechaFin: string;
}
