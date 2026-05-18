import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UrbancarClient } from './infrastructure/urbancar/urbancar.client';
import { IURBANCAR_CLIENT } from './infrastructure/urbancar/i-urbancar.client';
import { VehiculosService } from './business/vehiculos/vehiculos.service';
import { IVEHICULOS_SERVICE } from './business/vehiculos/interfaces/i-vehiculos.service';
import { ProductosController } from './api/controllers/v1/ProductosController';

@Module({
  imports: [
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
  controllers: [ProductosController],
  providers: [
    UrbancarClient,
    { provide: IURBANCAR_CLIENT, useExisting: UrbancarClient },
    VehiculosService,
    { provide: IVEHICULOS_SERVICE, useExisting: VehiculosService },
  ],
})
export class AppModule {}
