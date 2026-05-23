import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { IVehiculosService, ListarVehiculosParams } from './interfaces/i-vehiculos.service';
import type { IUrbancarClient } from '../../infrastructure/urbancar/i-urbancar.client';
import { IURBANCAR_CLIENT } from '../../infrastructure/urbancar/i-urbancar.client';
import type { IRentcarClient } from '../../infrastructure/rentcar/i-rentcar.client';
import { IRENTCAR_CLIENT } from '../../infrastructure/rentcar/i-rentcar.client';
import type { IRentWheelsClient } from '../../infrastructure/rentwheels/i-rentwheels.client';
import { IRENTWHEELS_CLIENT } from '../../infrastructure/rentwheels/i-rentwheels.client';
import type { IDriveXClient } from '../../infrastructure/drivex/i-drivex.client';
import { IDRIVEX_CLIENT } from '../../infrastructure/drivex/i-drivex.client';
import type { Vehiculo, PaginatedVehiculos, Disponibilidad } from '../../interfaces/urbancar.interface';

@Injectable()
export class VehiculosService implements IVehiculosService {
  constructor(
    @Inject(IURBANCAR_CLIENT)   private readonly urbancar:    IUrbancarClient,
    @Inject(IRENTCAR_CLIENT)    private readonly rentcar:     IRentcarClient,
    @Inject(IRENTWHEELS_CLIENT) private readonly rentwheels:  IRentWheelsClient,
    @Inject(IDRIVEX_CLIENT)     private readonly drivex:      IDriveXClient,
  ) {}

  async listar(params: ListarVehiculosParams): Promise<PaginatedVehiculos> {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.max(1, params.limit ?? 8);

    // Solo filtros se delegan a los proveedores; la paginación la hacemos
    // sobre el catálogo fusionado para que page/limit sean consistentes
    // independientemente de cuántos ítems aporta cada proveedor.
    const providerParams: Record<string, unknown> = { limit: 200 };
    if (params.agenciaId)   providerParams.agenciaId   = params.agenciaId;
    if (params.categoriaId) providerParams.categoriaId = params.categoriaId;
    if (params.status)      providerParams.status      = params.status;

    const [urbanResult, rentcarResult, rentwheelsResult, drivexResult] = await Promise.allSettled([
      this.urbancar.getVehiculos(providerParams),
      this.rentcar.getVehiculos(providerParams),
      this.rentwheels.getVehiculos(providerParams),
      this.drivex.getVehiculos(providerParams),
    ]);

    const norm = (v: Vehiculo): boolean =>
      v.disponible === true || (v.disponible as unknown as string) === 'true';

    const urbanVehiculos = urbanResult.status === 'fulfilled'
      ? urbanResult.value.map(v => ({ ...v, proveedor: 'UrbanCar',    disponible: norm(v) }))
      : [];
    const rentcarVehiculos = rentcarResult.status === 'fulfilled'
      ? rentcarResult.value.map(v => ({ ...v, proveedor: 'RentCar',   disponible: norm(v) }))
      : [];
    const rentwheelsVehiculos = rentwheelsResult.status === 'fulfilled'
      ? rentwheelsResult.value.map(v => ({ ...v, proveedor: 'RentWheels', disponible: norm(v) }))
      : [];
    const drivexVehiculos = drivexResult.status === 'fulfilled'
      ? drivexResult.value.map(v => ({ ...v, proveedor: 'DriveX',     disponible: norm(v) }))
      : [];

    const all        = [...urbanVehiculos, ...rentcarVehiculos, ...rentwheelsVehiculos, ...drivexVehiculos];
    const total      = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage   = Math.min(page, totalPages);
    const items      = all.slice((safePage - 1) * limit, safePage * limit);

    return { items, total, page: safePage, limit, totalPages };
  }

  async obtenerPorId(id: string): Promise<Vehiculo> {
    // Consulta ambos en paralelo; devuelve el primero que responda correctamente.
    try {
      return await Promise.any([
        this.urbancar.getVehiculoById(id),
        this.rentcar.getVehiculoById(id),
        this.rentwheels.getVehiculoById(id),
        this.drivex.getVehiculoById(id),
      ]);
    } catch {
      throw new NotFoundException(`Vehículo ${id} no encontrado en ningún proveedor`);
    }
  }

  async obtenerDisponibilidad(id: string): Promise<Disponibilidad> {
    try {
      const raw = await Promise.any([
        this.urbancar.getDisponibilidad(id),
        this.rentcar.getDisponibilidad(id),
        this.rentwheels.getDisponibilidad(id),
        this.drivex.getDisponibilidad(id),
      ]);
      // Normalización booleana estricta — evita que un string o null de otro proveedor
      // gane la carrera y pinte incorrectamente "No disponible".
      return {
        ...raw,
        disponible: raw.disponible === true || (raw.disponible as unknown as string) === 'true',
      };
    } catch {
      throw new NotFoundException(`Disponibilidad de ${id} no encontrada en ningún proveedor`);
    }
  }
}
