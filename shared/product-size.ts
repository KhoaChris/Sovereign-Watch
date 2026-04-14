const PRODUCT_SIZE_PATTERN = /^\s*(\d+(?:[.,]\d+)?)\s*(?:mm)?\s*$/i;

export function normalizeProductSizeValue(value: string): string {
  if (typeof value !== "string") {
    return "";
  }

  const match = value.match(PRODUCT_SIZE_PATTERN);

  if (!match) {
    return "";
  }

  const parsedValue = Number(match[1].replace(",", "."));

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return "";
  }

  return parsedValue.toString();
}

export function formatProductSize(
  value: string | null | undefined,
  fallback = "",
): string {
  const normalizedValue =
    typeof value === "string" ? normalizeProductSizeValue(value) : "";

  if (!normalizedValue) {
    return fallback;
  }

  return `${normalizedValue}mm`;
}

export function productSizesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft =
    typeof left === "string" ? normalizeProductSizeValue(left) : "";
  const normalizedRight =
    typeof right === "string" ? normalizeProductSizeValue(right) : "";

  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight;
}

export function sanitizeProductSizeDraft(value: string): string {
  const cleaned = value.replace(/,/g, ".").replace(/[^\d.]/g, "");

  if (!cleaned) {
    return "";
  }

  const firstDotIndex = cleaned.indexOf(".");

  if (firstDotIndex === -1) {
    return cleaned.replace(/^0+(?=\d)/, "");
  }

  const integerPart = cleaned.slice(0, firstDotIndex).replace(/\./g, "");
  const normalizedIntegerPart = integerPart.replace(/^0+(?=\d)/, "");
  const fractionalPart = cleaned
    .slice(firstDotIndex + 1)
    .replace(/\./g, "")
    .slice(0, 2);

  if (cleaned.endsWith(".") && fractionalPart.length === 0) {
    return `${normalizedIntegerPart || "0"}.`;
  }

  if (fractionalPart.length === 0) {
    return normalizedIntegerPart || "0";
  }

  return `${normalizedIntegerPart || "0"}.${fractionalPart}`;
}
