import type { AdminAiCatalogDraft } from "../shared";

export const ADMIN_CATALOG_DRAFTS_EVENT =
  "watchroom:admin-catalog-drafts-updated";

export const ADMIN_CATALOG_DRAFTS_STORAGE_KEY = "watchroom.adminCatalogDrafts";
export const MAX_STORED_ADMIN_CATALOG_DRAFTS = 200;

export function getAdminCatalogDraftKey(draft: AdminAiCatalogDraft): string {
  const leadSku = draft.variants[0]?.sku ?? "";

  return [draft.brandId, draft.reference, draft.name, leadSku]
    .join("|")
    .toLowerCase();
}

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readAdminCatalogDrafts(): AdminAiCatalogDraft[] {
  if (!canUseBrowserStorage()) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(ADMIN_CATALOG_DRAFTS_STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((draft): draft is AdminAiCatalogDraft => {
      return (
        typeof draft === "object" &&
        draft !== null &&
        "name" in draft &&
        "variants" in draft &&
        Array.isArray((draft as AdminAiCatalogDraft).variants)
      );
    });
  } catch {
    return [];
  }
}

export function saveAdminCatalogDrafts(drafts: AdminAiCatalogDraft[]): void {
  if (!canUseBrowserStorage()) {
    return;
  }

  const boundedDrafts = drafts.slice(0, MAX_STORED_ADMIN_CATALOG_DRAFTS);
  window.localStorage.setItem(
    ADMIN_CATALOG_DRAFTS_STORAGE_KEY,
    JSON.stringify(boundedDrafts),
  );
  window.dispatchEvent(
    new CustomEvent<AdminAiCatalogDraft[]>(ADMIN_CATALOG_DRAFTS_EVENT, {
      detail: boundedDrafts,
    }),
  );
}

export function mergeAdminCatalogDrafts(
  incomingDrafts: AdminAiCatalogDraft[],
): AdminAiCatalogDraft[] {
  if (incomingDrafts.length === 0) {
    return readAdminCatalogDrafts();
  }

  const byKey = new Map<string, AdminAiCatalogDraft>();

  for (const draft of [...incomingDrafts, ...readAdminCatalogDrafts()]) {
    byKey.set(getAdminCatalogDraftKey(draft), draft);
  }

  const mergedDrafts = Array.from(byKey.values()).slice(
    0,
    MAX_STORED_ADMIN_CATALOG_DRAFTS,
  );
  saveAdminCatalogDrafts(mergedDrafts);

  return mergedDrafts;
}

export function removeAdminCatalogDraft(draftKey: string): AdminAiCatalogDraft[] {
  const nextDrafts = readAdminCatalogDrafts().filter(
    (draft) => getAdminCatalogDraftKey(draft) !== draftKey,
  );
  saveAdminCatalogDrafts(nextDrafts);

  return nextDrafts;
}

export function clearAdminCatalogDrafts(): void {
  saveAdminCatalogDrafts([]);
}
