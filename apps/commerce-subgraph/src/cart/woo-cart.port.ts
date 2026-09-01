export type WooCart = Record<string, unknown> & { subject: string };

export type AddCartItem = {
  productId: number;
  quantity: number;
};

export type RemoveCartItem = {
  itemKey: string;
  quantity: number;
};

export type WooCartSession = {
  cartToken?: string;
  wooSession?: string;
  cookie?: string;
};

export type WooCartPort = {
  get(subject: string, session?: WooCartSession): Promise<WooCart>;
  addItem(subject: string, input: AddCartItem): Promise<WooCart>;
  removeItem(subject: string, input: RemoveCartItem): Promise<WooCart>;
};
