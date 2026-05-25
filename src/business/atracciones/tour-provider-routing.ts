// UUIDs deben coincidir EXACTAMENTE con la tabla `proveedores` de reservas-booking.
// Aplicar seed en Supabase antes de habilitar estos proveedores.

export const TOUR_PROVIDER_IDS = {
  TERRAQUEST: 'bbbbbbbb-0011-4000-8000-000000000011',
  VENTURO:    'cccccccc-0012-4000-8000-000000000012',
  CATS:       'dddddddd-0013-4000-8000-000000000013',
  NEXTSTOP:   'eeeeeeee-0014-4000-8000-000000000014',
} as const;

export type TourProviderKey = keyof typeof TOUR_PROVIDER_IDS;

export const TOUR_PROVIDER_NAMES_BY_ID: Record<string, TourProviderKey> = {
  [TOUR_PROVIDER_IDS.TERRAQUEST]: 'TERRAQUEST',
  [TOUR_PROVIDER_IDS.VENTURO]:    'VENTURO',
  [TOUR_PROVIDER_IDS.CATS]:       'CATS',
  [TOUR_PROVIDER_IDS.NEXTSTOP]:   'NEXTSTOP',
};

export function resolveTourProvider(providerId: string): TourProviderKey | null {
  return TOUR_PROVIDER_NAMES_BY_ID[providerId] ?? null;
}
