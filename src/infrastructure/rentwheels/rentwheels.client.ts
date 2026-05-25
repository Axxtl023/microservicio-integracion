import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import type { IRentWheelsClient } from './i-rentwheels.client';
import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';
import type { CrearReservaExternaDto } from '../../business/vehiculos/dtos/crear-reserva-externa.dto';
import type { DisponibilidadDto } from '../../business/vehiculos/dtos/disponibilidad.dto';
import type { ReservaExternaDto } from '../../business/vehiculos/dtos/reserva-externa.dto';
import { mapHttpToDomainError } from '../../business/vehiculos/errors/map-http-error';

const PROV = 'RentWheels';
const BASE_PATH = '/api/v1/gustavobenalcazar/booking';

@Injectable()
export class RentWheelsClient implements IRentWheelsClient {
  private readonly logger = new Logger(RentWheelsClient.name);
  private readonly http: AxiosInstance;

  constructor() {
    // La API de RentWheels es pública — no requiere token de autenticación.
    this.http = axios.create({
      baseURL: process.env.RENTWHEELS_API_URL ?? '',
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getVehiculos(params: Record<string, unknown>): Promise<Vehiculo[]> {
    try {
      const res = await this.http.get(`${BASE_PATH}/vehiculos`, { params });
      // RentWheels envuelve la lista en: { data: { data: [...] } }
      const items: Vehiculo[] = res.data?.data?.data ?? res.data?.data ?? [];
      this.logger.log(`[RentWheels] ${items.length} vehículos obtenidos`);
      return Array.isArray(items) ? items : [];
    } catch (err) {
      this.logger.error('[RentWheels] Error al obtener vehículos', err);
      throw new ServiceUnavailableException('No se pudo conectar con RentWheels');
    }
  }

  async getVehiculoById(id: string): Promise<Vehiculo> {
    try {
      const res = await this.http.get(`${BASE_PATH}/vehiculos/${id}`);
      const data: Vehiculo | null = res.data?.data?.data ?? res.data?.data ?? null;
      if (!data) throw new NotFoundException(`Vehículo ${id} no encontrado en RentWheels`);
      return data;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if ((err as any)?.response?.status === 404) {
        throw new NotFoundException(`Vehículo ${id} no encontrado en RentWheels`);
      }
      this.logger.error(`[RentWheels] Error al obtener vehículo ${id}`, err);
      throw new ServiceUnavailableException('No se pudo conectar con RentWheels');
    }
  }

  async getDisponibilidad(id: string): Promise<Disponibilidad> {
    try {
      const res = await this.http.get(`${BASE_PATH}/vehiculos/${id}/disponibilidad`);
      const data: Disponibilidad | null = res.data?.data?.data ?? res.data?.data ?? null;
      if (!data) throw new NotFoundException(`Disponibilidad de ${id} no encontrada en RentWheels`);
      return data;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        throw new NotFoundException(`Disponibilidad de ${id} no encontrada en RentWheels`);
      }
      this.logger.error(`[RentWheels] Error al obtener disponibilidad ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo consultar disponibilidad');
    }
  }

  // ─── Reservas externas ──────────────────────────────────────────────────────
  async verificarDisponibilidadExterna(vehiculoId: string): Promise<DisponibilidadDto> {
    return this.getDisponibilidad(vehiculoId) as Promise<DisponibilidadDto>;
  }

  async crearReservaExterna(data: CrearReservaExternaDto): Promise<ReservaExternaDto> {
    try {
      const body = {
        vehiculoId: data.vehiculoId,
        clienteId: data.clienteId,
        agenciaId: data.agenciaId,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
      };
      const res = await this.http.post(`${BASE_PATH}/reservas`, body);
      const created = res.data?.data ?? res.data;
      if (!created || typeof created !== 'object') throw new Error('Respuesta inválida del proveedor');
      return created as ReservaExternaDto;
    } catch (err) {
      this.logger.error(`[${PROV}] Error creando reserva para vehiculo ${data.vehiculoId}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo crear la reserva');
    }
  }

  async confirmarReservaExterna(id: string): Promise<ReservaExternaDto> {
    try {
      const res = await this.http.patch(`${BASE_PATH}/reservas/${id}`, { status: 'CONFIRMADA' });
      const updated = res.data?.data ?? res.data;
      if (!updated || typeof updated !== 'object') throw new Error('Respuesta inválida del proveedor');
      return updated as ReservaExternaDto;
    } catch (err) {
      this.logger.error(`[${PROV}] Error confirmando reserva ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo confirmar la reserva');
    }
  }

  async cancelarReservaExterna(id: string, reason?: string): Promise<ReservaExternaDto> {
    try {
      if (reason) this.logger.log(`[${PROV}] Cancelando reserva ${id}. Razón: ${reason}`);
      const res = await this.http.patch(`${BASE_PATH}/reservas/${id}`, { status: 'CANCELADA' });
      const updated = res.data?.data ?? res.data;
      if (!updated || typeof updated !== 'object') throw new Error('Respuesta inválida del proveedor');
      return updated as ReservaExternaDto;
    } catch (err) {
      this.logger.error(`[${PROV}] Error cancelando reserva ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo cancelar la reserva');
    }
  }
}
