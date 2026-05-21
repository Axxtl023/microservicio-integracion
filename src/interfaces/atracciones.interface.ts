// Tipos nativos de la API pública TerraQuest — solo para uso interno del microservicio.
// El frontend nunca ve estos tipos directamente; recibe siempre nuestro ApiResponse estándar.

export interface Atraccion {
  id:                   string;
  slug:                 string;
  name:                 string;
  descriptionShort:     string | null;
  locationName:         string | null;
  locationCountryCode?: string | null;
  categoryName?:        string | null;
  subcategoryName?:     string | null;
  ratingAverage?:       number | null;
  ratingCount?:         number | null;
  difficultyLevel?:     string | null;
  mainImageUrl:         string | null;
  startingPrice:        number;
  currencyCode:         string;
  isActive:             boolean;
  isPublished?:         boolean;
  modalityCount?:       number | null;
  proveedor?:           string;
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
