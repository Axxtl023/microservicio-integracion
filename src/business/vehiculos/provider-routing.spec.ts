import {
  VEHICLE_PROVIDER_IDS,
  VEHICLE_PROVIDER_NAMES_BY_ID,
  resolveVehicleProvider,
} from './provider-routing';
import {
  HOTEL_PROVIDER_IDS,
  HOTEL_PROVIDER_NAMES_BY_ID,
  resolveHotelProvider,
} from '../hoteles/hotel-provider-routing';
import {
  FLIGHT_PROVIDER_IDS,
  FLIGHT_PROVIDER_NAMES_BY_ID,
  resolveFlightProvider,
} from '../vuelos/flight-provider-routing';
import {
  TOUR_PROVIDER_IDS,
  TOUR_PROVIDER_NAMES_BY_ID,
  resolveTourProvider,
} from '../atracciones/tour-provider-routing';

// These UUID-to-key maps are the ground truth for the V2 routing.
// A regression here means reservas-booking published a command with the wrong UUID,
// or the Supabase seed is out of sync — both scenarios corrupt bookings silently.

describe('VEHICLE provider routing', () => {
  it.each([
    ['URBANCAR', '11111111-0001-4000-8000-000000000001'],
    ['RENTCAR', '22222222-0002-4000-8000-000000000002'],
    ['RENTWHEELS', '33333333-0003-4000-8000-000000000003'],
    ['DRIVEX', '44444444-0004-4000-8000-000000000004'],
    ['ZENITH_DRIVE', '55555555-0005-4000-8000-000000000005'],
  ])('VEHICLE_PROVIDER_IDS.%s === "%s"', (key, uuid) => {
    expect(VEHICLE_PROVIDER_IDS[key as keyof typeof VEHICLE_PROVIDER_IDS]).toBe(uuid);
  });

  it('resolveVehicleProvider returns correct key for each UUID', () => {
    expect(resolveVehicleProvider('11111111-0001-4000-8000-000000000001')).toBe('URBANCAR');
    expect(resolveVehicleProvider('22222222-0002-4000-8000-000000000002')).toBe('RENTCAR');
    expect(resolveVehicleProvider('33333333-0003-4000-8000-000000000003')).toBe('RENTWHEELS');
    expect(resolveVehicleProvider('44444444-0004-4000-8000-000000000004')).toBe('DRIVEX');
    expect(resolveVehicleProvider('55555555-0005-4000-8000-000000000005')).toBe('ZENITH_DRIVE');
  });

  it('resolveVehicleProvider returns null for unknown UUID', () => {
    expect(resolveVehicleProvider('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('VEHICLE_PROVIDER_NAMES_BY_ID is the inverse of VEHICLE_PROVIDER_IDS', () => {
    for (const [key, uuid] of Object.entries(VEHICLE_PROVIDER_IDS)) {
      expect(VEHICLE_PROVIDER_NAMES_BY_ID[uuid]).toBe(key);
    }
  });
});

describe('HOTEL provider routing', () => {
  it.each([
    ['LOCUS', 'aaaaaaaa-0001-4000-8000-000000000001'],
    ['ALOJA_EXPRESS', 'aaaaaaaa-0002-4000-8000-000000000002'],
    ['HOUSING_PLACE', 'aaaaaaaa-0003-4000-8000-000000000003'],
    ['HOMIYA', 'aaaaaaaa-0004-4000-8000-000000000004'],
    ['RODRIGOS', 'aaaaaaaa-0005-4000-8000-000000000005'],
  ])('HOTEL_PROVIDER_IDS.%s === "%s"', (key, uuid) => {
    expect(HOTEL_PROVIDER_IDS[key as keyof typeof HOTEL_PROVIDER_IDS]).toBe(uuid);
  });

  it('resolveHotelProvider returns correct key for each UUID', () => {
    expect(resolveHotelProvider('aaaaaaaa-0001-4000-8000-000000000001')).toBe('LOCUS');
    expect(resolveHotelProvider('aaaaaaaa-0002-4000-8000-000000000002')).toBe('ALOJA_EXPRESS');
    expect(resolveHotelProvider('aaaaaaaa-0003-4000-8000-000000000003')).toBe('HOUSING_PLACE');
    expect(resolveHotelProvider('aaaaaaaa-0004-4000-8000-000000000004')).toBe('HOMIYA');
    expect(resolveHotelProvider('aaaaaaaa-0005-4000-8000-000000000005')).toBe('RODRIGOS');
  });

  it('resolveHotelProvider returns null for unknown UUID', () => {
    expect(resolveHotelProvider('ffffffff-ffff-ffff-ffff-ffffffffffff')).toBeNull();
  });

  it('HOTEL_PROVIDER_NAMES_BY_ID is the inverse of HOTEL_PROVIDER_IDS', () => {
    for (const [key, uuid] of Object.entries(HOTEL_PROVIDER_IDS)) {
      expect(HOTEL_PROVIDER_NAMES_BY_ID[uuid]).toBe(key);
    }
  });
});

describe('FLIGHT provider routing', () => {
  it.each([
    ['VUELOSAPP', 'ffffffff-0015-4000-8000-000000000015'],
    ['AEROWILLY', '12121212-0016-4000-8000-000000000016'],
    ['AEROCORE', '34343434-0017-4000-8000-000000000017'],
    ['SKYBOOK', '56565656-0018-4000-8000-000000000018'],
  ])('FLIGHT_PROVIDER_IDS.%s === "%s"', (key, uuid) => {
    expect(FLIGHT_PROVIDER_IDS[key as keyof typeof FLIGHT_PROVIDER_IDS]).toBe(uuid);
  });

  it('resolveFlightProvider returns correct key for each UUID', () => {
    expect(resolveFlightProvider('ffffffff-0015-4000-8000-000000000015')).toBe('VUELOSAPP');
    expect(resolveFlightProvider('12121212-0016-4000-8000-000000000016')).toBe('AEROWILLY');
    expect(resolveFlightProvider('34343434-0017-4000-8000-000000000017')).toBe('AEROCORE');
    expect(resolveFlightProvider('56565656-0018-4000-8000-000000000018')).toBe('SKYBOOK');
  });

  it('resolveFlightProvider returns null for unknown UUID', () => {
    expect(resolveFlightProvider('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('FLIGHT_PROVIDER_NAMES_BY_ID is the inverse of FLIGHT_PROVIDER_IDS', () => {
    for (const [key, uuid] of Object.entries(FLIGHT_PROVIDER_IDS)) {
      expect(FLIGHT_PROVIDER_NAMES_BY_ID[uuid]).toBe(key);
    }
  });
});

describe('TOUR provider routing', () => {
  it.each([
    ['TERRAQUEST', 'bbbbbbbb-0011-4000-8000-000000000011'],
    ['VENTURO', 'cccccccc-0012-4000-8000-000000000012'],
    ['CATS', 'dddddddd-0013-4000-8000-000000000013'],
    ['NEXTSTOP', 'eeeeeeee-0014-4000-8000-000000000014'],
  ])('TOUR_PROVIDER_IDS.%s === "%s"', (key, uuid) => {
    expect(TOUR_PROVIDER_IDS[key as keyof typeof TOUR_PROVIDER_IDS]).toBe(uuid);
  });

  it('resolveTourProvider returns correct key for each UUID', () => {
    expect(resolveTourProvider('bbbbbbbb-0011-4000-8000-000000000011')).toBe('TERRAQUEST');
    expect(resolveTourProvider('cccccccc-0012-4000-8000-000000000012')).toBe('VENTURO');
    expect(resolveTourProvider('dddddddd-0013-4000-8000-000000000013')).toBe('CATS');
    expect(resolveTourProvider('eeeeeeee-0014-4000-8000-000000000014')).toBe('NEXTSTOP');
  });

  it('resolveTourProvider returns null for unknown UUID', () => {
    expect(resolveTourProvider('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('TOUR_PROVIDER_NAMES_BY_ID is the inverse of TOUR_PROVIDER_IDS', () => {
    for (const [key, uuid] of Object.entries(TOUR_PROVIDER_IDS)) {
      expect(TOUR_PROVIDER_NAMES_BY_ID[uuid]).toBe(key);
    }
  });
});
