import type { CheckoutCommandData } from './command-hash.ts';

export interface WooOrder {
  id: string;
}

export interface CreateOrFindWooOrderInput extends CheckoutCommandData {
  subject: string;
  reference: string;
}

export interface WooOrderPort {
  createOrFind(input: CreateOrFindWooOrderInput): Promise<WooOrder>;
}
