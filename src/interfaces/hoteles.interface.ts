// Tipos del proveedor Locus (israel-apigateway) — uso interno del microservicio.

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
  proveedor?:          string;
}

export interface PaginatedHoteles {
  items:      Hotel[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}
