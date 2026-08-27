import type { AuthContext } from '../../../gateway/src/auth/auth-context.ts';
import type { CartService } from '../cart/cart.service.ts';

type CheckoutInput = { operationKey: string; paymentMethod: 'PIX' | 'CARD' };
type OrderReference = { wooOrderId: string };

export class CommerceResolver<Cart, Order, Workflow> {
  constructor(
    private readonly cart: Pick<CartService, 'addItem' | 'removeItem'>,
    private readonly runCheckout: (subject: string, input: CheckoutInput) => Promise<Order>,
    private readonly findWorkflow: (wooOrderId: string) => Promise<Workflow | null>,
  ) {}

  addToCart(context: AuthContext, productId: string, quantity: number) {
    return this.cart.addItem(context.subject, { productId: Number(productId), quantity }) as Promise<Cart>;
  }

  removeFromCart(context: AuthContext, productId: string, quantity: number) {
    return this.cart.removeItem(context.subject, { itemKey: productId, quantity }) as Promise<Cart>;
  }

  checkout(context: AuthContext, input: CheckoutInput) {
    return this.runCheckout(context.subject, input);
  }

  workflow(order: OrderReference) {
    return this.findWorkflow(order.wooOrderId);
  }
}
