export interface FlightPassengerDto {
  firstName: string;
  lastName: string;
  documentNumber: string;
  seatNumber?: string;
}

export interface CrearReservaVueloExternaDto {
  flightClassId: string;
  passengers: FlightPassengerDto[];
}
