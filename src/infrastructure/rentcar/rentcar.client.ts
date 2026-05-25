import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import type { IRentcarClient } from './i-rentcar.client';
import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';
import type {
  RentCarApiResponse,
  RentCarListApiResponse,
} from '../../interfaces/rentcar.interface';
import type { CrearReservaExternaDto } from '../../business/vehiculos/dtos/crear-reserva-externa.dto';
import type { DisponibilidadDto } from '../../business/vehiculos/dtos/disponibilidad.dto';
import type { ReservaExternaDto } from '../../business/vehiculos/dtos/reserva-externa.dto';
import { mapHttpToDomainError } from '../../business/vehiculos/errors/map-http-error';

const PROV = 'RentCar';

@Injectable()
export class RentcarClient implements IRentcarClient {
  private readonly logger = new Logger(RentcarClient.name);
  private readonly http: AxiosInstance;

  constructor() {
    const baseURL = process.env.RENTCAR_BASE_URL ?? '';
    this.http = axios.create({
      baseURL,
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Response interceptor: loguea errores
    this.http.interceptors.response.use(
      (response) => response,
      async (error) => {
        const apiError = error.response?.data?.error as { code?: string; message?: string } | undefined;
        if (apiError) {
          this.logger.error(`[${PROV}] App error: ${apiError.code} — ${apiError.message}`);
        }
        return Promise.reject(error);
      },
    );
  }

  // ─── Catálogo ───────────────────────────────────────────────────────────────
  async getVehiculos(params: Record<string, unknown>): Promise<Vehiculo[]> {
    try {
      const res = await this.http.get<RentCarListApiResponse<Vehiculo>>('vehiculos/booking', { params });
      const body = res.data;
      if (!body.success) {
        this.logger.warn(`[${PROV}] success=false al listar vehículos`);
        return [];
      }
      return body.data?.data ?? [];
    } catch (err) {
      this.logger.error(`Error al obtener vehículos de ${PROV}`, err);
      throw new ServiceUnavailableException(`No se pudo conectar con ${PROV}`);
    }
  }

  async getVehiculoById(id: string): Promise<Vehiculo> {
    try {
      const res = await this.http.get<RentCarApiResponse<Vehiculo>>(`vehiculos/booking/${id}`);
      const body = res.data;
      if (!body.success || !body.data) throw new NotFoundException(`Vehículo ${id} no encontrado en ${PROV}`);
      return body.data;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        throw new NotFoundException(`Vehículo ${id} no encontrado en ${PROV}`);
      }
      this.logger.error(`Error al obtener vehículo ${id} de ${PROV}`, err);
      throw new ServiceUnavailableException(`No se pudo conectar con ${PROV}`);
    }
  }

  async getDisponibilidad(id: string): Promise<Disponibilidad> {
    try {
      const res = await this.http.get<RentCarApiResponse<Disponibilidad>>(`vehiculos/booking/${id}/disponibilidad`);
      const body = res.data;
      if (!body.success || !body.data) throw new NotFoundException(`Disponibilidad de ${id} no encontrada en ${PROV}`);
      return body.data;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        throw new NotFoundException(`Disponibilidad de ${id} no encontrada en ${PROV}`);
      }
      this.logger.error(`Error al obtener disponibilidad ${id} de ${PROV}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo consultar disponibilidad');
    }
  }

  // ─── Reservas externas ──────────────────────────────────────────────────────
  async verificarDisponibilidadExterna(vehiculoId: string): Promise<DisponibilidadDto> {
    return this.getDisponibilidad(vehiculoId) as Promise<DisponibilidadDto>;
  }

  async crearReservaExterna(data: CrearReservaExternaDto): Promise<ReservaExternaDto> {
    try {
      // RentCar deriva clienteId del JWT, así que no se envía en el body.
      // El YAML de Steven usa fechas date-only (YYYY-MM-DD), así que truncamos
      // el ISO que viene del controller.
      const body = {
        vehiculoId: data.vehiculoId,
        agenciaId: data.agenciaId,
        fechaInicio: this.toDateOnly(data.fechaInicio),
        fechaFin: this.toDateOnly(data.fechaFin),
      };
      const res = await this.http.post<RentCarApiResponse<ReservaExternaDto>>('reservas/booking', body);
      if (!res.data.success || !res.data.data) throw new Error('Respuesta inválida del proveedor');
      return res.data.data;
    } catch (err) {
      this.logger.error(`Error creando reserva externa para vehiculo ${data.vehiculoId}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo crear la reserva');
    }
  }

  private toDateOnly(value: string): string {
    return value.includes('T') ? value.slice(0, 10) : value;
  }

  async confirmarReservaExterna(id: string): Promise<ReservaExternaDto> {
    try {
      const res = await this.http.patch<RentCarApiResponse<ReservaExternaDto>>(`reservas/booking/${id}`, { status: 'CONFIRMADA' });
      if (!res.data.success || !res.data.data) throw new Error('Respuesta inválida del proveedor');
      return res.data.data;
    } catch (err) {
      this.logger.error(`Error confirmando reserva ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo confirmar la reserva');
    }
  }

  async cancelarReservaExterna(id: string, reason?: string): Promise<ReservaExternaDto> {
    try {
      if (reason) this.logger.log(`[${PROV}] Cancelando reserva ${id}. Razón: ${reason}`);
      const res = await this.http.patch<RentCarApiResponse<ReservaExternaDto>>(`reservas/booking/${id}`, { status: 'CANCELADA' });
      if (!res.data.success || !res.data.data) throw new Error('Respuesta inválida del proveedor');
      return res.data.data;
    } catch (err) {
      this.logger.error(`Error cancelando reserva ${id}`, err);
      throw mapHttpToDomainError(err, PROV, 'No se pudo cancelar la reserva');
    }
  }
}
