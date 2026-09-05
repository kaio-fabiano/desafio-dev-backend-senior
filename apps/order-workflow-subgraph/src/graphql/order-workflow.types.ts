import type { PaymentMethod } from '../checkout/checkout.types.ts';
import type { CheckoutCommandData } from '../checkout/command-hash.ts';
import type { WooCheckoutSession } from '../checkout/woo-checkout.port.ts';
import type { OrderWorkflow } from '../persistence/entities/order-workflow.entity.ts';

export interface CheckoutInput extends CheckoutCommandData {
  operationKey: string;
}

export type CheckoutOperationView = {
  id: string;
  operationKey: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
};

export type OrderWorkflowOrder = {
  __typename: 'Order';
  id: string;
  wooOrderId: string;
  paymentMethod: PaymentMethod;
  workflow: Pick<OrderWorkflow, 'state'>;
  pixCode?: string;
};

export interface OrderWorkflowOperations {
  checkout(
    subject: string,
    input: CheckoutInput,
    session?: WooCheckoutSession,
  ): Promise<OrderWorkflowOrder>;
  findWorkflow(
    subject: string,
    wooOrderId: string,
  ): Promise<OrderWorkflow | null>;
  findCheckout(
    subject: string,
    id: string,
  ): Promise<CheckoutOperationView | null>;
}
