import { wrap, isValidEnvelope } from './envelope';

describe('isValidEnvelope', () => {
  it('returns false for null', () => expect(isValidEnvelope(null)).toBe(false));
  it('returns false for non-object', () => expect(isValidEnvelope('string')).toBe(false));
  it('returns false when eventId is missing', () => {
    expect(isValidEnvelope({ eventType: 'e', correlationId: 'c', source: 's', timestamp: 't', payload: {} })).toBe(false);
  });
  it('returns false when correlationId is missing', () => {
    expect(isValidEnvelope({ eventId: 'e', eventType: 'e', source: 's', timestamp: 't', payload: {} })).toBe(false);
  });
  it('returns false when source is missing', () => {
    expect(isValidEnvelope({ eventId: 'e', eventType: 'e', correlationId: 'c', timestamp: 't', payload: {} })).toBe(false);
  });
  it('returns true for a valid envelope', () => {
    expect(isValidEnvelope({
      eventId: 'e-1', eventType: 'test.event', eventVersion: '1.0.0',
      correlationId: 'c-1', source: 'integracion', timestamp: new Date().toISOString(), payload: {},
    })).toBe(true);
  });
  it('returns true even when payload is null', () => {
    expect(isValidEnvelope({
      eventId: 'e-1', eventType: 't', correlationId: 'c', source: 's', timestamp: 't', payload: null,
    })).toBe(true);
  });
});

describe('wrap', () => {
  it('generates a unique eventId per call', () => {
    const a = wrap('t', {}, { correlationId: 'c' });
    const b = wrap('t', {}, { correlationId: 'c' });
    expect(a.eventId).not.toBe(b.eventId);
  });

  it('forwards causationId when provided', () => {
    const env = wrap('t', {}, { correlationId: 'c', causationId: 'cause-1' });
    expect(env.causationId).toBe('cause-1');
  });

  it('defaults source to integracion', () => {
    const env = wrap('t', {}, { correlationId: 'c' });
    expect(env.source).toBe('integracion');
  });

  it('allows overriding source', () => {
    const env = wrap('t', {}, { correlationId: 'c', source: 'reservas-booking' });
    expect(env.source).toBe('reservas-booking');
  });

  it('sets timestamp to a valid ISO string', () => {
    const env = wrap('t', {}, { correlationId: 'c' });
    expect(() => new Date(env.timestamp)).not.toThrow();
    expect(env.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('embeds the payload', () => {
    const payload = { reservaId: 'r-1', itemId: 'i-1' };
    const env = wrap('t', payload, { correlationId: 'c' });
    expect(env.payload).toEqual(payload);
  });
});
