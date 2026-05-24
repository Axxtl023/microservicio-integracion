export const IAEROCORE_CLIENT = 'IAEROCORE_CLIENT';

export interface IAeroCoreClient {
  getVuelos(query: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  getVueloById(id: string): Promise<Record<string, unknown> | null>;
}
