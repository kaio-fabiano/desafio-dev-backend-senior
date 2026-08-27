import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assertProductOwnership,
  SupplierOwnershipError,
} from '../apps/identity-subgraph/src/supplier/product-ownership.ts';

test('AC-030: A different supplier is rejected @spec:AC-030', () => {
  const product = { id: 'product-1', supplierCompanyId: 'supplier-a', name: 'Original' };

  assert.throws(
    () => assertProductOwnership('supplier-b', product.supplierCompanyId),
    SupplierOwnershipError,
  );
  assert.equal(product.name, 'Original');
  assert.doesNotThrow(() =>
    assertProductOwnership('supplier-a', product.supplierCompanyId),
  );
});
