import type { Hotel } from '../../interfaces/hoteles.interface';

export const IHOMIYA_CLIENT = 'IHOMIYA_CLIENT';

export interface IHomiyaClient {
  getHoteles(): Promise<Hotel[]>;
  getHotelById(id: number): Promise<Hotel | null>;
}
