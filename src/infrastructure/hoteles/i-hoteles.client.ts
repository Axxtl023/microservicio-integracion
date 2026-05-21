import type { Hotel } from '../../interfaces/hoteles.interface';

export const IHOTELES_CLIENT = 'IHOTELES_CLIENT';

export interface IHotelesClient {
  getHoteles(): Promise<Hotel[]>;
  getHotelById(id: number): Promise<Hotel | null>;
}
