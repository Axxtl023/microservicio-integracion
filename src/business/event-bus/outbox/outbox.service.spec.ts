import { OutboxService } from './outbox.service';
import { wrap } from '../envelope';

const makeTx = () => ({
  event_outbox: { create: jest.fn().mockResolvedValue({}) },
});

describe('OutboxService', () => {
  const service = new OutboxService();

  describe('save', () => {
    it('creates an event_outbox row with all required fields', async () => {
      const tx = makeTx();
      const envelope = wrap('integration.reservation.created', { reservaId: 'res-1', itemId: 'item-1' }, {
        correlationId: 'corr-1',
        causationId: 'evt-0',
        source: 'integracion',
      });

      await service.save(tx, 'integration.events', 'integration.reservation.created', envelope);

      expect(tx.event_outbox.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          event_id: envelope.eventId,
          event_type: 'integration.reservation.created',
          exchange: 'integration.events',
          routing_key: 'integration.reservation.created',
          correlation_id: 'corr-1',
          payload: envelope,
        }),
      });
    });

    it('uses reservaId as aggregate_id when payload has reservaId', async () => {
      const tx = makeTx();
      const envelope = wrap('e', { reservaId: 'res-99', itemId: 'item-1' }, { correlationId: 'c' });
      await service.save(tx, 'exch', 'key', envelope);
      const [call] = tx.event_outbox.create.mock.calls;
      expect(call[0].data.aggregate_id).toBe('res-99');
    });

    it('falls back to itemId when payload has no reservaId', async () => {
      const tx = makeTx();
      const envelope = wrap('e', { itemId: 'item-42' }, { correlationId: 'c' });
      await service.save(tx, 'exch', 'key', envelope);
      const [call] = tx.event_outbox.create.mock.calls;
      expect(call[0].data.aggregate_id).toBe('item-42');
    });

    it('sets aggregate_id to null when payload has neither reservaId nor itemId', async () => {
      const tx = makeTx();
      const envelope = wrap('e', {}, { correlationId: 'c' });
      await service.save(tx, 'exch', 'key', envelope);
      const [call] = tx.event_outbox.create.mock.calls;
      expect(call[0].data.aggregate_id).toBeNull();
    });
  });
});
