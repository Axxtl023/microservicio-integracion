export interface Vehiculo {
  id:           string;
  nombre:       string;
  descripcion:  string | null;
  precioPorDia: number;
  moneda:       string;
  categoria:    string | null;
  agenciaId:    string | null;
  disponible:   boolean;
  status:       string | null;
  imagenUrl:    string | null;
  proveedor?:   string;
}

export interface Disponibilidad {
  vehiculoId: string;
  disponible: boolean;
  status:     string | null;
  mensaje:    string | null;
}
