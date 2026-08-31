import { assertProductOwnership } from './product-ownership.ts';

export type SupplierProductPort = {
  findSupplierCompanyId(productId: string): Promise<string>;
  update(productId: string, input: Record<string, unknown>): Promise<unknown>;
  remove(productId: string): Promise<unknown>;
};

export class OwnedProductMutations {
  constructor(private readonly products: SupplierProductPort) {}

  async update(
    authenticatedSupplierCompanyId: string | undefined,
    productId: string,
    input: Record<string, unknown>,
  ) {
    assertProductOwnership(
      authenticatedSupplierCompanyId,
      await this.products.findSupplierCompanyId(productId),
    );
    return this.products.update(productId, input);
  }

  async remove(
    authenticatedSupplierCompanyId: string | undefined,
    productId: string,
  ) {
    assertProductOwnership(
      authenticatedSupplierCompanyId,
      await this.products.findSupplierCompanyId(productId),
    );
    return this.products.remove(productId);
  }
}
