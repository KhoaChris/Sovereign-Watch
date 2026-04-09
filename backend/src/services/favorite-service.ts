import { getDb } from "../config/firebase";
import type { FavoriteEntry, FavoriteRecord } from "../shared";
import { nowIsoString } from "../utils/dates";
import { createEntityId } from "../utils/ids";
import { getProductById } from "./product-service";

const FAVORITES_COLLECTION = "favorites";

function createEmptyFavorites(userId: string): FavoriteRecord {
  return {
    id: userId,
    userId,
    items: [],
    updatedAt: nowIsoString(),
    count: 0,
  };
}

function normalizeFavorites(record: FavoriteRecord): FavoriteRecord {
  const items = [...record.items].sort((left, right) => right.addedAt.localeCompare(left.addedAt));

  return {
    ...record,
    items,
    count: items.length,
  };
}

async function getStoredFavorites(userId: string): Promise<FavoriteRecord> {
  const snapshot = await getDb().collection(FAVORITES_COLLECTION).doc(userId).get();

  if (!snapshot.exists) {
    const empty = createEmptyFavorites(userId);
    await getDb().collection(FAVORITES_COLLECTION).doc(userId).set(empty);
    return empty;
  }

  return normalizeFavorites(snapshot.data() as FavoriteRecord);
}

async function persistFavorites(record: FavoriteRecord): Promise<FavoriteRecord> {
  const normalized = normalizeFavorites({
    ...record,
    updatedAt: nowIsoString(),
  });

  await getDb().collection(FAVORITES_COLLECTION).doc(record.id).set(normalized);
  return normalized;
}

export async function getFavoriteRecord(userId: string): Promise<FavoriteRecord> {
  const stored = await getStoredFavorites(userId);
  const items: FavoriteEntry[] = await Promise.all(
    stored.items.map(async (item) => ({
      ...item,
      product: (await getProductById(item.productId)) ?? undefined,
    })),
  );

  return {
    ...stored,
    items: items.filter((item) => item.product),
    count: items.filter((item) => item.product).length,
  };
}

export async function addFavoriteProduct(userId: string, productId: string): Promise<FavoriteRecord> {
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("Product not found.");
  }

  const stored = await getStoredFavorites(userId);

  if (stored.items.some((item) => item.productId === productId)) {
    return getFavoriteRecord(userId);
  }

  await persistFavorites({
    ...stored,
    items: [
      {
        id: createEntityId(),
        productId,
        addedAt: nowIsoString(),
      },
      ...stored.items,
    ],
  });

  return getFavoriteRecord(userId);
}

export async function removeFavoriteProduct(userId: string, productId: string): Promise<FavoriteRecord> {
  const stored = await getStoredFavorites(userId);

  await persistFavorites({
    ...stored,
    items: stored.items.filter((item) => item.productId !== productId),
  });

  return getFavoriteRecord(userId);
}
