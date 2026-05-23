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

export interface Hotel {
  alojamientoId:       number;
  nombre:              string;
  ciudad:              string;
  direccion:           string;
  descripcion:         string | null;
  estrellas:           number | null;
  calificacionPromedio: number;
  admiteMascotas:      boolean;
  tienePiscina:        boolean;
  tieneParqueadero:    boolean;
  // Campos adicionales — Rodrigo's
  precioBase?:         number;
  telefono?:           string;
  habitaciones?:       Habitacion[];
  proveedor?:          string;
}

export interface PaginatedHoteles {
  items:      Hotel[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}
