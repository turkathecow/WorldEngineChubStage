import { InventoryEntry, ItemDef } from "./types";

export function addInventoryItem(
  inventory: InventoryEntry[],
  itemId: string,
  quantity: number,
  itemCatalog: ItemDef[],
): InventoryEntry[] {
  const itemDef = itemCatalog.find((item) => item.id === itemId);
  if (!itemDef || quantity <= 0) {
    return inventory;
  }

  if (!itemDef.stackable) {
    return [
      ...inventory,
      ...Array.from({ length: quantity }, () => ({
        itemId,
        quantity: 1,
      })),
    ];
  }

  const existing = inventory.find((entry) => entry.itemId === itemId);
  if (!existing) {
    return [...inventory, { itemId, quantity }];
  }

  return inventory.map((entry) =>
    entry.itemId === itemId ? { ...entry, quantity: entry.quantity + quantity } : entry,
  );
}

export function removeInventoryItem(
  inventory: InventoryEntry[],
  itemId: string,
  quantity: number,
): InventoryEntry[] | null {
  const currentCount = inventory
    .filter((entry) => entry.itemId === itemId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  if (currentCount < quantity || quantity <= 0) {
    return null;
  }

  let remaining = quantity;
  const next: InventoryEntry[] = [];
  for (const entry of inventory) {
    if (entry.itemId !== itemId || remaining === 0) {
      next.push(entry);
      continue;
    }
    if (entry.quantity <= remaining) {
      remaining -= entry.quantity;
      continue;
    }
    next.push({ ...entry, quantity: entry.quantity - remaining });
    remaining = 0;
  }
  return next;
}

export function countInventoryItem(inventory: InventoryEntry[], itemId: string): number {
  return inventory
    .filter((entry) => entry.itemId === itemId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

export function formatInventoryHighlights(inventory: InventoryEntry[], itemCatalog: ItemDef[]): string[] {
  return inventory
    .map((entry) => {
      const item = itemCatalog.find((candidate) => candidate.id === entry.itemId);
      if (!item || !item.highlight) {
        return null;
      }
      return entry.quantity > 1 ? `${item.name} x${entry.quantity}` : item.name;
    })
    .filter((entry): entry is string => entry !== null)
    .slice(0, 6);
}
