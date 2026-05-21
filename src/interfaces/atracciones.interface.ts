// Tipos nativos de la API pública TerraQuest — solo para uso interno del microservicio.
// El frontend nunca ve estos tipos directamente; recibe siempre nuestro ApiResponse estándar.

export interface Atraccion {
  id:          string;
  nombre:      string;
  descripcion: string | null;
  precio:      number;
  moneda:      string;
  ubicacion:   string | null;
  imagenUrl:   string | null;
  disponible:  boolean;
  slug:        string;
  proveedor?:  string;
}

export interface AtraccionesApiResponse {
  success: boolean;
  data:    Atraccion[] | null;
  message: string | null;
  errors:  string[];
}

export interface PaginatedAtracciones {
  items:      Atraccion[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}
