import { Injectable, Inject } from '@nestjs/common';
import type { IVehiculosService, ListarVehiculosParams } from './interfaces/i-vehiculos.service';
import type { IUrbancarClient } from '../../infrastructure/urbancar/i-urbancar.client';
import { IURBANCAR_CLIENT } from '../../infrastructure/urbancar/i-urbancar.client';
import type { Vehiculo } from '../../interfaces/urbancar.interface';
import type { CrearReservaExternaDto } from '../../infrastructure/urbancar/dtos/crear-reserva-externa.dto';
import type { DisponibilidadDto } from '../../infrastructure/urbancar/dtos/disponibilidad.dto';
import type { ReservaExternaDto } from '../../infrastructure/urbancar/dtos/reserva-externa.dto';

@Injectable()
export class VehiculosService implements IVehiculosService {
  constructor(
    @Inject(IURBANCAR_CLIENT)
    private readonly client: IUrbancarClient,
  ) {}

  listar(params: ListarVehiculosParams): Promise<Vehiculo[]> {
    const clean: Record<string, unknown> = {};
    if (params.agenciaId)   clean.agenciaId   = params.agenciaId;
    if (params.categoriaId) clean.categoriaId = params.categoriaId;
    if (params.status)      clean.status      = params.status;
    if (params.page)        clean.page        = params.page;
    if (params.limit)       clean.limit       = params.limit;
    return this.client.getVehiculos(clean);
  }

  obtenerPorId(id: string): Promise<Vehiculo> {
    return this.client.getVehiculoById(id);
  }

  obtenerDisponibilidad(id: string): Promise<DisponibilidadDto> {
    return this.client.getDisponibilidad(id);
  }

  verificarDisponibilidadExterna(vehiculoId: string): Promise<DisponibilidadDto> {
    return this.client.verificarDisponibilidadExterna(vehiculoId);
  }

  crearReservaExterna(data: CrearReservaExternaDto): Promise<ReservaExternaDto> {
    return this.client.crearReservaExterna(data);
  }

  confirmarReservaExterna(id: string): Promise<ReservaExternaDto> {
    return this.client.confirmarReservaExterna(id);
  }

  cancelarReservaExterna(id: string, reason?: string): Promise<ReservaExternaDto> {
    return this.client.cancelarReservaExterna(id, reason);
  }
}
