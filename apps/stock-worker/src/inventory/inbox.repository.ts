export type InventoryResult = {
  eventId: string;
  eventType: 'stock.reserved' | 'stock.reservation-failed';
  eventVersion: 'v1';
  operationKey: string;
  occurredAt: string;
  payload:
    | { orderId: string; reservationId: string }
    | { orderId: string; reason: 'INSUFFICIENT_STOCK' };
};

export interface InboxRepository {
  find(eventId: string): Promise<InventoryResult | null>;
  record(eventId: string, result: InventoryResult): Promise<boolean>;
}

export interface SqlClient {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export class PostgresInboxRepository implements InboxRepository {
  constructor(private readonly database: SqlClient) {}

  async find(eventId: string): Promise<InventoryResult | null> {
    const { rows } = await this.database.query<{ result: InventoryResult }>(
      'select result from stock_worker_inbox where event_id = $1',
      [eventId],
    );
    return rows[0]?.result ?? null;
  }

  async record(eventId: string, result: InventoryResult): Promise<boolean> {
    const { rows } = await this.database.query<{ event_id: string }>(
      'insert into stock_worker_inbox (event_id, result) values ($1, $2::jsonb) on conflict (event_id) do nothing returning event_id',
      [eventId, JSON.stringify(result)],
    );
    return rows.length === 1;
  }
}
