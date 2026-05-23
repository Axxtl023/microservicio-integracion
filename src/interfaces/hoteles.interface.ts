// Tipos del proveedor Locus (israel-apigateway) — uso interno del microservicio.

export interface Habitacion {
  habitacionId:     number;
  alojamientoId:    number;
  nombre:           string;
  descripcion:      string | null;
  capacidadAdultos: number;
  capacidadNinos:   number;
  precioNoche:      number;
}

// Contrato unificado que el microservicio despacha al frontend — independiente del proveedor.
export interface HabitacionUnificada {
  id:             string;
  nombre:         string;
  precioNoche:    number;
  capacidadTotal: number;
  disponible:     boolean;
}

export interface Hotel {
  alojamientoId:        number;
  nombre:               string;
  ciudad:               string;
  direccion:            string;
  descripcion:          string | null;
  estrellas:            number | null;
  calificacionPromedio: number;
  admiteMascotas:       boolean;
  tienePiscina:         boolean;
  tieneParqueadero:     boolean;
  // Campos adicionales
  precioBase?:          number;
  telefono?:            string;
  habitaciones?:        HabitacionUnificada[];
  proveedor?:           string;
}

export interface PaginatedHoteles {
  items:      Hotel[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}
