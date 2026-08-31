import { randomUUID } from 'node:crypto';

import type { InboxRepository, InventoryResult } from './inbox.repository.ts';
import { InsufficientStockError, type StockItem } from './woo-inventory.adapter.ts';

export type StockReservationRequested = {
  eventId: string;
  operationKey: string;
  payload: { orderId: string; items: StockItem[] };
};

export interface WooInventory {
  reserve(items: StockItem[]): Promise<void>;
}

export interface InventoryPublisher {
  publish(result: InventoryResult): Promise<void>;
}

export class InventoryService {
  private readonly inFlight = new Map<string, Promise<{ result: InventoryResult; duplicate: boolean }>>();

  constructor(
    private readonly inbox: InboxRepository,
    private readonly inventory: WooInventory,
    private readonly publisher: InventoryPublisher,
  ) {}

  handle(command: StockReservationRequested): Promise<{ result: InventoryResult; duplicate: boolean }> {
    const pending = this.inFlight.get(command.eventId);
    if (pending) return pending;
    const processing = this.process(command).finally(() => this.inFlight.delete(command.eventId));
    this.inFlight.set(command.eventId, processing);
    return processing;
  }

  private async process(command: StockReservationRequested) {
    const previous = await this.inbox.find(command.eventId);
    if (previous) return { result: previous, duplicate: true };

    logStage(command.eventId, 'reserving');
    const result = await this.reserve(command);
    logStage(command.eventId, 'reserved');
    if (!(await this.inbox.record(command.eventId, result))) {
      const stored = await this.inbox.find(command.eventId);
      if (stored) return { result: stored, duplicate: true };
      throw new Error('Inventory inbox record was not persisted');
    }
    logStage(command.eventId, 'persisted');
    await this.publisher.publish(result);
    logStage(command.eventId, 'published');
    return { result, duplicate: false };
  }

  private async reserve(command: StockReservationRequested): Promise<InventoryResult> {
    try {
      await this.inventory.reserve(command.payload.items);
      return {
        eventId: randomUUID(), eventType: 'stock.reserved', eventVersion: 'v1',
        operationKey: command.operationKey, occurredAt: new Date().toISOString(),
        payload: { orderId: command.payload.orderId, reservationId: command.operationKey },
      };
    } catch (error) {
      if (!(error instanceof InsufficientStockError)) throw error;
      return {
        eventId: randomUUID(), eventType: 'stock.reservation-failed', eventVersion: 'v1',
        operationKey: command.operationKey, occurredAt: new Date().toISOString(),
        payload: { orderId: command.payload.orderId, reason: 'INSUFFICIENT_STOCK' },
      };
    }
  }
}

function logStage(eventId: string, stage: string): void {
  console.info(JSON.stringify({ component: 'stock-worker', eventId, stage }));
}
