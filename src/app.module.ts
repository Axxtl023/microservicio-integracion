import { Module } from '@nestjs/common';
import axios from 'axios';
import { UrbancarClient } from './infrastructure/urbancar/urbancar.client';
import {
  IURBANCAR_CLIENT,
  URBANCAR_INVENTORY_HTTP,
  URBANCAR_OPERATIONS_HTTP,
} from './infrastructure/urbancar/i-urbancar.client';
import { VehiculosService } from './business/vehiculos/vehiculos.service';
import { IVEHICULOS_SERVICE } from './business/vehiculos/interfaces/i-vehiculos.service';
import { ProductosController } from './api/controllers/v1/ProductosController';
import { IntegrationGrpcController } from './api/controllers/grpc/IntegrationGrpcController';

const URBANCAR_INVENTORY_FALLBACK =
  'https://inventario-service.ambitioushill-8cbf622c.eastus2.azurecontainerapps.io';
const URBANCAR_OPERATIONS_FALLBACK =
  'https://operaciones-service.ambitioushill-8cbf622c.eastus2.azurecontainerapps.io';

function buildUrbanCarBaseUrl(baseUrl: string, prefix: string): string {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const cleanPrefix = prefix.startsWith('/') ? prefix : `/${prefix}`;
  return `${cleanBaseUrl}${cleanPrefix}`;
}

@Module({
  imports: [],
  controllers: [ProductosController, IntegrationGrpcController],
  providers: [
    {
      provide: URBANCAR_INVENTORY_HTTP,
      useFactory: () => {
        const prefix = process.env.URBANCAR_PREFIX ?? '/api/v1/emilypamela';
        const baseUrl =
          process.env.URBANCAR_INVENTORY_BASE_URL ??
          process.env.URBANCAR_BASE_URL ??
          URBANCAR_INVENTORY_FALLBACK;

        return axios.create({
          baseURL: buildUrbanCarBaseUrl(baseUrl, prefix),
          timeout: 10_000,
        });
      },
    },
    {
      provide: URBANCAR_OPERATIONS_HTTP,
      useFactory: () => {
        const prefix = process.env.URBANCAR_PREFIX ?? '/api/v1/emilypamela';
        const baseUrl =
          process.env.URBANCAR_OPERATIONS_BASE_URL ?? URBANCAR_OPERATIONS_FALLBACK;

        return axios.create({
          baseURL: buildUrbanCarBaseUrl(baseUrl, prefix),
          timeout: 10_000,
        });
      },
    },
    UrbancarClient,
    { provide: IURBANCAR_CLIENT, useExisting: UrbancarClient },
    VehiculosService,
    { provide: IVEHICULOS_SERVICE, useExisting: VehiculosService },
  ],
})
export class AppModule {}
