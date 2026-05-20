import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import type { IVuelosClient } from './i-vuelos.client';
import type { Vuelo, VuelosApiResponse } from '../../interfaces/vuelos.interface';

@Injectable()
export class VuelosClient implements IVuelosClient {
  private readonly logger = new Logger(VuelosClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    // La API de VuelosApp es pública — no requiere token de autenticación.
    this.http = axios.create({
      baseURL: process.env.VUELOSAPP_BASE_URL ?? '',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getVuelos(params: Record<string, unknown>): Promise<Vuelo[]> {
    try {
      const res = await this.http.get<VuelosApiResponse>('/flights', { params });
      return res.data?.data ?? [];
    } catch (err) {
      this.logger.error('Error al obtener vuelos de VuelosApp', err);
      throw new ServiceUnavailableException('No se pudo conectar con VuelosApp');
    }
  }
}
