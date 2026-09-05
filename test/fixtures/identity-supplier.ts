export class SupplierOwnershipError extends Error {}

export function assertSupplierProductOwnership(
  authenticatedSupplierCompanyId: string | undefined,
  productSupplierCompanyId: string,
) {
  if (
    !authenticatedSupplierCompanyId ||
    authenticatedSupplierCompanyId !== productSupplierCompanyId
  ) {
    throw new SupplierOwnershipError('Product belongs to another supplier');
  }
}

export type SupplierProductPort = {
  findSupplierCompanyId(productId: string): Promise<string>;
  remove(productId: string): Promise<void>;
  update(productId: string, input: unknown): Promise<void>;
};

export class OwnedProductMutations {
  constructor(private readonly products: SupplierProductPort) {}

  async update(
    authenticatedSupplierCompanyId: string | undefined,
    productId: string,
    input: unknown,
  ) {
    assertSupplierProductOwnership(
      authenticatedSupplierCompanyId,
      await this.products.findSupplierCompanyId(productId),
    );
    await this.products.update(productId, input);
  }

  async remove(
    authenticatedSupplierCompanyId: string | undefined,
    productId: string,
  ) {
    assertSupplierProductOwnership(
      authenticatedSupplierCompanyId,
      await this.products.findSupplierCompanyId(productId),
    );
    await this.products.remove(productId);
  }
}
