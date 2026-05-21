import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UrbancarClient } from './infrastructure/urbancar/urbancar.client';
import { IURBANCAR_CLIENT } from './infrastructure/urbancar/i-urbancar.client';
import { RentcarClient } from './infrastructure/rentcar/rentcar.client';
import { IRENTCAR_CLIENT } from './infrastructure/rentcar/i-rentcar.client';
import { VehiculosService } from './business/vehiculos/vehiculos.service';
import { IVEHICULOS_SERVICE } from './business/vehiculos/interfaces/i-vehiculos.service';
import { ProductosController } from './api/controllers/v1/ProductosController';
import { VuelosClient } from './infrastructure/vuelos/vuelos.client';
import { IVUELOS_CLIENT } from './infrastructure/vuelos/i-vuelos.client';
import { VuelosService } from './business/vuelos/vuelos.service';
import { IVUELOS_SERVICE } from './business/vuelos/interfaces/i-vuelos.service';
import { VuelosController } from './api/controllers/v1/VuelosController';
import { AtraccionesClient } from './infrastructure/atracciones/atracciones.client';
import { IATRACCIONES_CLIENT } from './infrastructure/atracciones/i-atracciones.client';
import { AtraccionesService } from './business/atracciones/atracciones.service';
import { IATRACCIONES_SERVICE } from './business/atracciones/interfaces/i-atracciones.service';
import { AtraccionesController } from './api/controllers/v1/AtraccionesController';

@Module({
  imports: [
    // HttpModule exclusivo de UrbanCar — RentcarClient y VuelosClient usan axios.create() propio
    HttpModule.registerAsync({
      useFactory: () => ({
        baseURL:
          (process.env.URBANCAR_BASE_URL ??
            'https://inventario-service.ambitioushill-8cbf622c.eastus2.azurecontainerapps.io') +
          (process.env.URBANCAR_PREFIX ?? '/api/v1/emilypamela'),
        timeout: 10_000,
      }),
    }),
  ],
  controllers: [ProductosController, VuelosController, AtraccionesController],
  providers: [
    // ── UrbanCar (proveedor original — sin cambios) ───────────────────────────
    UrbancarClient,
    { provide: IURBANCAR_CLIENT, useExisting: UrbancarClient },

    // ── RentCar EC ────────────────────────────────────────────────────────────
    RentcarClient,
    { provide: IRENTCAR_CLIENT, useExisting: RentcarClient },

    // ── Servicio de vehículos (agrega UrbanCar + RentCar) ────────────────────
    VehiculosService,
    { provide: IVEHICULOS_SERVICE, useExisting: VehiculosService },

    // ── VuelosApp ─────────────────────────────────────────────────────────────
    VuelosClient,
    { provide: IVUELOS_CLIENT, useExisting: VuelosClient },

    // ── Servicio de vuelos ────────────────────────────────────────────────────
    VuelosService,
    { provide: IVUELOS_SERVICE, useExisting: VuelosService },

    // ── TerraQuest ────────────────────────────────────────────────────────────
    AtraccionesClient,
    { provide: IATRACCIONES_CLIENT, useExisting: AtraccionesClient },

    // ── Servicio de atracciones ───────────────────────────────────────────────
    AtraccionesService,
    { provide: IATRACCIONES_SERVICE, useExisting: AtraccionesService },
  ],
})
export class AppModule {}
