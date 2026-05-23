import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IHomiyaClient } from './i-homiya.client';
import type { Hotel } from '../../interfaces/hoteles.interface';

@Injectable()
export class HomiyaClient implements IHomiyaClient {
  private readonly logger = new Logger(HomiyaClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.HOMIYA_API_URL ?? '',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getHoteles(): Promise<Hotel[]> {
    try {
      const res = await this.http.get('/api/v1/mathias-rivera/alojamientos');
      const payload: unknown = res.data ?? [];

      if (Array.isArray(payload)) {
        this.logger.log(`[Homiya] ${payload.length} alojamientos recibidos`);
        return payload as Hotel[];
      }

      this.logger.warn('[Homiya] Estructura inesperada al listar hoteles', payload);
      return [];
    } catch (err) {
      this.logger.error('[Homiya] Error al obtener alojamientos', err);
      throw new ServiceUnavailableException('No se pudo conectar con Homiya');
    }
  }

  async getHotelById(id: number): Promise<Hotel | null> {
    try {
      const res = await this.http.get(`/api/v1/mathias-rivera/alojamientos/${id}`);
      const payload: unknown = res.data ?? null;

      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return payload as Hotel;
      }

      this.logger.warn(`[Homiya] Respuesta inesperada para hotel id=${id}`, payload);
      return null;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      this.logger.error(`[Homiya] Error al obtener hotel id=${id}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con Homiya');
    }
  }
}
