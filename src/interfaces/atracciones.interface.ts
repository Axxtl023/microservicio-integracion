// Tipos nativos de la API pública TerraQuest — solo para uso interno del microservicio.
// El frontend nunca ve estos tipos directamente; recibe siempre nuestro ApiResponse estándar.

export interface GalleryItem {
  url:        string;
  title?:     string;
  isMain:     boolean;
  sortOrder?: number;
}

export interface PriceTier {
  id:            string;
  price:         number;
  currencyCode:  string;
  categoryName?: string;
}

export interface Product {
  id:                   string;
  title:                string;
  description?:         string;
  durationDescription?: string;
  priceTiers:           PriceTier[];
}

export interface Atraccion {
  id:                   string;
  slug:                 string;
  name:                 string;
  descriptionShort:     string | null;
  descriptionFull?:     string | null;
  locationName:         string | null;
  locationCountryCode?: string | null;
  categoryName?:        string | null;
  subcategoryName?:     string | null;
  ratingAverage?:       number | null;
  ratingCount?:         number | null;
  difficultyLevel?:     string | null;
  mainImageUrl:         string | null;
  address?:             string | null;
  meetingPoint?:        string | null;
  gallery?:             GalleryItem[];
  products?:            Product[];
  startingPrice:        number;
  currencyCode:         string;
  isActive:             boolean;
  isPublished?:         boolean;
  modalityCount?:       number | null;
  proveedor?:           string;
  slots?: {
    slotId: string;
    fecha: string;
    horaInicio: string;
    cuposDisponibles: number;
  }[];
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
