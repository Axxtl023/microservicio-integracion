import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica si un mensaje ya ha sido procesado.
   */
  async isProcessed(eventId: string): Promise<boolean> {
    const row = await this.prisma.processed_messages.findUnique({
      where: { event_id: eventId },
    });
    return row !== null;
  }

  /**
   * Inserta el mensaje en processed_messages dentro de una transacción.
   */
  async markProcessedTx(tx: any, eventId: string, eventType: string): Promise<void> {
    await tx.processed_messages.create({
      data: {
        event_id: eventId,
        event_type: eventType,
      },
    });
  }

  /**
   * Limpieza semanal: elimina mensajes procesados >30 días.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldMessages(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const { count } = await this.prisma.processed_messages.deleteMany({
      where: { processed_at: { lt: cutoff } },
    });

    if (count > 0) {
      this.logger.log(
        `[inbox] Limpieza: ${count} mensajes procesados eliminados (>30 días)`,
      );
    }
  }
}
