import type { PaymentMethod } from './checkout.types.ts';

export type { PaymentMethod } from './checkout.types.ts';

export type WooCheckoutSession = {
  cartToken?: string;
  wooSession?: string;
  cookie?: string;
};

export type WooCartSnapshot = {
  items: Array<{ id: number; quantity: number }>;
  totals: {
    total_price: string;
    currency_minor_unit: number;
    currency_code: string;
  };
};

export type WooCheckoutOrder = {
  id: string;
  cartSnapshot: WooCartSnapshot;
};
export type WooCheckoutInput = {
  subject: string;
  reference: string;
  paymentMethod: PaymentMethod;
  session?: WooCheckoutSession;
};

export interface WooCheckoutPort {
  findByReference(input: WooCheckoutInput): Promise<WooCheckoutOrder | null>;
  createOrFind(input: WooCheckoutInput): Promise<WooCheckoutOrder>;
}
