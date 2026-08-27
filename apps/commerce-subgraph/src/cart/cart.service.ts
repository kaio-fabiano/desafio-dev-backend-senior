import type { AddCartItem, RemoveCartItem, WooCartPort } from './woo-cart.port.ts';

type UntrustedIdentity = {
  subject?: unknown;
};

export class CartInputError extends Error {
  readonly code = 'INVALID_CART_INPUT';
}

export class CartAuthorizationError extends Error {
  readonly code = 'CART_IDENTITY_NOT_ALLOWED';
}

export class CartService {
  constructor(private readonly cart: WooCartPort) {}

  addItem(subject: string, input: AddCartItem & UntrustedIdentity) {
    this.assertInput(subject, input);
    return this.cart.addItem(subject, input);
  }

  removeItem(subject: string, input: RemoveCartItem & UntrustedIdentity) {
    this.assertInput(subject, input);
    return this.cart.removeItem(subject, input);
  }

  private assertInput(subject: string, input: { quantity: number; subject?: unknown }) {
    if (!subject || Object.hasOwn(input, 'subject')) {
      throw new CartAuthorizationError('Cart identity must come from authentication');
    }
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
      throw new CartInputError('Cart quantity must be a positive integer');
    }
  }
}
