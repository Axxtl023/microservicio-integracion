// Mapeo estable UUID → nombre de proveedor para hoteles.
// Los UUIDs coinciden EXACTAMENTE con la tabla proveedores de reservas-booking.

export const HOTEL_PROVIDER_IDS = {
  LOCUS:         'aaaaaaaa-0001-4000-8000-000000000001',
  ALOJA_EXPRESS: 'aaaaaaaa-0002-4000-8000-000000000002',
  HOUSING_PLACE: 'aaaaaaaa-0003-4000-8000-000000000003',
  HOMIYA:        'aaaaaaaa-0004-4000-8000-000000000004',
  RODRIGOS:      'aaaaaaaa-0005-4000-8000-000000000005',
} as const;

export type HotelProviderKey = keyof typeof HOTEL_PROVIDER_IDS;

export const HOTEL_PROVIDER_NAMES_BY_ID: Record<string, HotelProviderKey> = {
  [HOTEL_PROVIDER_IDS.LOCUS]:         'LOCUS',
  [HOTEL_PROVIDER_IDS.ALOJA_EXPRESS]: 'ALOJA_EXPRESS',
  [HOTEL_PROVIDER_IDS.HOUSING_PLACE]: 'HOUSING_PLACE',
  [HOTEL_PROVIDER_IDS.HOMIYA]:        'HOMIYA',
  [HOTEL_PROVIDER_IDS.RODRIGOS]:      'RODRIGOS',
};

export function resolveHotelProvider(providerId: string): HotelProviderKey | null {
  return HOTEL_PROVIDER_NAMES_BY_ID[providerId] ?? null;
}
