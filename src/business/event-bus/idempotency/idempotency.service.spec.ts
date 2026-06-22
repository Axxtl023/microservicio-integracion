import { IdempotencyService, IdempotencyKey, IdempotencyRecord } from './idempotency.service';

const makePrisma = () => ({
  integration_idempotency: {
    findUnique: jest.fn(),
  },
});

const KEY: IdempotencyKey = {
  reservaId: 'res-1',
  itemId: 'item-1',
  providerId: '11111111-0001-4000-8000-000000000001',
  operation: 'CREATE',
};

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new IdempotencyService(prisma as any);
  });

  describe('find', () => {
    it('returns null when no record exists for the composite key', async () => {
      prisma.integration_idempotency.findUnique.mockResolvedValue(null);
      const result = await service.find(KEY);
      expect(result).toBeNull();
    });

    it('queries by the full composite key (reservaId + itemId + providerId + operation)', async () => {
      prisma.integration_idempotency.findUnique.mockResolvedValue(null);
      await service.find(KEY);
      expect(prisma.integration_idempotency.findUnique).toHaveBeenCalledWith({
        where: {
          reserva_id_item_id_provider_id_operation: {
            reserva_id: 'res-1',
            item_id: 'item-1',
            provider_id: '11111111-0001-4000-8000-000000000001',
            operation: 'CREATE',
          },
        },
      });
    });

    it('returns a SUCCESS record with externalId and payload', async () => {
      prisma.integration_idempotency.findUnique.mockResolvedValue({
        status: 'SUCCESS',
        external_id: 'ext-abc',
        payload: { externalCode: 'CODE-1', status: 'CONFIRMED', raw: {} },
      });
      const result = await service.find(KEY);
      expect(result).toEqual({
        status: 'SUCCESS',
        externalId: 'ext-abc',
        payload: { externalCode: 'CODE-1', status: 'CONFIRMED', raw: {} },
      });
    });

    it('returns a FAILED record with null externalId', async () => {
      prisma.integration_idempotency.findUnique.mockResolvedValue({
        status: 'FAILED',
        external_id: null,
        payload: { error: { code: 'DOMAIN_ERROR', message: 'proveedor no disponible' } },
      });
      const result = await service.find(KEY);
      expect(result?.status).toBe('FAILED');
      expect(result?.externalId).toBeNull();
    });
  });

  describe('save', () => {
    it('inserts the idempotency record inside the transaction with all composite key fields', async () => {
      const tx = { integration_idempotency: { create: jest.fn().mockResolvedValue({}) } };
      const record: IdempotencyRecord = {
        status: 'SUCCESS',
        externalId: 'ext-1',
        payload: { externalCode: 'CODE-1', status: 'CONFIRMED', raw: {} },
      };

      await service.save(tx, KEY, record);

      expect(tx.integration_idempotency.create).toHaveBeenCalledWith({
        data: {
          reserva_id: 'res-1',
          item_id: 'item-1',
          provider_id: '11111111-0001-4000-8000-000000000001',
          operation: 'CREATE',
          status: 'SUCCESS',
          external_id: 'ext-1',
          payload: record.payload,
        },
      });
    });

    it('saves FAILED record with null externalId', async () => {
      const tx = { integration_idempotency: { create: jest.fn().mockResolvedValue({}) } };
      await service.save(tx, KEY, {
        status: 'FAILED',
        externalId: null,
        payload: { error: { code: 'DOMAIN_ERROR', message: 'no disponible' } },
      });
      const [call] = tx.integration_idempotency.create.mock.calls;
      expect(call[0].data.status).toBe('FAILED');
      expect(call[0].data.external_id).toBeNull();
    });

    it('propagates errors so the transaction rolls back on duplicate keys', async () => {
      const tx = {
        integration_idempotency: { create: jest.fn().mockRejectedValue(new Error('Unique constraint failed')) },
      };
      await expect(service.save(tx, KEY, { status: 'SUCCESS', externalId: 'e', payload: {} })).rejects.toThrow('Unique constraint');
    });
  });
});
