import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RabbitMQModule, MessageHandlerErrorBehavior } from '@golevelup/nestjs-rabbitmq';
import { EXCHANGES } from './event-types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OutboxService } from './outbox/outbox.service';
import { OutboxPublisherService } from './outbox/outbox-publisher.service';
import { InboxService } from './inbox/inbox.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { MetricsService } from '../../common/observability/metrics.service';

/**
 * Infraestructura del Event Bus.
 *
 * Provee Outbox/Inbox/Idempotency/Metrics + el cliente Prisma de la BD dedicada
 * (postgres-eventbus, puerto 5433). NO incluye consumers — los consumers se
 * registran en sus propios módulos (o en app.module) e inyectan los clients
 * de proveedor existentes.
 *
 * `@Global` para que los consumers puedan inyectar OutboxService, InboxService,
 * IdempotencyService y MetricsService sin re-importar este módulo en cada feature.
 */
@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    RabbitMQModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.RABBITMQ_URL ?? 'amqp://admin:admin@localhost:5672',
        connectionInitOptions: { wait: false },
        connectionManagerOptions: {
          heartbeatIntervalInSeconds: 15,
          reconnectTimeInSeconds: 5,
        },
        prefetchCount: Number(process.env.RABBITMQ_PREFETCH ?? 10),
        // NACK sin requeue → el mensaje va a DLX en vez de hacer loop infinito.
        // Aplica cuando el handler tira una excepción no capturada; los errores
        // de dominio/infra capturados en los consumers hacen ACK explícito.
        defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
        exchanges: [
          { name: EXCHANGES.INTEGRATION_COMMANDS, type: 'topic', options: { durable: true } },
          { name: EXCHANGES.INTEGRATION_EVENTS, type: 'topic', options: { durable: true } },
          { name: EXCHANGES.INTEGRATION_DLX, type: 'topic', options: { durable: true } },
        ],
      }),
    }),
  ],
  providers: [
    PrismaService,
    OutboxService,
    OutboxPublisherService,
    InboxService,
    IdempotencyService,
    MetricsService,
  ],
  exports: [
    RabbitMQModule,
    PrismaService,
    OutboxService,
    InboxService,
    IdempotencyService,
    MetricsService,
  ],
})
export class EventBusModule {}
