import {
  ProviderRouterService,
  ProviderNotSupportedError,
  MetadataInvalidError,
} from './provider-router.service';
import { VEHICLE_PROVIDER_IDS } from '../../vehiculos/provider-routing';
import { HOTEL_PROVIDER_IDS } from '../../hoteles/hotel-provider-routing';
import { FLIGHT_PROVIDER_IDS } from '../../vuelos/flight-provider-routing';
import { TOUR_PROVIDER_IDS } from '../../atracciones/tour-provider-routing';

// ── Mock client factories ─────────────────────────────────────────────────────

const VEHICLE_RESULT = { id: 'v-ext-1', status: 'CONFIRMED', codigoReserva: 'VH-001' };
const HOTEL_RESULT   = { id: 'h-ext-1', status: 'CONFIRMED', codigoReserva: 'HT-001' };
const FLIGHT_RESULT  = { id: 'f-ext-1', status: 'CONFIRMED', reservationCode: 'FL-001' };
const TOUR_RESULT    = { id: 't-ext-1', status: 'CONFIRMED', reservationCode: 'TR-001' };

const makeVehicleClient = () => ({
  crearReservaExterna: jest.fn().mockResolvedValue(VEHICLE_RESULT),
  confirmarReservaExterna: jest.fn().mockResolvedValue(VEHICLE_RESULT),
  cancelarReservaExterna: jest.fn().mockResolvedValue(VEHICLE_RESULT),
  verificarDisponibilidadExterna: jest.fn(),
});

const makeHotelClient = () => ({
  crearReservaHotel: jest.fn().mockResolvedValue(HOTEL_RESULT),
  confirmarReservaHotel: jest.fn().mockResolvedValue(HOTEL_RESULT),
  cancelarReservaHotel: jest.fn().mockResolvedValue(HOTEL_RESULT),
  verificarDisponibilidadHotel: jest.fn(),
});

const makeFlightClient = () => ({
  crearReservaVueloExterna: jest.fn().mockResolvedValue(FLIGHT_RESULT),
  confirmarReservaVueloExterna: jest.fn().mockResolvedValue(FLIGHT_RESULT),
  cancelarReservaVueloExterna: jest.fn().mockResolvedValue(FLIGHT_RESULT),
});

const makeTourClient = () => ({
  crearReservaAtraccionExterna: jest.fn().mockResolvedValue(TOUR_RESULT),
  confirmarReservaAtraccionExterna: jest.fn().mockResolvedValue(TOUR_RESULT),
  cancelarReservaAtraccionExterna: jest.fn().mockResolvedValue(TOUR_RESULT),
});

// ── Metadata helpers ──────────────────────────────────────────────────────────

const VEHICLE_META = {
  vehiculoId: 'veh-1',
  clienteId: 'cli-1',
  fechaInicio: '2026-07-01',
  fechaFin: '2026-07-05',
};

const HOTEL_META = {
  alojamientoId: 'aloj-1',
  habitacionId: 'hab-101',
  clienteId: 'cli-1',
  fechaInicio: '2026-08-01',
  fechaFin: '2026-08-05',
};

const FLIGHT_META = {
  flightClassId: 'class-eco-1',
  passengers: [{ firstName: 'Ana', lastName: 'Garcia', documentNumber: '12345678' }],
};

const TOUR_META = {
  slotId: 'slot-1',
  attractionId: 'attr-1',
  productOptionId: 'opt-1',
  contactName: 'Juan Perez',
  contactEmail: 'juan@test.com',
  passengers: [{ firstName: 'Juan', lastName: 'Perez', documentNumber: '99999' }],
};

// ── Router factory ────────────────────────────────────────────────────────────

interface Clients {
  urbancar: ReturnType<typeof makeVehicleClient>;
  rentcar: ReturnType<typeof makeVehicleClient>;
  rentwheels: ReturnType<typeof makeVehicleClient>;
  drivex: ReturnType<typeof makeVehicleClient>;
  zenithDrive: ReturnType<typeof makeVehicleClient>;
  locus: ReturnType<typeof makeHotelClient>;
  homiya: ReturnType<typeof makeHotelClient>;
  rodrigos: ReturnType<typeof makeHotelClient>;
  housingPlace: ReturnType<typeof makeHotelClient>;
  alojaExpress: ReturnType<typeof makeHotelClient>;
  vuelosApp: ReturnType<typeof makeFlightClient>;
  skybook: ReturnType<typeof makeFlightClient>;
  aeroWilly: ReturnType<typeof makeFlightClient>;
  aeroCore: ReturnType<typeof makeFlightClient>;
  terraQuest: ReturnType<typeof makeTourClient>;
  atraccionCats: ReturnType<typeof makeTourClient>;
  venturo: ReturnType<typeof makeTourClient>;
  nextStop: ReturnType<typeof makeTourClient>;
}

function buildRouter(): { router: ProviderRouterService; clients: Clients } {
  const clients: Clients = {
    urbancar: makeVehicleClient(),
    rentcar: makeVehicleClient(),
    rentwheels: makeVehicleClient(),
    drivex: makeVehicleClient(),
    zenithDrive: makeVehicleClient(),
    locus: makeHotelClient(),
    homiya: makeHotelClient(),
    rodrigos: makeHotelClient(),
    housingPlace: makeHotelClient(),
    alojaExpress: makeHotelClient(),
    vuelosApp: makeFlightClient(),
    skybook: makeFlightClient(),
    aeroWilly: makeFlightClient(),
    aeroCore: makeFlightClient(),
    terraQuest: makeTourClient(),
    atraccionCats: makeTourClient(),
    venturo: makeTourClient(),
    nextStop: makeTourClient(),
  };
  // Constructor order must match ProviderRouterService parameters
  const router = new ProviderRouterService(
    clients.urbancar as any,
    clients.rentcar as any,
    clients.rentwheels as any,
    clients.drivex as any,
    clients.zenithDrive as any,
    clients.locus as any,
    clients.homiya as any,
    clients.rodrigos as any,
    clients.housingPlace as any,
    clients.alojaExpress as any,
    clients.vuelosApp as any,
    clients.skybook as any,
    clients.aeroWilly as any,
    clients.aeroCore as any,
    clients.terraQuest as any,
    clients.atraccionCats as any,
    clients.venturo as any,
    clients.nextStop as any,
  );
  return { router, clients };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProviderRouterService.create', () => {
  describe('VEHICLE routing', () => {
    it('routes to UrbanCar and maps result correctly', async () => {
      const { router, clients } = buildRouter();
      const result = await router.create('VEHICLE', VEHICLE_PROVIDER_IDS.URBANCAR, VEHICLE_META);
      expect(clients.urbancar.crearReservaExterna).toHaveBeenCalledWith(expect.objectContaining({
        vehiculoId: 'veh-1',
        clienteId: 'cli-1',
        fechaInicio: '2026-07-01',
        fechaFin: '2026-07-05',
      }));
      expect(result).toEqual({
        externalId: VEHICLE_RESULT.id,
        externalCode: VEHICLE_RESULT.codigoReserva,
        status: VEHICLE_RESULT.status,
        raw: VEHICLE_RESULT,
      });
    });

    it('routes to RentCar by UUID', async () => {
      const { router, clients } = buildRouter();
      await router.create('VEHICLE', VEHICLE_PROVIDER_IDS.RENTCAR, VEHICLE_META);
      expect(clients.rentcar.crearReservaExterna).toHaveBeenCalled();
      expect(clients.urbancar.crearReservaExterna).not.toHaveBeenCalled();
    });

    it('throws ProviderNotSupportedError for unknown vehicle UUID', async () => {
      const { router } = buildRouter();
      await expect(router.create('VEHICLE', '00000000-dead-dead-dead-000000000000', VEHICLE_META))
        .rejects.toBeInstanceOf(ProviderNotSupportedError);
    });

    it('throws MetadataInvalidError when vehiculoId is missing', async () => {
      const { router } = buildRouter();
      const bad = { ...VEHICLE_META, vehiculoId: '' };
      await expect(router.create('VEHICLE', VEHICLE_PROVIDER_IDS.URBANCAR, bad))
        .rejects.toBeInstanceOf(MetadataInvalidError);
    });

    it('throws MetadataInvalidError when fechaInicio is missing', async () => {
      const { router } = buildRouter();
      const bad = { ...VEHICLE_META, fechaInicio: '' };
      await expect(router.create('VEHICLE', VEHICLE_PROVIDER_IDS.URBANCAR, bad))
        .rejects.toBeInstanceOf(MetadataInvalidError);
    });
  });

  describe('HOTEL routing', () => {
    it('routes to Locus and maps result correctly', async () => {
      const { router, clients } = buildRouter();
      const result = await router.create('HOTEL', HOTEL_PROVIDER_IDS.LOCUS, HOTEL_META);
      expect(clients.locus.crearReservaHotel).toHaveBeenCalledWith(expect.objectContaining({
        alojamientoId: 'aloj-1',
        habitacionId: 'hab-101',
        clienteId: 'cli-1',
        fechaInicio: '2026-08-01',
        fechaFin: '2026-08-05',
      }));
      expect(result.externalId).toBe(HOTEL_RESULT.id);
    });

    it('routes to Homiya by UUID', async () => {
      const { router, clients } = buildRouter();
      await router.create('HOTEL', HOTEL_PROVIDER_IDS.HOMIYA, HOTEL_META);
      expect(clients.homiya.crearReservaHotel).toHaveBeenCalled();
      expect(clients.locus.crearReservaHotel).not.toHaveBeenCalled();
    });

    it('throws ProviderNotSupportedError for unknown hotel UUID', async () => {
      const { router } = buildRouter();
      await expect(router.create('HOTEL', '00000000-dead-dead-dead-000000000000', HOTEL_META))
        .rejects.toBeInstanceOf(ProviderNotSupportedError);
    });

    it('throws MetadataInvalidError when habitacionId is missing', async () => {
      const { router } = buildRouter();
      const bad = { ...HOTEL_META, habitacionId: '' };
      await expect(router.create('HOTEL', HOTEL_PROVIDER_IDS.LOCUS, bad))
        .rejects.toBeInstanceOf(MetadataInvalidError);
    });
  });

  describe('FLIGHT routing', () => {
    it('routes to VuelosApp and maps result correctly', async () => {
      const { router, clients } = buildRouter();
      const result = await router.create('FLIGHT', FLIGHT_PROVIDER_IDS.VUELOSAPP, FLIGHT_META);
      expect(clients.vuelosApp.crearReservaVueloExterna).toHaveBeenCalledWith({
        flightClassId: 'class-eco-1',
        passengers: [expect.objectContaining({ firstName: 'Ana', lastName: 'Garcia', documentNumber: '12345678' })],
      });
      expect(result.externalId).toBe(FLIGHT_RESULT.id);
      expect(result.externalCode).toBe(FLIGHT_RESULT.reservationCode);
    });

    it('routes to SkyBook by UUID', async () => {
      const { router, clients } = buildRouter();
      await router.create('FLIGHT', FLIGHT_PROVIDER_IDS.SKYBOOK, FLIGHT_META);
      expect(clients.skybook.crearReservaVueloExterna).toHaveBeenCalled();
    });

    it('throws MetadataInvalidError when passengers array is empty', async () => {
      const { router } = buildRouter();
      const bad = { ...FLIGHT_META, passengers: [] };
      await expect(router.create('FLIGHT', FLIGHT_PROVIDER_IDS.VUELOSAPP, bad))
        .rejects.toBeInstanceOf(MetadataInvalidError);
    });

    it('throws MetadataInvalidError when flightClassId is missing', async () => {
      const { router } = buildRouter();
      const bad = { ...FLIGHT_META, flightClassId: '' };
      await expect(router.create('FLIGHT', FLIGHT_PROVIDER_IDS.VUELOSAPP, bad))
        .rejects.toBeInstanceOf(MetadataInvalidError);
    });
  });

  describe('TOUR routing', () => {
    it('routes to TerraQuest and maps result correctly', async () => {
      const { router, clients } = buildRouter();
      const result = await router.create('TOUR', TOUR_PROVIDER_IDS.TERRAQUEST, TOUR_META);
      expect(clients.terraQuest.crearReservaAtraccionExterna).toHaveBeenCalledWith(expect.objectContaining({
        slotId: 'slot-1',
        attractionId: 'attr-1',
        productOptionId: 'opt-1',
        contactName: 'Juan Perez',
        contactEmail: 'juan@test.com',
      }));
      expect(result.externalId).toBe(TOUR_RESULT.id);
    });

    it('routes to Venturo by UUID', async () => {
      const { router, clients } = buildRouter();
      await router.create('TOUR', TOUR_PROVIDER_IDS.VENTURO, TOUR_META);
      expect(clients.venturo.crearReservaAtraccionExterna).toHaveBeenCalled();
      expect(clients.terraQuest.crearReservaAtraccionExterna).not.toHaveBeenCalled();
    });

    it('throws MetadataInvalidError when slotId is missing', async () => {
      const { router } = buildRouter();
      const bad = { ...TOUR_META, slotId: '' };
      await expect(router.create('TOUR', TOUR_PROVIDER_IDS.TERRAQUEST, bad))
        .rejects.toBeInstanceOf(MetadataInvalidError);
    });

    it('throws MetadataInvalidError when contactEmail is missing', async () => {
      const { router } = buildRouter();
      const bad = { ...TOUR_META, contactEmail: '' };
      await expect(router.create('TOUR', TOUR_PROVIDER_IDS.TERRAQUEST, bad))
        .rejects.toBeInstanceOf(MetadataInvalidError);
    });
  });

  describe('unknown providerType', () => {
    it('throws MetadataInvalidError for unsupported type', async () => {
      const { router } = buildRouter();
      await expect(router.create('BOAT' as any, 'some-uuid', {}))
        .rejects.toBeInstanceOf(MetadataInvalidError);
    });
  });
});

describe('ProviderRouterService.confirm', () => {
  it('VEHICLE — calls confirmarReservaExterna with externalId', async () => {
    const { router, clients } = buildRouter();
    const result = await router.confirm('VEHICLE', VEHICLE_PROVIDER_IDS.URBANCAR, 'ext-1');
    expect(clients.urbancar.confirmarReservaExterna).toHaveBeenCalledWith('ext-1');
    expect(result.externalId).toBe(VEHICLE_RESULT.id);
  });

  it('HOTEL — calls confirmarReservaHotel with externalId', async () => {
    const { router, clients } = buildRouter();
    await router.confirm('HOTEL', HOTEL_PROVIDER_IDS.LOCUS, 'ext-1');
    expect(clients.locus.confirmarReservaHotel).toHaveBeenCalledWith('ext-1');
  });

  it('FLIGHT — calls confirmarReservaVueloExterna with externalId', async () => {
    const { router, clients } = buildRouter();
    await router.confirm('FLIGHT', FLIGHT_PROVIDER_IDS.VUELOSAPP, 'ext-1');
    expect(clients.vuelosApp.confirmarReservaVueloExterna).toHaveBeenCalledWith('ext-1');
  });

  it('TOUR — calls confirmarReservaAtraccionExterna with externalId', async () => {
    const { router, clients } = buildRouter();
    await router.confirm('TOUR', TOUR_PROVIDER_IDS.TERRAQUEST, 'ext-1');
    expect(clients.terraQuest.confirmarReservaAtraccionExterna).toHaveBeenCalledWith('ext-1');
  });

  it('throws ProviderNotSupportedError for unknown UUID', async () => {
    const { router } = buildRouter();
    await expect(router.confirm('VEHICLE', '00000000-dead-dead-dead-000000000000', 'ext-1'))
      .rejects.toBeInstanceOf(ProviderNotSupportedError);
  });

  it('throws MetadataInvalidError for unsupported providerType', async () => {
    const { router } = buildRouter();
    await expect(router.confirm('BOAT' as any, 'some-uuid', 'ext-1'))
      .rejects.toBeInstanceOf(MetadataInvalidError);
  });
});

describe('ProviderRouterService.cancel', () => {
  it('VEHICLE — calls cancelarReservaExterna with externalId and reason', async () => {
    const { router, clients } = buildRouter();
    await router.cancel('VEHICLE', VEHICLE_PROVIDER_IDS.URBANCAR, 'ext-1', 'cliente canceló');
    expect(clients.urbancar.cancelarReservaExterna).toHaveBeenCalledWith('ext-1', 'cliente canceló');
  });

  it('HOTEL — calls cancelarReservaHotel', async () => {
    const { router, clients } = buildRouter();
    await router.cancel('HOTEL', HOTEL_PROVIDER_IDS.RODRIGOS, 'ext-1');
    expect(clients.rodrigos.cancelarReservaHotel).toHaveBeenCalledWith('ext-1', undefined);
  });

  it('FLIGHT — calls cancelarReservaVueloExterna', async () => {
    const { router, clients } = buildRouter();
    await router.cancel('FLIGHT', FLIGHT_PROVIDER_IDS.AEROWILLY, 'ext-1');
    expect(clients.aeroWilly.cancelarReservaVueloExterna).toHaveBeenCalled();
  });

  it('TOUR — calls cancelarReservaAtraccionExterna', async () => {
    const { router, clients } = buildRouter();
    await router.cancel('TOUR', TOUR_PROVIDER_IDS.NEXTSTOP, 'ext-1');
    expect(clients.nextStop.cancelarReservaAtraccionExterna).toHaveBeenCalled();
  });

  it('throws ProviderNotSupportedError for unknown UUID', async () => {
    const { router } = buildRouter();
    await expect(router.cancel('HOTEL', '00000000-dead-dead-dead-000000000000', 'ext-1'))
      .rejects.toBeInstanceOf(ProviderNotSupportedError);
  });
});

describe('ProviderNotSupportedError', () => {
  it('has isDomainError = true and code = PROVIDER_NOT_SUPPORTED', () => {
    const err = new ProviderNotSupportedError('bad-uuid');
    expect(err.isDomainError).toBe(true);
    expect(err.code).toBe('PROVIDER_NOT_SUPPORTED');
    expect(err.message).toContain('bad-uuid');
  });
});

describe('MetadataInvalidError', () => {
  it('has isDomainError = true and code = METADATA_INVALID', () => {
    const err = new MetadataInvalidError('vehiculoId');
    expect(err.isDomainError).toBe(true);
    expect(err.code).toBe('METADATA_INVALID');
    expect(err.message).toContain('vehiculoId');
  });
});
