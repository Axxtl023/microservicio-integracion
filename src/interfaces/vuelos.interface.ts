// Tipos nativos de la API pública VuelosApp — solo para uso interno del microservicio.
// El frontend nunca ve estos tipos directamente; recibe siempre nuestro ApiResponse estándar.

export interface FlightAirline {
  id:         string;
  iataCode:   string;
  name:       string;
  logoUrl:    string | null;
  countryId?: string;
}

export interface FlightAirport {
  iataCode: string;
  name:     string | null;
  city:     string | null;
  country:  string | null;
}

export interface FlightSegment {
  id?:            string | null;
  aircraftModel?: string | null;
  tailNumber?:    string | null;
  hasWifi?:       boolean | null;
  hasUsb?:        boolean | null;
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
  id:                     string;
  flightNumber:           string;
  status?:                string | null;
  originAirportIata:      string;
  destinationAirportIata: string;
  departureDateTime:      string;
  arrivalDateTime:        string;
  duration?:              number;
  stops?:                 number;
  lowestPrice:            number;
  airline:                FlightAirline;
  flightClasses?:         FlightClass[];
  proveedor?:             string;
  originAirport?:         FlightAirport | null;
  destinationAirport?:    FlightAirport | null;
  segments?:              FlightSegment[] | null;
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
