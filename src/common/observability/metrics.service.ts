import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private readonly processedEvents = new Map<string, number>();
  private readonly failedEvents = new Map<string, number>();
  private readonly publishedEvents = new Map<string, number>();

  incrementProcessed(eventType: string): void {
    this.processedEvents.set(
      eventType,
      (this.processedEvents.get(eventType) || 0) + 1,
    );
  }

  incrementFailed(eventType: string): void {
    this.failedEvents.set(
      eventType,
      (this.failedEvents.get(eventType) || 0) + 1,
    );
  }

  incrementPublished(eventType: string): void {
    this.publishedEvents.set(
      eventType,
      (this.publishedEvents.get(eventType) || 0) + 1,
    );
  }

  getMetricsText(): string {
    let text = '';

    text += '# HELP event_bus_processed_events_total Total number of successfully processed events\n';
    text += '# TYPE event_bus_processed_events_total counter\n';
    if (this.processedEvents.size === 0) {
      text += 'event_bus_processed_events_total{event_type="none",status="success"} 0\n';
    } else {
      for (const [eventType, count] of this.processedEvents.entries()) {
        text += `event_bus_processed_events_total{event_type="${eventType}",status="success"} ${count}\n`;
      }
    }

    text += '\n# HELP event_bus_failed_events_total Total number of failed event processing attempts\n';
    text += '# TYPE event_bus_failed_events_total counter\n';
    if (this.failedEvents.size === 0) {
      text += 'event_bus_failed_events_total{event_type="none",status="error"} 0\n';
    } else {
      for (const [eventType, count] of this.failedEvents.entries()) {
        text += `event_bus_failed_events_total{event_type="${eventType}",status="error"} ${count}\n`;
      }
    }

    text += '\n# HELP event_bus_published_events_total Total number of events published to RabbitMQ via Outbox\n';
    text += '# TYPE event_bus_published_events_total counter\n';
    if (this.publishedEvents.size === 0) {
      text += 'event_bus_published_events_total{event_type="none"} 0\n';
    } else {
      for (const [eventType, count] of this.publishedEvents.entries()) {
        text += `event_bus_published_events_total{event_type="${eventType}"} ${count}\n`;
      }
    }

    return text;
  }
}
