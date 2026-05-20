// Tipos nativos de la API pública VuelosApp — solo para uso interno del microservicio.
// El frontend nunca ve estos tipos directamente; recibe siempre nuestro ApiResponse estándar.

export interface FlightAirline {
  id:        string;
  iataCode:  string;
  name:      string;
  logoUrl:   string | null;
  countryId: string;
}

export interface FlightClass {
  id:             string;
  flightId:       string;
  cabinClass:     string;
  availableSeats: number;
  basePrice:      number;
  classType:      string;
}

export interface Vuelo {
  id:                    string;
  flightNumber:          string;
  status:                string;
  originAirportIata:     string;
  destinationAirportIata: string;
  departureDateTime:     string;
  arrivalDateTime:       string;
  duration:              number;
  stops:                 number;
  lowestPrice:           number;
  airline:               FlightAirline;
  flightClasses:         FlightClass[];
  proveedor?:            string;
}

export interface VuelosApiResponse {
  success: boolean;
  data:    Vuelo[] | null;
}

export interface PaginatedVuelos {
  items:      Vuelo[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}
