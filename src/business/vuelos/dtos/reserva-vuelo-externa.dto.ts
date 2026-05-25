export interface ReservaVueloExternaDto {
  id: string;
  reservationCode?: string;
  status: string; // PENDING | CONFIRMED | CANCELLED | COMPLETED
  flightId?: string;
}
