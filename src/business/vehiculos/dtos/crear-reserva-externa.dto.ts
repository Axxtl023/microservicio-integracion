export interface CrearReservaExternaDto {
  vehiculoId: string;
  clienteId: string;
  agenciaId?: string;
  fechaInicio: string; // ISO 8601
  fechaFin: string;    // ISO 8601
}
