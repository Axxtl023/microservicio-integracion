import { Injectable, Inject } from '@nestjs/common';
import type { IVehiculosService, ListarVehiculosParams } from './interfaces/i-vehiculos.service';
import type { IUrbancarClient } from '../../infrastructure/urbancar/i-urbancar.client';
import { IURBANCAR_CLIENT } from '../../infrastructure/urbancar/i-urbancar.client';
import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';

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

  obtenerDisponibilidad(id: string): Promise<Disponibilidad> {
    return this.client.getDisponibilidad(id);
  }
}
