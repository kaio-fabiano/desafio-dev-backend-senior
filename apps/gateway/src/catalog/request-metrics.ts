export type CatalogRequestMetrics = {
  calls: number;
  batches: number[];
};

export function createCatalogRequestMetrics(): CatalogRequestMetrics {
  return { calls: 0, batches: [] };
}
