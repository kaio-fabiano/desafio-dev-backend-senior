export class SupplierOwnershipError extends Error {}

export function assertProductOwnership(
  authenticatedSupplierCompanyId: string | undefined,
  productSupplierCompanyId: string,
) {
  if (
    !authenticatedSupplierCompanyId ||
    authenticatedSupplierCompanyId !== productSupplierCompanyId
  ) {
    throw new SupplierOwnershipError('Product belongs to another supplier company');
  }
}
