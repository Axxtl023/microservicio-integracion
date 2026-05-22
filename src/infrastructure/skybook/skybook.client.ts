import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { ISkybookClient } from './i-skybook.client';
import type { Vuelo } from '../../interfaces/vuelos.interface';

@Injectable()
export class SkybookClient implements ISkybookClient {
  private readonly logger = new Logger(SkybookClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    // SkyBook es una API pública — no requiere token de autenticación.
    this.http = axios.create({
      baseURL: process.env.SKYBOOK_API_URL ?? '',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getVuelos(): Promise<Vuelo[]> {
    try {
      const res = await this.http.get('/flights');

      // Handles bare array or { data: Vuelo[] } envelope
      const payload: unknown = res.data?.data ?? res.data;

      if (Array.isArray(payload)) {
        this.logger.log(`[SkyBook] ${payload.length} vuelos obtenidos`);
        return payload as Vuelo[];
      }

      this.logger.warn('[SkyBook] Estructura de respuesta inesperada — retornando []', payload);
      return [];
    } catch (err) {
      this.logger.error('[SkyBook] Error de red al llamar /flights', err);
      throw new ServiceUnavailableException('No se pudo conectar con SkyBook');
    }
  }
}
