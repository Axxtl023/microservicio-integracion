import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { IRodrigosClient } from './i-rodrigos.client';
import type { Hotel, Habitacion } from '../../interfaces/hoteles.interface';

@Injectable()
export class RodrigosClient implements IRodrigosClient {
  private readonly logger = new Logger(RodrigosClient.name);
  private readonly http:   AxiosInstance;

  constructor() {
    // timeout 4s — candado de latencia para cold starts en el servidor gratuito
    this.http = axios.create({
      baseURL: process.env.RODRIGOS_API_URL ?? '',
      timeout: 4_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getHoteles(): Promise<Hotel[]> {
    try {
      const res = await this.http.get('/api/v1/alojamientos-lucano');
      const payload: unknown = res.data ?? [];

      if (Array.isArray(payload)) {
        this.logger.log(`[Rodrigo's] ${payload.length} alojamientos recibidos`);
        return payload as Hotel[];
      }

      this.logger.warn("[Rodrigo's] Estructura inesperada al listar hoteles", payload);
      return [];
    } catch (err) {
      this.logger.error("[Rodrigo's] Error al obtener alojamientos", err);
      throw new ServiceUnavailableException("No se pudo conectar con Rodrigo's");
    }
  }

  async getHotelById(id: number): Promise<Hotel | null> {
    try {
      const res = await this.http.get(`/api/v1/alojamientos-lucano/${id}`);
      const payload: unknown = res.data ?? null;

      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return payload as Hotel;
      }

      this.logger.warn(`[Rodrigo's] Respuesta inesperada para hotel id=${id}`, payload);
      return null;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      this.logger.error(`[Rodrigo's] Error al obtener hotel id=${id}`, err);
      throw new ServiceUnavailableException("No se pudo conectar con Rodrigo's");
    }
  }

  async getHabitacionesPorAlojamiento(id: number): Promise<Habitacion[]> {
    try {
      const res = await this.http.get(`/api/v1/habitaciones-lucano/alojamiento/${id}`);
      const payload: unknown = res.data ?? [];

      if (Array.isArray(payload)) {
        this.logger.log(`[Rodrigo's] ${payload.length} habitaciones para alojamiento id=${id}`);
        return payload as Habitacion[];
      }

      this.logger.warn(`[Rodrigo's] Estructura inesperada en habitaciones para id=${id}`, payload);
      return [];
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return [];
      // Graceful — no lanzar para no bloquear obtenerPorId
      this.logger.error(`[Rodrigo's] Error al obtener habitaciones para id=${id}`, err);
      return [];
    }
  }
}
