// Mapeo estable UUID → nombre de proveedor.
// Los UUIDs deben coincidir EXACTAMENTE con la tabla `proveedores` de
// reservas-booking (ver seed en prisma/migrations/...fase1_vehicle_routing).
// Si agregás un proveedor nuevo, agrégalo acá y wirealo en app.module.ts.

export const VEHICLE_PROVIDER_IDS = {
  URBANCAR:     '11111111-0001-4000-8000-000000000001',
  RENTCAR:      '22222222-0002-4000-8000-000000000002',
  RENTWHEELS:   '33333333-0003-4000-8000-000000000003',
  DRIVEX:       '44444444-0004-4000-8000-000000000004',
  ZENITH_DRIVE: '55555555-0005-4000-8000-000000000005',
} as const;

export type VehicleProviderKey = keyof typeof VEHICLE_PROVIDER_IDS;

export const VEHICLE_PROVIDER_NAMES_BY_ID: Record<string, VehicleProviderKey> = {
  [VEHICLE_PROVIDER_IDS.URBANCAR]:     'URBANCAR',
  [VEHICLE_PROVIDER_IDS.RENTCAR]:      'RENTCAR',
  [VEHICLE_PROVIDER_IDS.RENTWHEELS]:   'RENTWHEELS',
  [VEHICLE_PROVIDER_IDS.DRIVEX]:       'DRIVEX',
  [VEHICLE_PROVIDER_IDS.ZENITH_DRIVE]: 'ZENITH_DRIVE',
};

export function resolveVehicleProvider(providerId: string): VehicleProviderKey | null {
  return VEHICLE_PROVIDER_NAMES_BY_ID[providerId] ?? null;
}
