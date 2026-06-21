-- Migración inicial V2 event-bus. Idempotente — segura para correr múltiples veces.
-- BD: integracion_eventbus (Postgres local en docker-compose.dev.yml).
-- Tablas: event_outbox (publicación), processed_messages (idempotencia mensaje),
-- integration_idempotency (idempotencia negocio por reserva+item+provider+op).

CREATE TABLE IF NOT EXISTS "event_outbox" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id"       UUID NOT NULL,
    "event_type"     VARCHAR(100) NOT NULL,
    "exchange"       VARCHAR(100) NOT NULL,
    "routing_key"    VARCHAR(100) NOT NULL,
    "payload"        JSONB NOT NULL,
    "correlation_id" UUID,
    "aggregate_id"   VARCHAR(100),
    "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "published_at"   TIMESTAMPTZ(6),
    "attempts"       INTEGER NOT NULL DEFAULT 0,
    "last_error"     TEXT,
    CONSTRAINT "event_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_outbox_event_id_key" ON "event_outbox"("event_id");
CREATE INDEX IF NOT EXISTS "idx_event_outbox_unpublished" ON "event_outbox"("created_at") WHERE "published_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_event_outbox_correlation" ON "event_outbox"("correlation_id");
CREATE INDEX IF NOT EXISTS "idx_event_outbox_aggregate" ON "event_outbox"("aggregate_id");

CREATE TABLE IF NOT EXISTS "processed_messages" (
    "event_id"     UUID NOT NULL,
    "event_type"   VARCHAR(100) NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "processed_messages_pkey" PRIMARY KEY ("event_id")
);

CREATE TABLE IF NOT EXISTS "integration_idempotency" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "reserva_id"  UUID NOT NULL,
    "item_id"     VARCHAR(100) NOT NULL,
    "provider_id" UUID NOT NULL,
    "operation"   VARCHAR(50) NOT NULL,
    "external_id" VARCHAR(255),
    "status"      VARCHAR(20) NOT NULL,
    "payload"     JSONB NOT NULL,
    "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "integration_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_integration_idempotency_key"
    ON "integration_idempotency"("reserva_id", "item_id", "provider_id", "operation");
CREATE INDEX IF NOT EXISTS "idx_integration_idempotency_reserva"
    ON "integration_idempotency"("reserva_id");
