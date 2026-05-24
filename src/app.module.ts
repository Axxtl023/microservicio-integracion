import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UrbancarClient } from './infrastructure/urbancar/urbancar.client';
import { IURBANCAR_CLIENT } from './infrastructure/urbancar/i-urbancar.client';
import { RentcarClient } from './infrastructure/rentcar/rentcar.client';
import { IRENTCAR_CLIENT } from './infrastructure/rentcar/i-rentcar.client';
import { RentWheelsClient } from './infrastructure/rentwheels/rentwheels.client';
import { IRENTWHEELS_CLIENT } from './infrastructure/rentwheels/i-rentwheels.client';
import { VehiculosService } from './business/vehiculos/vehiculos.service';
import { IVEHICULOS_SERVICE } from './business/vehiculos/interfaces/i-vehiculos.service';
import { ProductosController } from './api/controllers/v1/ProductosController';
import { VuelosClient } from './infrastructure/vuelos/vuelos.client';
import { IVUELOS_CLIENT } from './infrastructure/vuelos/i-vuelos.client';
import { SkybookClient } from './infrastructure/skybook/skybook.client';
import { ISKYBOOK_CLIENT } from './infrastructure/skybook/i-skybook.client';
import { AeroWillyClient } from './infrastructure/aerowilly/aerowilly.client';
import { IAEROWI_LLY_CLIENT } from './infrastructure/aerowilly/i-aerowilly.client';
import { AeroCoreClient } from './infrastructure/aerocore/aerocore.client';
import { IAEROCORE_CLIENT } from './infrastructure/aerocore/i-aerocore.client';
import { VuelosService } from './business/vuelos/vuelos.service';
import { IVUELOS_SERVICE } from './business/vuelos/interfaces/i-vuelos.service';
import { VuelosController } from './api/controllers/v1/VuelosController';
import { AtraccionesClient } from './infrastructure/atracciones/atracciones.client';
import { IATRACCIONES_CLIENT } from './infrastructure/atracciones/i-atracciones.client';
import { AtraccionCaTsClient } from './infrastructure/atraccioncats/atraccioncats.client';
import { IATRACCIONCATS_CLIENT } from './infrastructure/atraccioncats/i-atraccioncats.client';
import { VenturoClient } from './infrastructure/venturo/venturo.client';
import { IVENTURO_CLIENT } from './infrastructure/venturo/i-venturo.client';
import { NextStopClient } from './infrastructure/nextstop/nextstop.client';
import { INEXTSTOP_CLIENT } from './infrastructure/nextstop/i-nextstop.client';
import { AtraccionesService } from './business/atracciones/atracciones.service';
import { IATRACCIONES_SERVICE } from './business/atracciones/interfaces/i-atracciones.service';
import { AtraccionesController } from './api/controllers/v1/AtraccionesController';
import { DriveXClient } from './infrastructure/drivex/drivex.client';
import { IDRIVEX_CLIENT } from './infrastructure/drivex/i-drivex.client';
import { ZenithDriveClient } from './infrastructure/zenith-drive/zenith-drive.client';
import { IZENITH_DRIVE_CLIENT } from './infrastructure/zenith-drive/i-zenith-drive.client';
import { HotelesClient } from './infrastructure/hoteles/hoteles.client';
import { IHOTELES_CLIENT } from './infrastructure/hoteles/i-hoteles.client';
import { HomiyaClient } from './infrastructure/homiya/homiya.client';
import { IHOMIYA_CLIENT } from './infrastructure/homiya/i-homiya.client';
import { RodrigosClient } from './infrastructure/rodrigos/rodrigos.client';
import { IRODRIGOS_CLIENT } from './infrastructure/rodrigos/i-rodrigos.client';
import { HousingPlaceClient } from './infrastructure/housing-place/housing-place.client';
import { IHOUSING_PLACE_CLIENT } from './infrastructure/housing-place/i-housing-place.client';
import { HotelesService } from './business/hoteles/hoteles.service';
import { IHOTELES_SERVICE } from './business/hoteles/interfaces/i-hoteles.service';
import { HotelesController } from './api/controllers/v1/HotelesController';

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
  controllers: [ProductosController, VuelosController, AtraccionesController, HotelesController],
  providers: [
    // ── UrbanCar (proveedor original — sin cambios) ───────────────────────────
    UrbancarClient,
    { provide: IURBANCAR_CLIENT, useExisting: UrbancarClient },

    // ── RentCar EC ────────────────────────────────────────────────────────────
    RentcarClient,
    { provide: IRENTCAR_CLIENT, useExisting: RentcarClient },

    // ── RentWheels ────────────────────────────────────────────────────────────
    RentWheelsClient,
    { provide: IRENTWHEELS_CLIENT, useExisting: RentWheelsClient },

    // ── DriveX ────────────────────────────────────────────────────────────────
    DriveXClient,
    { provide: IDRIVEX_CLIENT, useExisting: DriveXClient },

    // ── Zenith Drive ──────────────────────────────────────────────────────────
    ZenithDriveClient,
    { provide: IZENITH_DRIVE_CLIENT, useExisting: ZenithDriveClient },

    // ── Servicio de vehículos (agrega UrbanCar + RentCar + RentWheels + DriveX + Zenith Drive) ─
    VehiculosService,
    { provide: IVEHICULOS_SERVICE, useExisting: VehiculosService },

    // ── VuelosApp ─────────────────────────────────────────────────────────────
    VuelosClient,
    { provide: IVUELOS_CLIENT, useExisting: VuelosClient },

    // ── SkyBook ───────────────────────────────────────────────────────────────
    SkybookClient,
    { provide: ISKYBOOK_CLIENT, useExisting: SkybookClient },

    // ── AeroWilly ─────────────────────────────────────────────────────────────
    AeroWillyClient,
    { provide: IAEROWI_LLY_CLIENT, useExisting: AeroWillyClient },

    // ── AeroCore ──────────────────────────────────────────────────────────────
    AeroCoreClient,
    { provide: IAEROCORE_CLIENT, useExisting: AeroCoreClient },

    // ── Servicio de vuelos (agrega VuelosApp + SkyBook + AeroWilly + AeroCore) ─
    VuelosService,
    { provide: IVUELOS_SERVICE, useExisting: VuelosService },

    // ── TerraQuest ────────────────────────────────────────────────────────────
    AtraccionesClient,
    { provide: IATRACCIONES_CLIENT, useExisting: AtraccionesClient },

    // ── AtraccionCaTs ─────────────────────────────────────────────────────────
    AtraccionCaTsClient,
    { provide: IATRACCIONCATS_CLIENT, useExisting: AtraccionCaTsClient },

    // ── Venturo ───────────────────────────────────────────────────────────────
    VenturoClient,
    { provide: IVENTURO_CLIENT, useExisting: VenturoClient },

    // ── NextStop ──────────────────────────────────────────────────────────────
    NextStopClient,
    { provide: INEXTSTOP_CLIENT, useExisting: NextStopClient },

    // ── Servicio de atracciones (TerraQuest + AtraccionCaTs + Venturo + NextStop) ─
    AtraccionesService,
    { provide: IATRACCIONES_SERVICE, useExisting: AtraccionesService },

    // ── Locus ─────────────────────────────────────────────────────────────────
    HotelesClient,
    { provide: IHOTELES_CLIENT, useExisting: HotelesClient },

    // ── Homiya ────────────────────────────────────────────────────────────────
    HomiyaClient,
    { provide: IHOMIYA_CLIENT, useExisting: HomiyaClient },

    // ── Rodrigo's ─────────────────────────────────────────────────────────────
    RodrigosClient,
    { provide: IRODRIGOS_CLIENT, useExisting: RodrigosClient },

    // ── HousingPlace ──────────────────────────────────────────────────────────
    HousingPlaceClient,
    { provide: IHOUSING_PLACE_CLIENT, useExisting: HousingPlaceClient },

    // ── Servicio de hoteles (agrega Locus + Homiya + Rodrigo's + HousingPlace) ─
    HotelesService,
    { provide: IHOTELES_SERVICE, useExisting: HotelesService },
  ],
})
export class AppModule {}
