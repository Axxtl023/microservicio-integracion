import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { IVehiculosService, ListarVehiculosParams } from './interfaces/i-vehiculos.service';
import type { IUrbancarClient } from '../../infrastructure/urbancar/i-urbancar.client';
import { IURBANCAR_CLIENT } from '../../infrastructure/urbancar/i-urbancar.client';
import type { IRentcarClient } from '../../infrastructure/rentcar/i-rentcar.client';
import { IRENTCAR_CLIENT } from '../../infrastructure/rentcar/i-rentcar.client';
import type { Vehiculo, Disponibilidad } from '../../interfaces/urbancar.interface';

@Injectable()
export class VehiculosService implements IVehiculosService {
  constructor(
    @Inject(IURBANCAR_CLIENT) private readonly urbancar: IUrbancarClient,
    @Inject(IRENTCAR_CLIENT)  private readonly rentcar:  IRentcarClient,
  ) {}

  async listar(params: ListarVehiculosParams): Promise<Vehiculo[]> {
    const clean: Record<string, unknown> = {};
    if (params.agenciaId)   clean.agenciaId   = params.agenciaId;
    if (params.categoriaId) clean.categoriaId = params.categoriaId;
    if (params.status)      clean.status      = params.status;
    if (params.page)        clean.page        = params.page;
    if (params.limit)       clean.limit       = params.limit;

    // Consulta ambos proveedores en paralelo; si uno falla el otro sigue funcionando.
    const [urbanResult, rentcarResult] = await Promise.allSettled([
      this.urbancar.getVehiculos(clean),
      this.rentcar.getVehiculos(clean),
    ]);

    const urbanVehiculos   = urbanResult.status   === 'fulfilled' ? urbanResult.value   : [];
    const rentcarVehiculos = rentcarResult.status  === 'fulfilled' ? rentcarResult.value : [];

    return [...urbanVehiculos, ...rentcarVehiculos];
  }

  async obtenerPorId(id: string): Promise<Vehiculo> {
    // Consulta ambos en paralelo; devuelve el primero que responda correctamente.
    try {
      return await Promise.any([
        this.urbancar.getVehiculoById(id),
        this.rentcar.getVehiculoById(id),
      ]);
    } catch {
      throw new NotFoundException(`Vehículo ${id} no encontrado en ningún proveedor`);
    }
  }

  async obtenerDisponibilidad(id: string): Promise<Disponibilidad> {
    try {
      return await Promise.any([
        this.urbancar.getDisponibilidad(id),
        this.rentcar.getDisponibilidad(id),
      ]);
    } catch {
      throw new NotFoundException(`Disponibilidad de ${id} no encontrada en ningún proveedor`);
    }
  }
}
