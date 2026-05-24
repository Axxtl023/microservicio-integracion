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
import type { IZenithDriveClient } from '../../infrastructure/zenith-drive/i-zenith-drive.client';
import { IZENITH_DRIVE_CLIENT } from '../../infrastructure/zenith-drive/i-zenith-drive.client';
import type { Vehiculo, PaginatedVehiculos, Disponibilidad } from '../../interfaces/urbancar.interface';

@Injectable()
export class VehiculosService implements IVehiculosService {
  // Normalizador elástico: mapea los campos de Zenith Drive al contrato común
  // independientemente de variaciones menores en los nombres de campo del proveedor.
  private mapZenith(raw: Record<string, unknown>): Vehiculo {
    return {
      id:           String(raw.id ?? ''),
      nombre:       String(raw.nombre ?? ''),
      descripcion:  (raw.descripcion as string | null) ?? null,
      precioPorDia: Number((raw.precioPorDia as number) || (raw.precio as number) || 0),
      moneda:       String(raw.moneda ?? 'USD'),
      categoria:    (raw.categoria as string | null) ?? null,
      agenciaId:    (raw.agenciaId as string | null) ?? null,
      disponible:   raw.disponible === true || raw.disponible === 'true',
      status:       (raw.status  as string | null) ?? null,
      imagenUrl:    (raw.imagenUrl as string | null) ?? null,
    };
  }

  constructor(
    @Inject(IURBANCAR_CLIENT)      private readonly urbancar:    IUrbancarClient,
    @Inject(IRENTCAR_CLIENT)       private readonly rentcar:     IRentcarClient,
    @Inject(IRENTWHEELS_CLIENT)    private readonly rentwheels:  IRentWheelsClient,
    @Inject(IDRIVEX_CLIENT)        private readonly drivex:      IDriveXClient,
    @Inject(IZENITH_DRIVE_CLIENT)  private readonly zenith:      IZenithDriveClient,
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

    const [urbanResult, rentcarResult, rentwheelsResult, drivexResult, zenithResult] = await Promise.allSettled([
      this.urbancar.getVehiculos(providerParams),
      this.rentcar.getVehiculos(providerParams),
      this.rentwheels.getVehiculos(providerParams),
      this.drivex.getVehiculos(providerParams),
      this.zenith.getVehiculos(providerParams),
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
    if (zenithResult.status === 'rejected') {
      console.error('❌ [ZenithDrive List Error]:', zenithResult.reason);
    }
    const zenithVehiculos = zenithResult.status === 'fulfilled'
      ? zenithResult.value.map(auto => ({ ...this.mapZenith(auto as unknown as Record<string, unknown>), proveedor: 'Zenith Drive' }))
      : [];

    const all        = [...urbanVehiculos, ...rentcarVehiculos, ...rentwheelsVehiculos, ...drivexVehiculos, ...zenithVehiculos];
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
        this.zenith.getVehiculoById(id),
      ]);
    } catch {
      throw new NotFoundException(`Vehículo ${id} no encontrado en ningún proveedor`);
    }
  }

  async obtenerDisponibilidad(id: string): Promise<Disponibilidad> {
    const results = await Promise.allSettled([
      this.urbancar.getDisponibilidad(id),
      this.rentcar.getDisponibilidad(id),
      this.rentwheels.getDisponibilidad(id),
      this.drivex.getDisponibilidad(id),
      this.zenith.getDisponibilidad(id),
    ]);

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<Disponibilidad> => r.status === 'fulfilled',
    );

    if (fulfilled.length === 0) {
      throw new NotFoundException(`Disponibilidad de ${id} no encontrada en ningún proveedor`);
    }

    const normDisp = (v: Disponibilidad): boolean =>
      v.disponible === true || (v.disponible as unknown as string) === 'true';

    // Un proveedor ajeno puede responder 200 con disponible:false para un ID que no le pertenece.
    // Con Promise.any ese falso negativo ganaría la carrera. Con allSettled + "true wins",
    // el proveedor propietario (que devuelve true) siempre tiene prioridad.
    const winner = fulfilled.find(r => normDisp(r.value)) ?? fulfilled[0];

    return {
      ...winner.value,
      disponible: normDisp(winner.value),
    };
  }
}
