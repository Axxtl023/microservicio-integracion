export interface ReservaAtraccionExternaDto {
  id: string;
  reservationCode?: string;
  status: string; // PENDING | CONFIRMED | CANCELLED
}
