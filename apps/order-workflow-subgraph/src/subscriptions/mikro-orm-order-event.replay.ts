import type { MikroORM } from '@mikro-orm/core';

import type { OrderEventPayload } from './order-event-broker.ts';
import type { OrderEventReplay } from './order-events.subscription.ts';

export class MikroOrmOrderEventReplay implements OrderEventReplay {
  constructor(private readonly orm: MikroORM) {}

  async latest(
    subject: string,
    operationKey: string,
  ): Promise<OrderEventPayload | null> {
    const rows = await this.rows(
      `select operation."operation_key", workflow."woo_order_id",
              workflow."state", workflow."pix_code", workflow."updated_at", workflow."version",
              operation."subject"
         from "order_workflow_checkout_operation" operation
         join "order_workflow_order_workflow" workflow
           on workflow."checkout_operation_id" = operation."id"
        where operation."subject" = ? and operation."operation_key" = ?
        limit 1`,
      [subject, operationKey],
    );
    return rows[0] ? payload(rows[0]) : null;
  }

  async byWorkflowId(workflowId: string) {
    const rows = await this.rows(
      `select operation."operation_key", workflow."woo_order_id",
              workflow."state", workflow."pix_code", workflow."updated_at", workflow."version",
              operation."subject"
         from "order_workflow_checkout_operation" operation
         join "order_workflow_order_workflow" workflow
           on workflow."checkout_operation_id" = operation."id"
        where workflow."id" = ?
        limit 1`,
      [workflowId],
    );
    const row = rows[0];
    return row
      ? {
          subject: row.subject,
          operationKey: row.operation_key,
          payload: payload(row),
        }
      : null;
  }

  private rows(sql: string, parameters: string[]) {
    return this.orm.em
      .fork()
      .getConnection()
      .execute(sql, parameters) as Promise<
      Array<{
        operation_key: string;
        pix_code?: string;
        state: string;
        subject: string;
        updated_at: Date | string;
        version: number;
        woo_order_id: string;
      }>
    >;
  }
}

function payload(row: {
  operation_key: string;
  pix_code?: string;
  state: string;
  updated_at: Date | string;
  version: number;
  woo_order_id: string;
}): OrderEventPayload {
  return {
    eventTime: new Date(row.updated_at).toISOString(),
    operationKey: row.operation_key,
    orderId: row.woo_order_id,
    state: row.state,
    version: row.version,
    ...(row.pix_code ? { pixCode: row.pix_code } : {}),
  };
}
