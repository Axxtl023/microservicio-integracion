export interface CrearReservaHotelDto {
  alojamientoId: string;
  habitacionId: string;
  clienteId: string;
  fechaInicio: string; // ISO 8601
  fechaFin: string;    // ISO 8601
}
