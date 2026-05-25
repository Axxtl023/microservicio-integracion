// UUIDs deben coincidir EXACTAMENTE con la tabla `proveedores` de reservas-booking.
// Aplicar seed-vuelos.sql en Supabase antes de habilitar estos proveedores.

export const FLIGHT_PROVIDER_IDS = {
  VUELOSAPP: 'ffffffff-0015-4000-8000-000000000015',
  AEROWILLY: '12121212-0016-4000-8000-000000000016',
  AEROCORE:  '34343434-0017-4000-8000-000000000017',
  SKYBOOK:   '56565656-0018-4000-8000-000000000018',
} as const;

export type FlightProviderKey = keyof typeof FLIGHT_PROVIDER_IDS;

export const FLIGHT_PROVIDER_NAMES_BY_ID: Record<string, FlightProviderKey> = {
  [FLIGHT_PROVIDER_IDS.VUELOSAPP]: 'VUELOSAPP',
  [FLIGHT_PROVIDER_IDS.AEROWILLY]: 'AEROWILLY',
  [FLIGHT_PROVIDER_IDS.AEROCORE]:  'AEROCORE',
  [FLIGHT_PROVIDER_IDS.SKYBOOK]:   'SKYBOOK',
};

export function resolveFlightProvider(providerId: string): FlightProviderKey | null {
  return FLIGHT_PROVIDER_NAMES_BY_ID[providerId] ?? null;
}
