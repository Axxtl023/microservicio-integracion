// Topología RabbitMQ de microservicio-integracion.
// Coordinar cualquier cambio con los responsables de reservas-booking y futuro
// gateway GraphQL antes de modificar nombres.

export const EXCHANGES = {
  INTEGRATION_COMMANDS: 'integration.commands',
  INTEGRATION_EVENTS: 'integration.events',
  INTEGRATION_DLX: 'integration.dlx',
} as const;

export const ROUTING_KEYS = {
  // Comandos que recibimos (publica reservas-booking)
  RESERVATION_CREATE_REQUESTED: 'integration.reservation.create.requested',
  RESERVATION_CONFIRM_REQUESTED: 'integration.reservation.confirm.requested',
  RESERVATION_CANCEL_REQUESTED: 'integration.reservation.cancel.requested',

  // Eventos que publicamos (consume reservas-booking)
  RESERVATION_CREATED: 'integration.reservation.created',
  RESERVATION_CREATE_FAILED: 'integration.reservation.create_failed',
  RESERVATION_CONFIRMED: 'integration.reservation.confirmed',
  RESERVATION_CONFIRM_FAILED: 'integration.reservation.confirm_failed',
  RESERVATION_CANCELLED: 'integration.reservation.cancelled',
  RESERVATION_CANCEL_FAILED: 'integration.reservation.cancel_failed',
} as const;

export const QUEUES = {
  CREATE_RESERVATION: 'integracion.create-reservation',
  CONFIRM_RESERVATION: 'integracion.confirm-reservation',
  CANCEL_RESERVATION: 'integracion.cancel-reservation',
} as const;

export type ProviderType = 'VEHICLE' | 'FLIGHT' | 'HOTEL' | 'TOUR';

// Payload shapes (consumidos) — espejo del proto BookingItem.
// El orquestador envía un mensaje por item — integracion NO batchea.

export interface CreateReservationCommand {
  reservaId: string;
  itemId: string; // detalle_reserva.id local del orquestador
  providerId: string;
  providerType: ProviderType;
  quantity: number;
  unitPrice: number;
  currency: string;
  metadata: Record<string, unknown>; // shape varía por type — ver CLAUDE.md
}

export interface ConfirmReservationCommand {
  reservaId: string;
  itemId: string;
  providerId: string;
  providerType: ProviderType;
  externalId: string; // id devuelto en create
}

export interface CancelReservationCommand {
  reservaId: string;
  itemId: string;
  providerId: string;
  providerType: ProviderType;
  externalId: string;
  motivo?: string;
}

// Payload shapes (publicados)

export interface ReservationCreatedEvent {
  reservaId: string;
  itemId: string;
  providerId: string;
  providerType: ProviderType;
  externalId: string;
  externalCode?: string;
  rawProviderResponse?: Record<string, unknown>;
}

export interface ReservationFailedEvent {
  reservaId: string;
  itemId: string;
  providerId: string;
  providerType: ProviderType;
  error: { code: string; message: string };
}

export interface ReservationConfirmedEvent {
  reservaId: string;
  itemId: string;
  providerId: string;
  externalId: string;
}

export interface ReservationCancelledEvent {
  reservaId: string;
  itemId: string;
  providerId: string;
  externalId: string;
}
