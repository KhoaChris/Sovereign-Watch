import { randomUUID } from "node:crypto";

export function createEntityId(length = 12): string {
  return randomUUID().replace(/-/g, "").slice(0, length);
}
