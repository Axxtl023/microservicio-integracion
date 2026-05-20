// Envelopes nativos de la API de RentCar EC — solo para uso interno del cliente HTTP.
// El frontend nunca ve estos tipos; recibe siempre nuestro ApiResponse estándar.

export interface RentCarApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: { code: string; message: string };
}

export interface RentCarPaginado<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RentCarListApiResponse<T> {
  success: boolean;
  data: RentCarPaginado<T> | null;
  error?: { code: string; message: string };
}
