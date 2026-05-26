export interface DisponibilidadHotelDto {
  alojamientoId: string;
  habitacionId: string;
  disponible: boolean;
  status: string | null;
  mensaje: string | null;
}
