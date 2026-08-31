import { InventoryService, type StockReservationRequested } from './inventory/inventory.service.ts';
import type { InboxRepository } from './inventory/inbox.repository.ts';
import type { WooInventory } from './inventory/inventory.service.ts';
import type { InventoryPublisher } from './inventory/inventory.service.ts';

export function createInventoryWorker({
  inbox,
  inventory,
  publisher,
}: {
  inbox: InboxRepository;
  inventory: WooInventory;
  publisher: InventoryPublisher;
}) {
  const service = new InventoryService(inbox, inventory, publisher);
  return {
    async consume(
      event: StockReservationRequested,
      acknowledge: () => Promise<void>,
    ): Promise<void> {
      await service.handle(event);
      await acknowledge();
    },
  };
}
