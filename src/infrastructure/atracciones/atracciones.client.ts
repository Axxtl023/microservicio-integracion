import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import type { IAtraccionesClient } from './i-atracciones.client';
import type { Atraccion, AtraccionesApiResponse } from '../../interfaces/atracciones.interface';

@Injectable()
export class AtraccionesClient implements IAtraccionesClient {
  private readonly logger = new Logger(AtraccionesClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    // La API de TerraQuest es pública — no requiere token de autenticación.
    this.http = axios.create({
      baseURL: process.env.ATRACCIONES_API_URL ?? '',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getAtracciones(params: Record<string, unknown>): Promise<Atraccion[]> {
    try {
      const res = await this.http.get<AtraccionesApiResponse>('/attraction', { params });
      return res.data?.data ?? [];
    } catch (err) {
      this.logger.error('Error al obtener atracciones de TerraQuest', err);
      throw new ServiceUnavailableException('No se pudo conectar con TerraQuest');
    }
  }
}
