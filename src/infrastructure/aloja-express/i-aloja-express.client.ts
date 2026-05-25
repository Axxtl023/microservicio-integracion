export const IALOJAEXPRESS_CLIENT = 'IALOJAEXPRESS_CLIENT';

export interface IAlojaExpressClient {
  getAlojamientos(): Promise<Record<string, unknown>[]>;
  getAlojamientoById(id: string | number): Promise<Record<string, unknown> | null>;
  getHabitacionesPorAlojamiento(id: string | number): Promise<Record<string, unknown>[]>;
}
