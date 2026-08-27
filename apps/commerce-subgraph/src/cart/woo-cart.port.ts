export type WooCart = Record<string, unknown> & { subject: string };

export type AddCartItem = {
  productId: number;
  quantity: number;
};

export type RemoveCartItem = {
  itemKey: string;
  quantity: number;
};

export type WooCartPort = {
  addItem(subject: string, input: AddCartItem): Promise<WooCart>;
  removeItem(subject: string, input: RemoveCartItem): Promise<WooCart>;
};
