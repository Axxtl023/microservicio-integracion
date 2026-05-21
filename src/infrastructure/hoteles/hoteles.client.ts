import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IHotelesClient } from './i-hoteles.client';
import type { Hotel } from '../../interfaces/hoteles.interface';

@Injectable()
export class HotelesClient implements IHotelesClient {
  private readonly logger = new Logger(HotelesClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.HOTELES_API_URL ?? '',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getHoteles(): Promise<Hotel[]> {
    try {
      const res = await this.http.get('/api/v1/israel-hernandez/alojamientos');
      const payload: unknown = res.data?.data ?? res.data;

      if (Array.isArray(payload)) {
        this.logger.log(`[Locus] ${payload.length} alojamientos recibidos`);
        return payload as Hotel[];
      }

      this.logger.warn('[Locus] Estructura inesperada al listar hoteles', payload);
      return [];
    } catch (err) {
      this.logger.error('[Locus] Error al obtener alojamientos', err);
      throw new ServiceUnavailableException('No se pudo conectar con Locus');
    }
  }

  async getHotelById(id: number): Promise<Hotel | null> {
    try {
      const res = await this.http.get(`/api/v1/israel-hernandez/alojamientos/${id}`);
      const payload: unknown = res.data?.data ?? res.data;

      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return payload as Hotel;
      }

      this.logger.warn(`[Locus] Respuesta inesperada para hotel id=${id}`, payload);
      return null;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      this.logger.error(`[Locus] Error al obtener hotel id=${id}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con Locus');
    }
  }
}
