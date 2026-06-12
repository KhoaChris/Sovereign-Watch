import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ChevronDown,
  CirclePlus,
  Download,
  FileDown,
  LayoutDashboard,
  Package,
  PencilLine,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Trash2,
  Truck,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import { useFeedback } from "../feedback/feedback-context";
import { storefrontApi } from "../services/api";
import { useStorefront } from "../storefront/storefront-context";
import {
  formatProductSize,
  normalizeProductSizeValue,
  sanitizeProductSizeDraft,
  type CreateProductPayload,
  type OrderRecord,
  type OrderStatus,
  type PaymentStatus,
  type ReviewRecord,
  type AdminReviewSortOption,
  type ProductRecord,
  type ProductVariantInput,
  type ProductVariant,
  type ShippingStatus,
  type UpdateOrderPayload,
} from "../shared";
import "../styles/pages/orders-page.css";

interface ProductVariantDraft {
  color: string;
  discountPrice: string;
  id?: string;
  price: string;
  size: string;
  sku: string;
  stockQuantity: string;
}

interface ProductFormState {
  brandId: string;
  categoryId: string;
  description: string;
  images: string[];
  name: string;
  type: string;
  variants: ProductVariantDraft[];
}

interface SalesSeriesPoint {
  count: number;
  key: string;
  label: string;
  revenue: number;
}

interface DonutSegment {
  color: string;
  label: string;
  value: number;
}

interface AdminMetric {
  detail: string;
  icon: typeof ShoppingBag;
  label: string;
  tone: "default" | "positive" | "negative";
  trendLabel: string;
  value: string;
}

interface VariantLookupEntry {
  productImage: string;
  productId: string;
  productName: string;
  productType: string;
  sku: string;
  variant: ProductVariant;
}

interface AdminPresetOption {
  detail: string;
  label: string;
}

type PaginationToken = number | "ellipsis";

const PRODUCT_IMAGE_ACCEPT = ".png,.jpg,.jpeg,image/png,image/jpeg";
const PRODUCT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const PRODUCT_IMAGE_TYPES = new Set(["image/png", "image/jpeg"]);
const EMBEDDED_IMAGE_OPAQUE_OUTPUT_TYPE = "image/jpeg";
const EMBEDDED_IMAGE_TRANSPARENT_OUTPUT_TYPE = "image/webp";
const EMBEDDED_IMAGE_MAX_DIMENSION = 1400;
const EMBEDDED_IMAGE_MAX_CHARS = 180_000;
const EMBEDDED_IMAGE_MIN_QUALITY = 0.42;
const EMBEDDED_IMAGE_TOTAL_MAX_CHARS = 600_000;
const OPERATIONS_PDF_EXPORT_CLASS = "operations-pdf-export";

const BRAND_PRESETS: AdminPresetOption[] = [
  {
    label: "Rolex",
    detail: "Swiss luxury benchmark for iconic collector references.",
  },
  {
    label: "Hublot",
    detail: "Modern haute horlogerie with bold sport-luxury energy.",
  },
  {
    label: "Hamilton",
    detail: "Heritage-led Swiss maker with cinematic and aviation roots.",
  },
  {
    label: "Apple",
    detail: "Premium connected ecosystem for high-end wearable tech.",
  },
  {
    label: "Samsung",
    detail: "Flagship smart wearable and advanced device maker.",
  },
];

const CATEGORY_PRESETS: AdminPresetOption[] = [
  {
    label: "Luxury",
    detail: "Prestige-driven pieces with elevated finishing and brand equity.",
  },
  {
    label: "Sport",
    detail: "Performance-oriented references built for active daily wear.",
  },
  {
    label: "HighTech",
    detail: "Connected and engineering-forward wearables or hybrid pieces.",
  },
  {
    label: "Chronograph",
    detail: "Timing-focused models with motorsport or pilot character.",
  },
  {
    label: "Smartwatch",
    detail: "Digital-first wristwear with health, utility, and app flows.",
  },
  {
    label: "Heritage",
    detail: "Classic archival, dress-led, or collector-minded references.",
  },
];

function readImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Unable to decode ${file.name}.`));
    };

    image.src = objectUrl;
  });
}

function fitImageWithinBounds(
  width: number,
  height: number,
  maxDimension: number,
): { height: number; width: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height));

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

async function fileToEmbeddedProductImage(file: File): Promise<string> {
  const image = await readImageFile(file);
  const preserveTransparency = file.type === "image/png";
  const outputType = preserveTransparency
    ? EMBEDDED_IMAGE_TRANSPARENT_OUTPUT_TYPE
    : EMBEDDED_IMAGE_OPAQUE_OUTPUT_TYPE;
  let { width, height } = fitImageWithinBounds(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    EMBEDDED_IMAGE_MAX_DIMENSION,
  );
  let quality = 0.82;

  while (true) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Your browser could not prepare this image.");
    }

    if (!preserveTransparency) {
      context.fillStyle = "#0b0d14";
      context.fillRect(0, 0, width, height);
    }

    context.drawImage(image, 0, 0, width, height);

    const dataUrl = canvas.toDataURL(outputType, quality);
    const exportedAsLosslessPng =
      preserveTransparency && dataUrl.startsWith("data:image/png");

    if (dataUrl.length <= EMBEDDED_IMAGE_MAX_CHARS) {
      return dataUrl;
    }

    if (!exportedAsLosslessPng && quality > EMBEDDED_IMAGE_MIN_QUALITY) {
      quality = Math.max(EMBEDDED_IMAGE_MIN_QUALITY, quality - 0.08);
      continue;
    }

    if (Math.max(width, height) <= 720) {
      break;
    }

    width = Math.max(1, Math.round(width * 0.85));
    height = Math.max(1, Math.round(height * 0.85));
    quality = 0.82;
  }

  throw new Error(
    `${file.name} is still too large after compression. Try a smaller image.`,
  );
}

function FieldLabel({
  label,
  optional = false,
  required = false,
}: {
  label: string;
  optional?: boolean;
  required?: boolean;
}) {
  return (
    <span className="operations-field__label">
      <span className="operations-field__label-text">{label}</span>
      {required ? (
        <span className="operations-field__badge operations-field__badge--required">
          Required
        </span>
      ) : null}
      {!required && optional ? (
        <span className="operations-field__badge operations-field__badge--optional">
          Optional
        </span>
      ) : null}
    </span>
  );
}

function FieldHint({
  fallback,
  fallbackTone = "muted",
  message,
}: {
  fallback?: string;
  fallbackTone?: "accent" | "muted";
  message?: string | null;
}) {
  if (message) {
    return (
      <p className="operations-field__hint operations-field__hint--error">
        {message}
      </p>
    );
  }

  if (fallback) {
    return (
      <p
        className={`operations-field__hint ${
          fallbackTone === "accent" ? "operations-field__hint--accent" : ""
        }`}
      >
        {fallback}
      </p>
    );
  }

  return (
    <p
      aria-hidden="true"
      className="operations-field__hint operations-field__hint--placeholder"
    >
      &nbsp;
    </p>
  );
}

function findPresetOption(
  options: AdminPresetOption[],
  value: string,
): AdminPresetOption | null {
  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  return (
    options.find((option) => option.label.toLowerCase() === normalizedValue) ??
    null
  );
}

function presetFieldFallback(
  options: AdminPresetOption[],
  value: string,
  fieldLabel: string,
): { message: string; tone: "accent" | "muted" } {
  const selectedPreset = findPresetOption(options, value);

  if (selectedPreset) {
    return {
      message: selectedPreset.detail,
      tone: "accent",
    };
  }

  return {
    message: `Choose a ${fieldLabel.toLowerCase()} preset or type a custom value.`,
    tone: "muted",
  };
}

function getFilteredPresetOptions(
  options: AdminPresetOption[],
  query: string,
): AdminPresetOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  const sorted = [...options].sort((left, right) =>
    left.label.localeCompare(right.label),
  );

  if (!normalizedQuery) {
    return sorted;
  }

  return sorted.filter((option) => {
    return [option.label, option.detail]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

function PresetLookupField({
  fieldLabel,
  invalid = false,
  onChange,
  onPick,
  options,
  placeholder,
  value,
}: {
  fieldLabel: string;
  invalid?: boolean;
  onChange: (value: string) => void;
  onPick: (value: string) => void;
  options: AdminPresetOption[];
  placeholder: string;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const filteredOptions = useMemo(
    () => getFilteredPresetOptions(options, value),
    [options, value],
  );
  const selectedOption = findPresetOption(options, value);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div className="operations-field__lookup" ref={wrapperRef}>
      <div
        className={`operations-field__lookup-shell ${
          isOpen ? "operations-field__lookup-shell--open" : ""
        } ${invalid ? "operations-field__lookup-shell--invalid" : ""}`}
      >
        <input
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-invalid={invalid}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          value={value}
        />
        <button
          aria-label={`Toggle ${fieldLabel.toLowerCase()} presets`}
          className="operations-field__lookup-toggle"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <ChevronDown
            className={`operations-field__lookup-chevron ${
              isOpen ? "operations-field__lookup-chevron--open" : ""
            }`}
            size={18}
          />
        </button>
      </div>

      {isOpen ? (
        <div className="operations-field__lookup-panel">
          <div className="operations-field__lookup-head">
            <span>{fieldLabel} library</span>
            <span>{filteredOptions.length} sorted A-Z</span>
          </div>

          {filteredOptions.length > 0 ? (
            <div
              aria-label={`${fieldLabel} options`}
              className="operations-field__lookup-list"
              role="listbox"
            >
              {filteredOptions.map((option) => {
                const isSelected =
                  option.label.toLowerCase() === value.trim().toLowerCase();

                return (
                  <button
                    key={option.label}
                    aria-selected={isSelected}
                    className={`operations-field__lookup-option ${
                      isSelected
                        ? "operations-field__lookup-option--selected"
                        : ""
                    }`}
                    onClick={() => {
                      onPick(option.label);
                      setIsOpen(false);
                    }}
                    role="option"
                    type="button"
                  >
                    <div>
                      <strong>{option.label}</strong>
                      <p>{option.detail}</p>
                    </div>
                    {isSelected ? (
                      <span className="operations-field__lookup-tag">
                        Selected
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="operations-field__lookup-empty">
              No preset matches. Keep typing to use a custom{" "}
              {fieldLabel.toLowerCase()} value.
            </div>
          )}

          {!selectedOption && value.trim().length > 0 ? (
            <p className="operations-field__lookup-note">
              Custom value ready: {value.trim()}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  "pending",
  "confirmed",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

const PAYMENT_STATUS_OPTIONS: PaymentStatus[] = [
  "pending",
  "authorized",
  "paid",
  "failed",
  "refunded",
];

const SHIPPING_STATUS_OPTIONS: ShippingStatus[] = [
  "pending",
  "packed",
  "in_transit",
  "delivered",
  "returned",
];
const SALES_LEDGER_PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

const ADMIN_SECTIONS = [
  {
    description: "KPI, revenue trend, and live queue.",
    href: "#operations-overview",
    icon: LayoutDashboard,
    label: "Overview",
  },
  {
    description: "Order ledger and status controls.",
    href: "#operations-orders",
    icon: ShoppingBag,
    label: "Orders",
  },
  {
    description: "Catalog editor synced.",
    href: "#operations-products",
    icon: Package,
    label: "Products",
  },
  {
    description: "Ratings, comments, and moderation queue.",
    href: "#operations-reviews",
    icon: PencilLine,
    label: "Reviews",
  },
  {
    description: "Print-ready sales report and CSV export.",
    href: "#operations-export",
    icon: Download,
    label: "Exports",
  },
];

const ADMIN_REVIEW_SORT_OPTIONS: Array<{
  label: string;
  value: AdminReviewSortOption;
}> = [
  { label: "Newest first", value: "newest" },
  { label: "Lowest rating", value: "rating-asc" },
  { label: "Highest rating", value: "rating-desc" },
];

function createEmptyVariantDraft(): ProductVariantDraft {
  return {
    color: "",
    discountPrice: "",
    price: "",
    size: "",
    sku: "",
    stockQuantity: "",
  };
}

function createEmptyProductForm(): ProductFormState {
  return {
    brandId: "",
    categoryId: "",
    description: "",
    images: [],
    name: "",
    type: "",
    variants: [createEmptyVariantDraft()],
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatStatusLabel(value: string | undefined): string {
  if (!value) {
    return "Pending";
  }

  return value
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function humanizeToken(value: string): string {
  return formatStatusLabel(value);
}

function normalizeSkuSegment(
  value: string,
  fallback: string,
  maxLength: number,
): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]+/g, "");

  if (cleaned.length > 0) {
    return cleaned.slice(0, maxLength);
  }

  return fallback.slice(0, maxLength);
}

function buildGeneratedSku(
  form: ProductFormState,
  variant: ProductVariantDraft,
  index: number,
): string {
  const brand = normalizeSkuSegment(form.brandId || form.name, "BRND", 4);
  const product = normalizeSkuSegment(form.name || form.type, "WATCH", 5);
  const color = normalizeSkuSegment(variant.color, "CLR", 3);
  const size = normalizeSkuSegment(variant.size, "STD", 3);

  return [brand, product, color, size, String(index + 1).padStart(2, "0")].join(
    "-",
  );
}

function requiredFieldMessage(value: string, label: string): string | null {
  return value.trim().length > 0 ? null : `${label} is required.`;
}

function numericFieldMessage(
  value: string,
  label: string,
  {
    allowEmpty = false,
    integerOnly = false,
  }: { allowEmpty?: boolean; integerOnly?: boolean } = {},
): string | null {
  if (value.trim().length === 0) {
    return allowEmpty ? null : `${label} is required.`;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return `${label} must be a non-negative number.`;
  }

  if (integerOnly && !Number.isInteger(numericValue)) {
    return `${label} must be a whole number.`;
  }

  return null;
}

function sizeFieldMessage(value: string): string | null {
  if (value.trim().length === 0) {
    return "Size is required.";
  }

  if (!normalizeProductSizeValue(value)) {
    return "Size must be entered as a numeric millimeter value.";
  }

  return null;
}

function descriptionFieldMessage(value: string): string | null {
  if (value.trim().length === 0) {
    return "Description is required.";
  }

  if (value.trim().length < 10) {
    return "Use at least 10 characters.";
  }

  return null;
}

function imageFieldMessage(images: string[]): string | null {
  return images.length > 0 ? null : "Add at least one product image.";
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.round(bytes / 1024)} KB`;
}

function productStartingPrice(product: ProductRecord): number {
  return product.variants.reduce((lowestPrice, variant) => {
    return Math.min(lowestPrice, variant.discountPrice ?? variant.price);
  }, Number.POSITIVE_INFINITY);
}

function productStock(product: ProductRecord): number {
  return product.variants.reduce(
    (total, variant) => total + variant.stockQuantity,
    0,
  );
}

function productStockTone(
  product: ProductRecord,
): "healthy" | "attention" | "critical" {
  const stock = productStock(product);

  if (stock <= 0) {
    return "critical";
  }

  if (stock <= 6) {
    return "attention";
  }

  return "healthy";
}

function createProductForm(product: ProductRecord): ProductFormState {
  return {
    brandId: product.brandId,
    categoryId: product.categoryId,
    description: product.description,
    images: [...product.images],
    name: product.name,
    type: product.type,
    variants: product.variants.map((variant) => ({
      color: variant.color,
      discountPrice:
        variant.discountPrice === null ? "" : String(variant.discountPrice),
      id: variant.id,
      price: String(variant.price),
      size: normalizeProductSizeValue(variant.size),
      sku: variant.sku,
      stockQuantity: String(variant.stockQuantity),
    })),
  };
}

function parseVariants(
  variants: ProductVariantDraft[],
  form: ProductFormState,
): ProductVariantInput[] {
  const parsed = variants.map((variant, index) => {
    const generatedSku = buildGeneratedSku(form, variant, index);
    const price = Number(variant.price);
    const stockQuantity = Number(variant.stockQuantity);
    const discountPriceValue = variant.discountPrice.trim();
    const discountPrice =
      discountPriceValue.length > 0 ? Number(discountPriceValue) : null;
    const normalizedSize = normalizeProductSizeValue(variant.size);

    if (!variant.color.trim()) {
      throw new Error(`Variant ${index + 1}: color is required.`);
    }

    if (!normalizedSize) {
      throw new Error(
        `Variant ${index + 1}: size must be a numeric millimeter value.`,
      );
    }

    if (!Number.isFinite(price) || price < 0) {
      throw new Error(
        `Variant ${index + 1}: price must be a non-negative number.`,
      );
    }

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      throw new Error(
        `Variant ${index + 1}: stock must be a non-negative integer.`,
      );
    }

    if (
      discountPrice !== null &&
      (!Number.isFinite(discountPrice) || discountPrice < 0)
    ) {
      throw new Error(
        `Variant ${index + 1}: discount price must be blank or a non-negative number.`,
      );
    }

    return {
      color: variant.color.trim(),
      discountPrice,
      id: variant.id,
      price,
      size: normalizedSize,
      sku: variant.sku.trim() || generatedSku,
      stockQuantity,
    };
  });

  if (parsed.length === 0) {
    throw new Error("Add at least one variant before saving.");
  }

  return parsed;
}

function buildProductPayload(form: ProductFormState): CreateProductPayload {
  const images = form.images.map((image) => image.trim()).filter(Boolean);

  if (!form.categoryId.trim()) {
    throw new Error("Category ID is required.");
  }

  if (!form.brandId.trim()) {
    throw new Error("Brand ID is required.");
  }

  if (!form.name.trim()) {
    throw new Error("Product name is required.");
  }

  if (!form.type.trim()) {
    throw new Error("Product type is required.");
  }

  if (form.description.trim().length < 10) {
    throw new Error("Description should be at least 10 characters.");
  }

  if (images.length === 0) {
    throw new Error("At least one product image is required.");
  }

  return {
    brandId: form.brandId.trim(),
    categoryId: form.categoryId.trim(),
    description: form.description.trim(),
    images,
    name: form.name.trim(),
    type: form.type.trim(),
    variants: parseVariants(form.variants, form),
  };
}

function sortProductsForAdmin(products: ProductRecord[]): ProductRecord[] {
  return [...products].sort((left, right) => {
    return (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  });
}

function percentChange(
  currentValue: number,
  previousValue: number,
): number | null {
  if (previousValue === 0) {
    return currentValue === 0 ? 0 : null;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildSalesSeries(orders: OrderRecord[]): SalesSeriesPoint[] {
  const today = new Date();
  const points: SalesSeriesPoint[] = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const key = monthKey(date);
    const label = new Intl.DateTimeFormat("en-US", {
      month: "short",
    }).format(date);

    points.push({
      count: 0,
      key,
      label,
      revenue: 0,
    });
  }

  const pointMap = new Map(points.map((point) => [point.key, point]));

  orders.forEach((order) => {
    if (order.status === "cancelled") {
      return;
    }

    const key = monthKey(new Date(order.createdAt));
    const point = pointMap.get(key);

    if (!point) {
      return;
    }

    point.count += 1;
    point.revenue += order.totalAmount;
  });

  return points;
}

function buildStatusSegments(orders: OrderRecord[]): DonutSegment[] {
  const paid = orders.filter(
    (order) => order.payment?.status === "paid" || order.status === "delivered",
  ).length;
  const inFlight = orders.filter((order) =>
    ["pending", "confirmed", "paid", "processing", "shipped"].includes(
      order.status,
    ),
  ).length;
  const exceptions = orders.filter(
    (order) =>
      order.status === "cancelled" ||
      order.payment?.status === "failed" ||
      order.payment?.status === "refunded",
  ).length;

  return [
    { color: "var(--operations-gold)", label: "Captured", value: paid },
    { color: "var(--operations-blue)", label: "In flow", value: inFlight },
    { color: "var(--operations-red)", label: "Exceptions", value: exceptions },
  ];
}

function createDonutBackground(segments: DonutSegment[]): string {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (total <= 0) {
    return "conic-gradient(rgba(255, 255, 255, 0.12) 0deg 360deg)";
  }

  let currentStop = 0;
  const stops = segments.map((segment) => {
    const segmentSize = (segment.value / total) * 360;
    const start = currentStop;
    const end = currentStop + segmentSize;
    currentStop = end;
    return `${segment.color} ${start}deg ${end}deg`;
  });

  return `conic-gradient(${stops.join(", ")})`;
}

function buildVariantLookup(
  products: ProductRecord[],
): Map<string, VariantLookupEntry> {
  const lookup = new Map<string, VariantLookupEntry>();

  products.forEach((product) => {
    product.variants.forEach((variant) => {
      lookup.set(variant.id, {
        productImage: product.images[0] ?? "",
        productId: product.id,
        productName: product.name,
        productType: product.type,
        sku: variant.sku,
        variant,
      });
    });
  });

  return lookup;
}

function buildOrderItemSummary(
  order: OrderRecord,
  variantLookup: Map<string, VariantLookupEntry>,
): string {
  const labels = order.items.map((item) => {
    const variant = variantLookup.get(item.productVariantId);

    if (!variant) {
      return `Variant ${item.productVariantId.slice(0, 6)} x${item.quantity}`;
    }

    return `${variant.productName} (${variant.sku}) x${item.quantity}`;
  });

  return labels.join(", ");
}

function buildOrderUnitSummary(order: OrderRecord): string {
  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return `${totalUnits} ${totalUnits === 1 ? "piece" : "pieces"}`;
}

function normalizeSalesLedgerSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function buildSalesLedgerSearchText(
  order: OrderRecord,
  variantLookup: Map<string, VariantLookupEntry>,
): string {
  const shippingSummary = splitShippingAddress(order.shippingAddress);

  return [
    order.id,
    order.customerId,
    order.orderNumber,
    order.shippingAddress,
    shippingSummary.recipient,
    shippingSummary.detail,
    order.totalAmount,
    formatCurrency(order.totalAmount),
    formatDateTime(order.createdAt),
    order.status,
    formatStatusLabel(order.status),
    order.payment?.status,
    formatStatusLabel(order.payment?.status),
    order.payment?.method,
    formatStatusLabel(order.payment?.method),
    order.shipping?.status,
    formatStatusLabel(order.shipping?.status),
    order.shipping?.courierName,
    order.shipping?.trackingNumber,
    buildOrderUnitSummary(order),
    buildOrderItemSummary(order, variantLookup),
  ]
    .filter((value) => value !== undefined && value !== null)
    .join(" ");
}

function orderMatchesSalesLedgerSearch(
  order: OrderRecord,
  query: string,
  variantLookup: Map<string, VariantLookupEntry>,
): boolean {
  const normalizedQuery = normalizeSalesLedgerSearch(query.trim());

  if (!normalizedQuery) {
    return true;
  }

  return normalizeSalesLedgerSearch(
    buildSalesLedgerSearchText(order, variantLookup),
  ).includes(normalizedQuery);
}

function buildPaginationTokens(
  currentPage: number,
  totalPages: number,
): PaginationToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pageSet = new Set([
    1,
    totalPages,
    currentPage,
    currentPage - 1,
    currentPage + 1,
  ]);

  const pages = Array.from(pageSet)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
  const tokens: PaginationToken[] = [];

  pages.forEach((page, index) => {
    const previousPage = pages[index - 1];

    if (previousPage !== undefined && page - previousPage > 1) {
      tokens.push("ellipsis");
    }

    tokens.push(page);
  });

  return tokens;
}

function splitShippingAddress(value: string): {
  detail: string;
  recipient: string;
} {
  const [recipient, ...detailParts] = value
    .split("·")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return {
    detail: detailParts.join(" · ") || "Delivery details pending",
    recipient: recipient || "Reserve client",
  };
}

function csvEscape(value: string | number | null | undefined): string {
  const normalized = value === undefined || value === null ? "" : String(value);

  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replaceAll('"', '""')}"`;
}

function buildSalesCsv(
  orders: OrderRecord[],
  variantLookup: Map<string, VariantLookupEntry>,
): string {
  const header = [
    "order_number",
    "created_at",
    "updated_at",
    "customer_id",
    "shipping_address",
    "status",
    "payment_status",
    "payment_method",
    "shipping_status",
    "courier",
    "tracking_number",
    "item_count",
    "items",
    "total_amount",
  ];

  const rows = orders.map((order) => [
    order.orderNumber,
    order.createdAt,
    order.updatedAt,
    order.customerId,
    order.shippingAddress,
    order.status,
    order.payment?.status ?? "",
    order.payment?.method ?? "",
    order.shipping?.status ?? "",
    order.shipping?.courierName ?? "",
    order.shipping?.trackingNumber ?? "",
    order.items.reduce((sum, item) => sum + item.quantity, 0),
    buildOrderItemSummary(order, variantLookup),
    order.totalAmount.toFixed(2),
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => csvEscape(cell)).join(","))
    .join("\n");
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

async function fetchOperationsData(): Promise<{
  orders: OrderRecord[];
  products: ProductRecord[];
  reviews: ReviewRecord[];
}> {
  const [orders, products, reviews] = await Promise.all([
    storefrontApi.getOrders(),
    storefrontApi.getProducts(),
    storefrontApi.getAdminReviews(),
  ]);

  return { orders, products, reviews };
}

function resolveMetricTone(
  change: number | null,
): "default" | "positive" | "negative" {
  if (change === null || change === 0) {
    return "default";
  }

  return change > 0 ? "positive" : "negative";
}

function formatTrendLabel(change: number | null): string {
  if (change === null) {
    return "First live period";
  }

  if (change === 0) {
    return "Flat vs last month";
  }

  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}% vs last month`;
}

function AdminMetricCard({
  detail,
  icon: Icon,
  label,
  tone,
  trendLabel,
  value,
}: AdminMetric) {
  return (
    <div className="operations-metric-card">
      <div className="operations-metric-card__head">
        <span>{label}</span>
        <Icon className="operations-metric-card__icon" />
      </div>
      <strong>{value}</strong>
      <p className="operations-metric-card__detail">{detail}</p>
      <p
        className={`operations-metric-card__trend operations-metric-card__trend--${tone}`}
      >
        {tone === "positive" ? <ArrowUpRight size={14} /> : null}
        {tone === "negative" ? <ArrowDownRight size={14} /> : null}
        {trendLabel}
      </p>
    </div>
  );
}

function SalesBars({ points }: { points: SalesSeriesPoint[] }) {
  const maxRevenue = Math.max(...points.map((point) => point.revenue), 1);
  const totalRevenue = points.reduce((sum, point) => sum + point.revenue, 0);
  const totalOrders = points.reduce((sum, point) => sum + point.count, 0);
  const peakPoint = points.reduce<SalesSeriesPoint | null>(
    (current, point) => (!current || point.revenue > current.revenue ? point : current),
    null,
  );
  const chartWidth = 600;
  const chartHeight = 164;
  const chartBottom = 138;
  const chartTop = 18;
  const step = chartWidth / Math.max(points.length, 1);
  const linePoints = points.map((point, index) => {
    const x = step * (index + 0.5);
    const y =
      chartBottom -
      (point.revenue / maxRevenue) * (chartBottom - chartTop);

    return { x, y };
  });
  const linePointString = linePoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const firstLinePoint = linePoints[0];
  const lastLinePoint = linePoints[linePoints.length - 1];
  const areaPath =
    firstLinePoint && lastLinePoint
      ? `M${firstLinePoint.x},${chartBottom} L${linePointString} L${lastLinePoint.x},${chartBottom} Z`
      : "";

  return (
    <div className="operations-revenue">
      <div className="operations-revenue__summary" aria-label="Revenue summary">
        <div>
          <span>Total captured</span>
          <strong>{formatCurrency(totalRevenue)}</strong>
        </div>
        <div>
          <span>Peak month</span>
          <strong>
            {peakPoint ? `${peakPoint.label} · ${formatCurrency(peakPoint.revenue)}` : "No data"}
          </strong>
        </div>
        <div>
          <span>Order volume</span>
          <strong>{totalOrders} orders</strong>
        </div>
      </div>

      <div className="operations-revenue__stage">
        <div className="operations-revenue__axis" aria-hidden="true">
          <span>{formatCurrency(maxRevenue)}</span>
          <span>{formatCurrency(maxRevenue / 2)}</span>
          <span>{formatCurrency(0)}</span>
        </div>
        <svg
          aria-hidden="true"
          className="operations-revenue__trend"
          preserveAspectRatio="none"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          <path className="operations-revenue__trend-area" d={areaPath} />
          <polyline
            className="operations-revenue__trend-line"
            points={linePointString}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="operations-revenue__markers" aria-hidden="true">
          {points.map((point, index) => {
            const position = linePoints[index];
            const isPeak = peakPoint?.key === point.key;

            return (
              <span
                key={point.key}
                className={`operations-revenue__node${
                  isPeak ? " operations-revenue__node--peak" : ""
                }`}
                style={{
                  left: `${(position.x / chartWidth) * 100}%`,
                  top: `${(position.y / chartHeight) * 100}%`,
                }}
              >
                <span />
              </span>
            );
          })}
        </div>

        <div className="operations-revenue__months">
          {points.map((point) => {
            const isPeak = peakPoint?.key === point.key;

            return (
              <div
                key={point.key}
                className={`operations-revenue__month${
                  isPeak ? " operations-revenue__month--peak" : ""
                }`}
              >
                <span>{point.label}</span>
                <strong>{formatCurrency(point.revenue)}</strong>
                <small>{point.count} orders</small>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DistributionMeter({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const dominantSegment = segments.reduce<DonutSegment | null>(
    (current, segment) =>
      !current || segment.value > current.value ? segment : current,
    null,
  );

  return (
    <div className="operations-distribution">
      <div className="operations-distribution__hero">
        <div
          aria-hidden="true"
          className="operations-distribution__donut"
          style={{ background: createDonutBackground(segments) }}
        >
          <div className="operations-distribution__donut-core">
            <strong>{total}</strong>
            <span>orders</span>
          </div>
        </div>
        <div className="operations-distribution__summary">
          <span>Dominant status</span>
          <strong>{dominantSegment?.label ?? "No orders"}</strong>
          <p>
            {total > 0
              ? `${dominantSegment?.value ?? 0} of ${total} orders sit in this lane.`
              : "No order activity is available yet."}
          </p>
        </div>
      </div>

      <div className="operations-distribution__legend">
        {segments.map((segment) => {
          const share = total > 0 ? (segment.value / total) * 100 : 0;

          return (
            <div
              key={segment.label}
              className="operations-distribution__legend-row"
            >
              <span
                className="operations-distribution__legend-swatch"
                style={{ backgroundColor: segment.color }}
              />
              <span>{segment.label}</span>
              <strong>{share.toFixed(0)}%</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewStarsRow({ rating }: { rating: number }) {
  return (
    <div className="operations-review-stars" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <span
          key={value}
          className={`operations-review-stars__star ${
            value <= rating ? "operations-review-stars__star--active" : ""
          }`}
        >
          <Star fill="currentColor" size={14} strokeWidth={1.8} />
        </span>
      ))}
    </div>
  );
}

export function OperationsPage({
  fallbackOrders = [],
}: {
  fallbackOrders?: OrderRecord[];
}) {
  const { confirm, notify } = useFeedback();
  const { authLoading, isAdmin, isAuthenticated, openAuthModal, role, user } =
    useStorefront();
  const [orders, setOrders] = useState<OrderRecord[]>(fallbackOrders);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, UpdateOrderPayload>>({});
  const [productForm, setProductForm] = useState<ProductFormState>(
    createEmptyProductForm(),
  );
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [imageUploadMessage, setImageUploadMessage] = useState<string | null>(
    null,
  );
  const [selectedImageNames, setSelectedImageNames] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [salesLedgerSearch, setSalesLedgerSearch] = useState("");
  const [salesLedgerPage, setSalesLedgerPage] = useState(1);
  const [salesLedgerPageSize, setSalesLedgerPageSize] = useState(10);
  const [productSearch, setProductSearch] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewSort, setReviewSort] = useState<AdminReviewSortOption>("newest");
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);
  const deferredSalesLedgerSearch = useDeferredValue(salesLedgerSearch);
  const deferredProductSearch = useDeferredValue(productSearch);
  const deferredReviewSearch = useDeferredValue(reviewSearch);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!isAuthenticated || !isAdmin) {
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    fetchOperationsData()
      .then((result) => {
        if (!active) {
          return;
        }

        setOrders(result.orders);
        setProducts(sortProductsForAdmin(result.products));
        setReviews(result.reviews);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }

        setLoading(false);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load operations data right now.",
        );
      });

    return () => {
      active = false;
    };
  }, [isAdmin, isAuthenticated]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((left, right) => {
      return (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    });
  }, [orders]);
  const pendingAttentionCount = useMemo(
    () =>
      orders.filter((order) =>
        ["pending", "processing", "confirmed", "shipped"].includes(
          order.status,
        ),
      ).length,
    [orders],
  );

  const grossRevenue = useMemo(
    () =>
      orders.reduce((sum, order) => {
        return order.status === "cancelled" ? sum : sum + order.totalAmount;
      }, 0),
    [orders],
  );

  const capturedRevenue = useMemo(
    () =>
      orders.reduce((sum, order) => {
        return order.payment?.status === "paid" ? sum + order.totalAmount : sum;
      }, 0),
    [orders],
  );

  const averageOrderValue = useMemo(() => {
    const validOrders = orders.filter((order) => order.status !== "cancelled");

    if (validOrders.length === 0) {
      return 0;
    }

    return grossRevenue / validOrders.length;
  }, [grossRevenue, orders]);

  const lowStockProducts = useMemo(() => {
    return products
      .filter((product) => productStock(product) <= 6)
      .sort((left, right) => productStock(left) - productStock(right));
  }, [products]);

  const salesSeries = useMemo(() => buildSalesSeries(orders), [orders]);
  const statusSegments = useMemo(() => buildStatusSegments(orders), [orders]);
  const variantLookup = useMemo(() => buildVariantLookup(products), [products]);
  const filteredSalesLedgerOrders = useMemo(() => {
    return sortedOrders.filter((order) =>
      orderMatchesSalesLedgerSearch(
        order,
        deferredSalesLedgerSearch,
        variantLookup,
      ),
    );
  }, [deferredSalesLedgerSearch, sortedOrders, variantLookup]);
  const salesLedgerTotalPages = Math.max(
    1,
    Math.ceil(filteredSalesLedgerOrders.length / salesLedgerPageSize),
  );
  const activeSalesLedgerPage = Math.min(
    salesLedgerPage,
    salesLedgerTotalPages,
  );
  const salesLedgerStartIndex =
    (activeSalesLedgerPage - 1) * salesLedgerPageSize;
  const pagedSalesLedgerOrders = useMemo(() => {
    return filteredSalesLedgerOrders.slice(
      salesLedgerStartIndex,
      salesLedgerStartIndex + salesLedgerPageSize,
    );
  }, [filteredSalesLedgerOrders, salesLedgerPageSize, salesLedgerStartIndex]);
  const salesLedgerRangeStart =
    filteredSalesLedgerOrders.length === 0 ? 0 : salesLedgerStartIndex + 1;
  const salesLedgerRangeEnd = Math.min(
    salesLedgerStartIndex + salesLedgerPageSize,
    filteredSalesLedgerOrders.length,
  );
  const salesLedgerPaginationTokens = useMemo(
    () => buildPaginationTokens(activeSalesLedgerPage, salesLedgerTotalPages),
    [activeSalesLedgerPage, salesLedgerTotalPages],
  );

  useEffect(() => {
    setSalesLedgerPage((currentPage) =>
      Math.min(Math.max(currentPage, 1), salesLedgerTotalPages),
    );
  }, [salesLedgerTotalPages]);

  const filteredProducts = useMemo(() => {
    const query = deferredProductSearch.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) => {
      const variantSearch = product.variants
        .map(
          (variant) =>
            `${variant.sku} ${variant.color} ${variant.size} ${formatProductSize(
              variant.size,
            )}`,
        )
        .join(" ")
        .toLowerCase();
      const haystack = [
        product.name,
        product.brandId,
        product.categoryId,
        product.type,
        product.description,
        variantSearch,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [deferredProductSearch, products]);

  const filteredReviews = useMemo(() => {
    const query = deferredReviewSearch.trim().toLowerCase();
    const filtered = query
      ? reviews.filter((review) => {
          const haystack = [
            review.authorName,
            review.comment,
            review.productName ?? "",
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        })
      : reviews;

    return [...filtered].sort((a, b) => {
      if (reviewSort === "rating-asc") return a.rating - b.rating;
      if (reviewSort === "rating-desc") return b.rating - a.rating;
      return (
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
      );
    });
  }, [deferredReviewSearch, reviewSort, reviews]);
  const brandPresetInfo = presetFieldFallback(
    BRAND_PRESETS,
    productForm.brandId,
    "Brand",
  );
  const categoryPresetInfo = presetFieldFallback(
    CATEGORY_PRESETS,
    productForm.categoryId,
    "Category",
  );

  const thisMonthKey = useMemo(() => monthKey(new Date()), []);
  const previousMonthKey = useMemo(() => {
    const now = new Date();
    return monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  }, []);

  const currentMonthPoint = salesSeries.find(
    (point) => point.key === thisMonthKey,
  );
  const previousMonthPoint = salesSeries.find(
    (point) => point.key === previousMonthKey,
  );
  const currentMonthPaid = useMemo(
    () =>
      orders.reduce((sum, order) => {
        if (monthKey(new Date(order.createdAt)) !== thisMonthKey) {
          return sum;
        }

        return order.payment?.status === "paid" ? sum + order.totalAmount : sum;
      }, 0),
    [orders, thisMonthKey],
  );
  const previousMonthPaid = useMemo(
    () =>
      orders.reduce((sum, order) => {
        if (monthKey(new Date(order.createdAt)) !== previousMonthKey) {
          return sum;
        }

        return order.payment?.status === "paid" ? sum + order.totalAmount : sum;
      }, 0),
    [orders, previousMonthKey],
  );

  const metricCards: AdminMetric[] = useMemo(() => {
    const currentMonthOrders = currentMonthPoint?.count ?? 0;
    const previousMonthOrders = previousMonthPoint?.count ?? 0;
    const currentMonthRevenue = currentMonthPoint?.revenue ?? 0;
    const previousMonthRevenue = previousMonthPoint?.revenue ?? 0;
    const currentAverage =
      currentMonthOrders > 0 ? currentMonthRevenue / currentMonthOrders : 0;
    const previousAverage =
      previousMonthOrders > 0 ? previousMonthRevenue / previousMonthOrders : 0;

    return [
      {
        detail: `${pendingAttentionCount} reservations still need a decision.`,
        icon: ShoppingBag,
        label: "Orders managed",
        tone: resolveMetricTone(
          percentChange(currentMonthOrders, previousMonthOrders),
        ),
        trendLabel: formatTrendLabel(
          percentChange(currentMonthOrders, previousMonthOrders),
        ),
        value: String(orders.length),
      },
      {
        detail: `Gross sales across the live order ledger.`,
        icon: ShieldCheck,
        label: "Gross revenue",
        tone: resolveMetricTone(
          percentChange(currentMonthRevenue, previousMonthRevenue),
        ),
        trendLabel: formatTrendLabel(
          percentChange(currentMonthRevenue, previousMonthRevenue),
        ),
        value: formatCurrency(grossRevenue),
      },
      {
        detail: `Captured cash flow - Order marker paid.`,
        icon: Truck,
        label: "Captured revenue",
        tone: resolveMetricTone(
          percentChange(currentMonthPaid, previousMonthPaid),
        ),
        trendLabel: formatTrendLabel(
          percentChange(currentMonthPaid, previousMonthPaid),
        ),
        value: formatCurrency(capturedRevenue),
      },
      {
        detail: `${lowStockProducts.length} catalog items are under the low-stock threshold.`,
        icon: Boxes,
        label: "Average ticket",
        tone: resolveMetricTone(percentChange(currentAverage, previousAverage)),
        trendLabel: formatTrendLabel(
          percentChange(currentAverage, previousAverage),
        ),
        value: formatCurrency(averageOrderValue),
      },
    ];
  }, [
    averageOrderValue,
    capturedRevenue,
    currentMonthPaid,
    currentMonthPoint,
    grossRevenue,
    lowStockProducts.length,
    orders.length,
    pendingAttentionCount,
    previousMonthPaid,
    previousMonthPoint,
  ]);

  function getDraft(order: OrderRecord): UpdateOrderPayload {
    return (
      drafts[order.id] ?? {
        courierName:
          order.shipping?.courierName &&
          order.shipping.courierName !== "Pending assignment"
            ? order.shipping.courierName
            : "",
        paymentStatus: order.payment?.status,
        shippingStatus: order.shipping?.status,
        status: order.status,
        trackingNumber:
          order.shipping?.trackingNumber &&
          order.shipping.trackingNumber !== "Pending"
            ? order.shipping.trackingNumber
            : "",
      }
    );
  }

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    setError(null);

    try {
      const result = await fetchOperationsData();
      setOrders(result.orders);
      setProducts(sortProductsForAdmin(result.products));
      setReviews(result.reviews);
      notify({
        description: "Orders and catalog data were synced again.",
        title: "Dashboard refreshed",
        tone: "success",
      });
    } catch (err) {
      notify({
        description:
          err instanceof Error
            ? err.message
            : "Unable to refresh operations data.",
        title: "Refresh failed",
        tone: "error",
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDeleteReview(reviewId: string): Promise<void> {
    setPendingReviewId(reviewId);

    try {
      await storefrontApi.deleteReview(reviewId);
      setReviews((current) => current.filter((r) => r.id !== reviewId));
      notify({
        description: "The review has been removed from the public catalog.",
        title: "Review deleted",
        tone: "success",
      });
    } catch (err) {
      notify({
        description:
          err instanceof Error
            ? err.message
            : "Unable to delete this review right now.",
        title: "Delete failed",
        tone: "error",
      });
    } finally {
      setPendingReviewId(null);
    }
  }

  async function handleAdminUpdate(
    orderId: string,
    draft: UpdateOrderPayload,
  ): Promise<void> {
    setPendingOrderId(orderId);
    setError(null);

    try {
      const updatedOrder = await storefrontApi.updateOrder(orderId, draft);

      if (!updatedOrder) {
        throw new Error("Order not found.");
      }

      setOrders((current) =>
        current.map((order) =>
          order.id === updatedOrder.id ? updatedOrder : order,
        ),
      );
      setDrafts((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
      notify({
        description: "Status, payment, and fulfillment details are now synced.",
        title: `${updatedOrder.orderNumber} updated`,
        tone: "success",
      });
    } catch (err) {
      notify({
        description:
          err instanceof Error
            ? err.message
            : "Unable to update this order right now.",
        title: "Order update failed",
        tone: "error",
      });
    } finally {
      setPendingOrderId(null);
    }
  }

  function selectProduct(product: ProductRecord): void {
    startTransition(() => {
      setSelectedProductId(product.id);
      setProductForm(createProductForm(product));
      setImageUploadError(null);
      setImageUploadMessage(null);
      setSelectedImageNames([]);
    });
  }

  function resetProductEditor(): void {
    startTransition(() => {
      setSelectedProductId(null);
      setProductForm(createEmptyProductForm());
      setImageUploadError(null);
      setImageUploadMessage(null);
      setSelectedImageNames([]);
    });
  }

  function handleProductFieldChange(
    key: keyof Omit<ProductFormState, "images" | "variants">,
    value: string,
  ): void {
    setProductForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function removeProductImage(imageIndex: number): void {
    setProductForm((current) => ({
      ...current,
      images: current.images.filter((_, index) => index !== imageIndex),
    }));
  }

  async function handleProductImageSelection(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const input = event.target;
    const files = Array.from(input.files ?? []);

    if (files.length === 0) {
      return;
    }

    setImageUploadError(null);
    setImageUploadMessage(null);
    setSelectedImageNames(files.map((file) => file.name));

    const unsupportedFile = files.find(
      (file) => !PRODUCT_IMAGE_TYPES.has(file.type),
    );

    if (unsupportedFile) {
      setImageUploadError(
        `${unsupportedFile.name} is not supported. Choose PNG or JPG files only.`,
      );
      return;
    }

    const oversizedFile = files.find(
      (file) => file.size > PRODUCT_IMAGE_MAX_BYTES,
    );

    if (oversizedFile) {
      setImageUploadError(
        `${oversizedFile.name} is ${formatFileSize(oversizedFile.size)}. Keep each image at 4 MB or smaller.`,
      );
      return;
    }

    setError(null);
    setUploadingImages(true);

    try {
      const embeddedImages = await Promise.all(
        files.map(async (file) => {
          return fileToEmbeddedProductImage(file);
        }),
      );

      const nextImages = [...productForm.images, ...embeddedImages];
      const totalImagePayload = nextImages.reduce(
        (total, image) => total + image.length,
        0,
      );

      if (totalImagePayload > EMBEDDED_IMAGE_TOTAL_MAX_CHARS) {
        throw new Error(
          "These images are too heavy for Firestore. Keep fewer images or use smaller originals.",
        );
      }

      setProductForm((current) => ({
        ...current,
        images: [...current.images, ...embeddedImages],
      }));
      setImageUploadMessage(
        `${embeddedImages.length} image${embeddedImages.length === 1 ? "" : "s"} prepared in the product gallery.`,
      );
      setSelectedImageNames([]);
    } catch (err) {
      setImageUploadError(
        err instanceof Error
          ? err.message
          : "Unable to prepare the selected images.",
      );
    } finally {
      input.value = "";
      setUploadingImages(false);
    }
  }

  function handleVariantChange(
    index: number,
    key: keyof ProductVariantDraft,
    value: string,
  ): void {
    setProductForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) => {
        if (variantIndex !== index) {
          return variant;
        }

        return {
          ...variant,
          [key]: key === "size" ? sanitizeProductSizeDraft(value) : value,
        };
      }),
    }));
  }

  function addVariantRow(): void {
    setProductForm((current) => ({
      ...current,
      variants: [...current.variants, createEmptyVariantDraft()],
    }));
  }

  function removeVariantRow(index: number): void {
    setProductForm((current) => {
      if (current.variants.length === 1) {
        return current;
      }

      return {
        ...current,
        variants: current.variants.filter(
          (_, variantIndex) => variantIndex !== index,
        ),
      };
    });
  }

  async function handleProductSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(null);

    let payload: CreateProductPayload;

    try {
      payload = buildProductPayload(productForm);
    } catch (err) {
      notify({
        description:
          err instanceof Error ? err.message : "Product form is incomplete.",
        title: "Product form incomplete",
        tone: "error",
      });
      return;
    }

    const targetId = selectedProductId ?? "new";
    setPendingProductId(targetId);

    try {
      if (selectedProductId) {
        const updatedProduct = await storefrontApi.updateProduct(
          selectedProductId,
          payload,
        );

        setProducts((current) =>
          sortProductsForAdmin(
            current.map((product) =>
              product.id === updatedProduct.id ? updatedProduct : product,
            ),
          ),
        );
        startTransition(() => {
          setProductForm(createProductForm(updatedProduct));
        });
        notify({
          description: "Changes are now live in the Firestore catalog.",
          title: `${updatedProduct.name} saved`,
          tone: "success",
        });
      } else {
        const createdProduct = await storefrontApi.createProduct(payload);

        setProducts((current) =>
          sortProductsForAdmin([createdProduct, ...current]),
        );
        startTransition(() => {
          setSelectedProductId(createdProduct.id);
          setProductForm(createProductForm(createdProduct));
        });
        notify({
          description: "The new product is live in the Firestore catalog.",
          title: `${createdProduct.name} created`,
          tone: "success",
        });
      }
    } catch (err) {
      notify({
        description:
          err instanceof Error ? err.message : "Unable to save this product.",
        title: selectedProductId
          ? "Product update failed"
          : "Product creation failed",
        tone: "error",
      });
    } finally {
      setPendingProductId(null);
    }
  }

  async function performDeleteProduct(product: ProductRecord): Promise<void> {
    setPendingProductId(product.id);
    setError(null);

    try {
      await storefrontApi.deleteProduct(product.id);
      setProducts((current) =>
        current.filter((entry) => entry.id !== product.id),
      );

      if (selectedProductId === product.id) {
        resetProductEditor();
      }

      notify({
        description: "The selected product was removed.",
        title: `${product.name} deleted`,
        tone: "success",
      });
    } catch (err) {
      notify({
        description:
          err instanceof Error ? err.message : "Unable to delete this product.",
        title: "Delete failed",
        tone: "error",
      });
    } finally {
      setPendingProductId(null);
    }
  }

  async function handleDeleteProduct(product: ProductRecord): Promise<void> {
    const accepted = await confirm({
      confirmLabel: "Delete product",
      description: `${product.name} will be removed. This action cannot be undone.`,
      title: "Delete this catalog entry?",
      tone: "danger",
    });

    if (!accepted) {
      return;
    }

    await performDeleteProduct(product);
  }

  function handleExportCsv(): void {
    if (orders.length === 0) {
      notify({
        description: "Create or sync orders first, then try exporting again.",
        title: "No sales data to export",
        tone: "info",
      });
      return;
    }

    const fileStamp = new Date().toISOString().slice(0, 10);
    const csv = buildSalesCsv(orders, variantLookup);
    downloadCsv(`watch-shop-sales-${fileStamp}.csv`, csv);
    notify({
      description: "The report has been downloaded as a CSV file.",
      title: "Sales report exported",
      tone: "success",
    });
  }

  function handlePrint(): void {
    window.print();
  }

  function handleExportPdf(): void {
    const previousTitle = document.title;
    const fileStamp = new Date().toISOString().slice(0, 10);

    const cleanupPdfMode = () => {
      document.body.classList.remove(OPERATIONS_PDF_EXPORT_CLASS);
      document.title = previousTitle;
      window.removeEventListener("afterprint", cleanupPdfMode);
      window.clearTimeout(cleanupTimeout);
    };

    document.body.classList.add(OPERATIONS_PDF_EXPORT_CLASS);
    document.title = `watch-shop-operations-${fileStamp}`;
    window.addEventListener("afterprint", cleanupPdfMode, { once: true });
    const cleanupTimeout = window.setTimeout(cleanupPdfMode, 60_000);

    notify({
      description:
        "Choose Save as PDF in the print dialog to export the operations report.",
      title: "PDF export ready",
      tone: "info",
    });

    window.requestAnimationFrame(() => {
      window.print();
    });
  }

  const isProductActionPending =
    uploadingImages ||
    (pendingProductId !== null &&
      (pendingProductId === selectedProductId || pendingProductId === "new"));

  if (authLoading && !user) {
    return (
      <div className="orders-page orders-page--admin">
        <div className="orders-page__ambient" />
        <div className="orders-page__shell orders-page__shell--operations">
          <div className="orders-page__empty-state">
            Loading operations access.
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="orders-page orders-page--admin">
        <div className="orders-page__ambient" />
        <div className="orders-page__shell">
          <section className="member-orders__state">
            <div className="member-orders__state-head">
              <p className="orders-page__eyebrow">Admin operations</p>
              <p className="member-orders__state-copy">
                Sign in with an admin account to open Operations.
              </p>
            </div>
            <p className="member-orders__state-support">
              Customer order tracking remains available from Orders. The
              operations dashboard is reserved for the admin role.
            </p>
            <div className="member-orders__actions">
              <button
                className="orders-page__button orders-page__button--primary"
                onClick={() => openAuthModal("sign-in")}
                type="button"
              >
                Sign in
              </button>
              <Link className="orders-page__button" to="/orders">
                Open orders
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate replace to="/orders" />;
  }

  return (
    <div className="orders-page orders-page--admin">
      <div className="orders-page__ambient" />
      <div className="orders-page__shell orders-page__shell--operations">
        <aside className="operations-sidebar">
          <div className="operations-sidebar__brand">
            <p className="operations-sidebar__brand-kicker">Watch Shop</p>
            <h2>Operations</h2>
            <p>
              Control room for reservations, revenue, and live catalog edits.
            </p>
          </div>

          <nav
            aria-label="Operations sections"
            className="operations-sidebar__nav"
          >
            {ADMIN_SECTIONS.map((section) => {
              const Icon = section.icon;

              return (
                <a
                  key={section.href}
                  className="operations-sidebar__nav-link"
                  href={section.href}
                >
                  <Icon className="operations-sidebar__nav-icon" />
                  <div>
                    <strong>{section.label}</strong>
                    <span>{section.description}</span>
                  </div>
                </a>
              );
            })}
          </nav>

          <div className="operations-sidebar__snapshot">
            <p className="orders-page__eyebrow">Live snapshot</p>
            <strong>
              {loading
                ? "Syncing"
                : `${orders.length} orders / ${products.length} products`}
            </strong>
            <span>
              {pendingAttentionCount} orders need follow-up and{" "}
              {lowStockProducts.length} products are running low.
            </span>
          </div>

          <div className="operations-sidebar__queue">
            <p className="orders-page__eyebrow">Attention queue</p>
            {lowStockProducts.slice(0, 3).map((product) => (
              <button
                key={product.id}
                className="operations-sidebar__queue-item"
                onClick={() => selectProduct(product)}
                type="button"
              >
                <div>
                  <strong>{product.name}</strong>
                  <span>{humanizeToken(product.categoryId)}</span>
                </div>
                <b>{productStock(product)} left</b>
              </button>
            ))}
            {lowStockProducts.length === 0 ? (
              <div className="operations-sidebar__queue-empty">
                Catalog inventory is healthy.
              </div>
            ) : null}
          </div>
        </aside>

        <div className="operations-main">
          <section className="operations-hero" id="operations-overview">
            <div className="operations-hero__copy">
              <p className="orders-page__eyebrow">Admin operations</p>
              <h1 className="orders-page__title">DASHBOARD</h1>
              <p className="orders-page__copy">
                Fundementals on managing your business.
              </p>
            </div>

            <div className="operations-hero__actions" id="operations-export">
              <button
                className="orders-page__button"
                disabled={refreshing}
                onClick={() => {
                  void handleRefresh();
                }}
                type="button"
              >
                <RefreshCw size={16} />
                {refreshing ? "Refreshing" : "Refresh"}
              </button>
              <button
                className="orders-page__button"
                onClick={handlePrint}
                type="button"
              >
                <Printer size={16} />
                Print report
              </button>
              <button
                className="orders-page__button"
                onClick={handleExportPdf}
                type="button"
              >
                <FileDown size={16} />
                Export PDF
              </button>
              <button
                className="orders-page__button orders-page__button--primary"
                onClick={handleExportCsv}
                type="button"
              >
                <Download size={16} />
                Export CSV
              </button>
            </div>
          </section>

          {error ? <p className="orders-page__error">{error}</p> : null}

          {loading ? (
            <div className="orders-page__empty-state">
              Loading the operations dashboard.
            </div>
          ) : (
            <div className="operations-grid">
              <section className="operations-panel operations-panel--metrics">
                <div className="operations-panel__head">
                  <div>
                    <p className="orders-page__eyebrow">KPI snapshot</p>
                    <h2>Daily control surface</h2>
                  </div>
                  <span className="operations-panel__meta">Role: {role}</span>
                </div>

                <div className="operations-metrics-grid">
                  {metricCards.map((metric) => (
                    <AdminMetricCard key={metric.label} {...metric} />
                  ))}
                </div>
              </section>

              <section className="operations-panel operations-panel--sales">
                <div className="operations-panel__head">
                  <div>
                    <p className="orders-page__eyebrow">Revenue momentum</p>
                    <h2>Six-month sales dynamics</h2>
                  </div>
                  <span className="operations-panel__meta">
                    {currentMonthPoint
                      ? formatCurrency(currentMonthPoint.revenue)
                      : formatCurrency(0)}{" "}
                    this month
                  </span>
                </div>

                <SalesBars points={salesSeries} />
              </section>

              <section className="operations-panel operations-panel--distribution">
                <div className="operations-panel__head">
                  <div>
                    <p className="orders-page__eyebrow">Order mix</p>
                    <h2>Status distribution</h2>
                  </div>
                  <span className="operations-panel__meta">
                    {pendingAttentionCount} in motion
                  </span>
                </div>

                <DistributionMeter segments={statusSegments} />

                <div className="operations-stock-list">
                  <div className="operations-stock-list__head">
                    <strong>Low stock queue</strong>
                    <span>{lowStockProducts.length} items</span>
                  </div>
                  {lowStockProducts.slice(0, 4).map((product) => (
                    <button
                      key={product.id}
                      className="operations-stock-list__item"
                      onClick={() => selectProduct(product)}
                      type="button"
                    >
                      <div>
                        <strong>{product.name}</strong>
                        <span>
                          {humanizeToken(product.brandId)} ·{" "}
                          {humanizeToken(product.categoryId)}
                        </span>
                      </div>
                      <b>
                        <span>{productStock(product)}</span>
                        left
                      </b>
                    </button>
                  ))}
                  {lowStockProducts.length === 0 ? (
                    <div className="operations-stock-list__empty">
                      No low-stock product requires attention.
                    </div>
                  ) : null}
                </div>
              </section>

              <section
                className="operations-panel operations-panel--orders"
                id="operations-orders"
              >
                <div className="operations-panel__head">
                  <div>
                    <p className="orders-page__eyebrow">Sales ledger</p>
                    <h2>Order control and fulfillment updates</h2>
                  </div>
                  <span className="operations-panel__meta">
                    {filteredSalesLedgerOrders.length} of {orders.length} reservations
                    visible
                  </span>
                </div>

                {orders.length === 0 ? (
                  <div className="orders-page__empty-state">
                    No orders yet. Checkout activity will populate the control
                    ledger here.
                  </div>
                ) : (
                  <>
                    <div className="operations-ledger-toolbar">
                      <label className="operations-search operations-search--ledger">
                        <Search size={16} />
                        <input
                          onChange={(event: ChangeEvent<HTMLInputElement>) => {
                            setSalesLedgerSearch(event.target.value);
                            setSalesLedgerPage(1);
                          }}
                          placeholder="Search order, customer, phone, item, status, payment, tracking"
                          type="search"
                          value={salesLedgerSearch}
                        />
                      </label>

                      <div className="operations-ledger-toolbar__controls">
                        <span className="operations-ledger-toolbar__range">
                          Showing {salesLedgerRangeStart}-{salesLedgerRangeEnd} of{" "}
                          {filteredSalesLedgerOrders.length}
                        </span>
                        <label className="operations-ledger-size">
                          <span>Rows</span>
                          <select
                            onChange={(event) => {
                              setSalesLedgerPageSize(Number(event.target.value));
                              setSalesLedgerPage(1);
                            }}
                            value={salesLedgerPageSize}
                          >
                            {SALES_LEDGER_PAGE_SIZE_OPTIONS.map((size) => (
                              <option key={size} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                        </label>
                        {salesLedgerSearch.trim() ? (
                          <button
                            className="operations-ledger-clear"
                            onClick={() => {
                              setSalesLedgerSearch("");
                              setSalesLedgerPage(1);
                            }}
                            type="button"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {filteredSalesLedgerOrders.length === 0 ? (
                      <div className="orders-page__empty-state">
                        No orders match this ledger search. Try an order number,
                        customer name, phone, product SKU, or tracking code.
                      </div>
                    ) : (
                      <div className="operations-orders-list">
                        {pagedSalesLedgerOrders.map((order) => {
                      const draft = getDraft(order);
                      const itemSummary = buildOrderItemSummary(
                        order,
                        variantLookup,
                      );
                      const unitSummary = buildOrderUnitSummary(order);
                      const shippingSummary = splitShippingAddress(
                        order.shippingAddress,
                      );

                      return (
                        <motion.article
                          key={order.id}
                          className="operations-order-card"
                          initial={{ opacity: 0, y: 20 }}
                          transition={{ duration: 0.4 }}
                          viewport={{ amount: 0.16, once: true }}
                          whileInView={{ opacity: 1, y: 0 }}
                        >
                          <div className="operations-order-card__summary">
                            <div className="operations-order-card__identity">
                              <p className="orders-page__eyebrow">
                                {order.orderNumber}
                              </p>
                              <h3>{shippingSummary.recipient}</h3>
                              <p className="operations-order-card__address">
                                {shippingSummary.detail}
                              </p>
                              <p className="operations-order-card__date">
                                {formatDateTime(order.createdAt)}
                              </p>
                            </div>
                            <div className="operations-order-card__summary-rail">
                              <span
                                className={`operations-pill operations-pill--${order.status}`}
                              >
                                {formatStatusLabel(order.status)}
                              </span>
                              <strong>
                                {formatCurrency(order.totalAmount)}
                              </strong>
                            </div>
                          </div>

                          <div className="operations-order-card__snapshot">
                            <div className="operations-order-card__snapshot-item operations-order-card__snapshot-item--wide">
                              <span>Reserve contents</span>
                              <strong>{unitSummary}</strong>
                              <p>{itemSummary}</p>
                            </div>
                            <div className="operations-order-card__snapshot-item">
                              <span>Payment</span>
                              <strong>
                                {formatStatusLabel(order.payment?.status)}
                              </strong>
                            </div>
                            <div className="operations-order-card__snapshot-item">
                              <span>Shipping</span>
                              <strong>
                                {formatStatusLabel(order.shipping?.status)}
                              </strong>
                            </div>
                            <div className="operations-order-card__snapshot-item">
                              <span>Method</span>
                              <strong>
                                {formatStatusLabel(order.payment?.method)}
                              </strong>
                            </div>
                          </div>

                          <div className="operations-order-card__dock">
                            <div className="operations-order-card__dock-head">
                              <span>Fulfillment dock</span>
                            </div>

                            <div className="operations-order-card__controls">
                              <label className="operations-field">
                                <span>Status</span>
                                <select
                                  onChange={(event) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [order.id]: {
                                        ...getDraft(order),
                                        status: event.target.value as OrderStatus,
                                      },
                                    }))
                                  }
                                  value={draft.status ?? order.status}
                                >
                                  {ORDER_STATUS_OPTIONS.map((value) => (
                                    <option key={value} value={value}>
                                      {formatStatusLabel(value)}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="operations-field">
                                <span>Payment</span>
                                <select
                                  onChange={(event) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [order.id]: {
                                        ...getDraft(order),
                                        paymentStatus: event.target
                                          .value as PaymentStatus,
                                      },
                                    }))
                                  }
                                  value={
                                    draft.paymentStatus ??
                                    order.payment?.status ??
                                    "pending"
                                  }
                                >
                                  {PAYMENT_STATUS_OPTIONS.map((value) => (
                                    <option key={value} value={value}>
                                      {formatStatusLabel(value)}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="operations-field">
                                <span>Shipping</span>
                                <select
                                  onChange={(event) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [order.id]: {
                                        ...getDraft(order),
                                        shippingStatus: event.target
                                          .value as ShippingStatus,
                                      },
                                    }))
                                  }
                                  value={
                                    draft.shippingStatus ??
                                    order.shipping?.status ??
                                    "pending"
                                  }
                                >
                                  {SHIPPING_STATUS_OPTIONS.map((value) => (
                                    <option key={value} value={value}>
                                      {formatStatusLabel(value)}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="operations-field">
                                <span>Courier</span>
                                <input
                                  onChange={(event) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [order.id]: {
                                        ...getDraft(order),
                                        courierName: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Courier name"
                                  value={draft.courierName ?? ""}
                                />
                              </label>

                              <label className="operations-field">
                                <span>Tracking</span>
                                <input
                                  onChange={(event) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [order.id]: {
                                        ...getDraft(order),
                                        trackingNumber: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Tracking number"
                                  value={draft.trackingNumber ?? ""}
                                />
                              </label>

                              <button
                                className="orders-page__button orders-page__button--primary operations-order-card__save"
                                disabled={pendingOrderId === order.id}
                                onClick={() => {
                                  void handleAdminUpdate(order.id, draft);
                                }}
                                type="button"
                              >
                                {pendingOrderId === order.id ? "Saving" : "Save"}
                              </button>
                            </div>
                          </div>
                        </motion.article>
                      );
                        })}
                      </div>
                    )}

                    <div
                      aria-label="Sales ledger pagination"
                      className="operations-pagination"
                    >
                      <p>
                        Page {activeSalesLedgerPage} of {salesLedgerTotalPages}
                      </p>
                      <div className="operations-pagination__controls">
                        <button
                          disabled={activeSalesLedgerPage <= 1}
                          onClick={() =>
                            setSalesLedgerPage((currentPage) =>
                              Math.max(1, currentPage - 1),
                            )
                          }
                          type="button"
                        >
                          Previous
                        </button>
                        {salesLedgerPaginationTokens.map((token, index) =>
                          token === "ellipsis" ? (
                            <span
                              className="operations-pagination__ellipsis"
                              key={`sales-ledger-ellipsis-${index}`}
                            >
                              ...
                            </span>
                          ) : (
                            <button
                              aria-current={
                                token === activeSalesLedgerPage
                                  ? "page"
                                  : undefined
                              }
                              className={
                                token === activeSalesLedgerPage
                                  ? "operations-pagination__page operations-pagination__page--active"
                                  : "operations-pagination__page"
                              }
                              key={token}
                              onClick={() => setSalesLedgerPage(token)}
                              type="button"
                            >
                              {token}
                            </button>
                          ),
                        )}
                        <button
                          disabled={activeSalesLedgerPage >= salesLedgerTotalPages}
                          onClick={() =>
                            setSalesLedgerPage((currentPage) =>
                              Math.min(salesLedgerTotalPages, currentPage + 1),
                            )
                          }
                          type="button"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>

              <section
                className="operations-panel operations-panel--catalog"
                id="operations-products"
              >
                <div className="operations-panel__head">
                  <div>
                    <p className="orders-page__eyebrow">Catalog manager</p>
                    <h2>Add, edit, or remove products</h2>
                  </div>
                  <span className="operations-panel__meta">
                    Firestore sync through admin product endpoints
                  </span>
                </div>

                <div className="operations-catalog">
                  <div className="operations-catalog__list">
                    <div className="operations-catalog__list-head">
                      <div>
                        <p className="orders-page__eyebrow">Catalog shelf</p>
                        <h3>Pick a product, then edit full-width below</h3>
                      </div>
                      <span className="operations-panel__meta">
                        {filteredProducts.length} visible item
                        {filteredProducts.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <label className="operations-search">
                      <Search size={16} />
                      <input
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                          setProductSearch(event.target.value);
                        }}
                        placeholder="Search by product, SKU, category, or brand"
                        value={productSearch}
                      />
                    </label>

                    <div className="operations-catalog__results">
                      {filteredProducts.map((product) => {
                        const isSelected = product.id === selectedProductId;
                        const leadImage = product.images[0] ?? null;

                        return (
                          <button
                            key={product.id}
                            className={`operations-product-card ${
                              isSelected
                                ? "operations-product-card--selected"
                                : ""
                            }`}
                            onClick={() => selectProduct(product)}
                            type="button"
                          >
                            <div className="operations-product-card__media">
                              {leadImage ? (
                                <img alt={product.name} src={leadImage} />
                              ) : (
                                <div className="operations-product-card__media-fallback">
                                  <Package size={18} />
                                </div>
                              )}
                            </div>

                            <div className="operations-product-card__copy">
                              <div className="operations-product-card__topline">
                                <strong>{product.name}</strong>
                                <span
                                  className={`operations-pill operations-pill--${productStockTone(product)}`}
                                >
                                  {productStock(product)} in stock
                                </span>
                              </div>
                              <p>
                                {humanizeToken(product.brandId)} ·{" "}
                                {humanizeToken(product.categoryId)}
                              </p>
                              <div className="operations-product-card__meta">
                                <span>
                                  {formatCurrency(
                                    productStartingPrice(product),
                                  )}
                                </span>
                                <span>{product.variants.length} variants</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}

                      {filteredProducts.length === 0 ? (
                        <div className="operations-catalog__empty">
                          No catalog item matches the current search.
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <form
                    className="operations-editor"
                    onSubmit={(event) => void handleProductSubmit(event)}
                  >
                    <div className="operations-editor__head">
                      <div>
                        <p className="orders-page__eyebrow">
                          {selectedProductId
                            ? "Editing product"
                            : "Create product"}
                        </p>
                        <h3>
                          {selectedProductId
                            ? "Update catalog entry"
                            : "Add a new product"}
                        </h3>
                      </div>
                      <div className="operations-editor__head-actions">
                        <button
                          className="orders-page__button"
                          onClick={resetProductEditor}
                          type="button"
                        >
                          <CirclePlus size={16} />
                          New draft
                        </button>
                        {selectedProductId ? (
                          <button
                            className="orders-page__button operations-editor__delete"
                            disabled={pendingProductId === selectedProductId}
                            onClick={() => {
                              const product = products.find(
                                (entry) => entry.id === selectedProductId,
                              );

                              if (product) {
                                void handleDeleteProduct(product);
                              }
                            }}
                            type="button"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="operations-editor__grid">
                      <label
                        className={`operations-field ${
                          requiredFieldMessage(productForm.name, "Name")
                            ? "operations-field--invalid"
                            : ""
                        }`}
                      >
                        <FieldLabel label="Name" required />
                        <input
                          aria-invalid={Boolean(
                            requiredFieldMessage(productForm.name, "Name"),
                          )}
                          onChange={(event) =>
                            handleProductFieldChange("name", event.target.value)
                          }
                          placeholder="Product name"
                          value={productForm.name}
                        />
                        <FieldHint
                          message={requiredFieldMessage(
                            productForm.name,
                            "Name",
                          )}
                        />
                      </label>

                      <label
                        className={`operations-field ${
                          requiredFieldMessage(productForm.type, "Type")
                            ? "operations-field--invalid"
                            : ""
                        }`}
                      >
                        <FieldLabel label="Type" required />
                        <input
                          aria-invalid={Boolean(
                            requiredFieldMessage(productForm.type, "Type"),
                          )}
                          onChange={(event) =>
                            handleProductFieldChange("type", event.target.value)
                          }
                          placeholder="Dress watch, diver, chronograph..."
                          value={productForm.type}
                        />
                        <FieldHint
                          message={requiredFieldMessage(
                            productForm.type,
                            "Type",
                          )}
                        />
                      </label>

                      <div
                        className={`operations-field ${
                          requiredFieldMessage(productForm.brandId, "Brand ID")
                            ? "operations-field--invalid"
                            : ""
                        }`}
                      >
                        <FieldLabel label="Brand ID" required />
                        <PresetLookupField
                          fieldLabel="Brand"
                          invalid={Boolean(
                            requiredFieldMessage(
                              productForm.brandId,
                              "Brand ID",
                            ),
                          )}
                          onChange={(value) =>
                            handleProductFieldChange("brandId", value)
                          }
                          onPick={(value) =>
                            handleProductFieldChange("brandId", value)
                          }
                          options={BRAND_PRESETS}
                          placeholder="Rolex"
                          value={productForm.brandId}
                        />
                        <FieldHint
                          fallback={brandPresetInfo.message}
                          fallbackTone={brandPresetInfo.tone}
                          message={requiredFieldMessage(
                            productForm.brandId,
                            "Brand ID",
                          )}
                        />
                      </div>

                      <div
                        className={`operations-field ${
                          requiredFieldMessage(
                            productForm.categoryId,
                            "Category ID",
                          )
                            ? "operations-field--invalid"
                            : ""
                        }`}
                      >
                        <FieldLabel label="Category ID" required />
                        <PresetLookupField
                          fieldLabel="Category"
                          invalid={Boolean(
                            requiredFieldMessage(
                              productForm.categoryId,
                              "Category ID",
                            ),
                          )}
                          onChange={(value) =>
                            handleProductFieldChange("categoryId", value)
                          }
                          onPick={(value) =>
                            handleProductFieldChange("categoryId", value)
                          }
                          options={CATEGORY_PRESETS}
                          placeholder="Luxury"
                          value={productForm.categoryId}
                        />
                        <FieldHint
                          fallback={categoryPresetInfo.message}
                          fallbackTone={categoryPresetInfo.tone}
                          message={requiredFieldMessage(
                            productForm.categoryId,
                            "Category ID",
                          )}
                        />
                      </div>

                      <label
                        className={`operations-field operations-field--full ${
                          descriptionFieldMessage(productForm.description)
                            ? "operations-field--invalid"
                            : ""
                        }`}
                      >
                        <FieldLabel label="Description" required />
                        <textarea
                          aria-invalid={Boolean(
                            descriptionFieldMessage(productForm.description),
                          )}
                          onChange={(event) =>
                            handleProductFieldChange(
                              "description",
                              event.target.value,
                            )
                          }
                          placeholder="Rich editorial copy for the product card and PDP."
                          rows={4}
                          value={productForm.description}
                        />
                        <FieldHint
                          message={descriptionFieldMessage(
                            productForm.description,
                          )}
                        />
                      </label>

                      <div
                        className={`operations-field operations-field--full ${
                          imageFieldMessage(productForm.images)
                            ? "operations-field--invalid"
                            : ""
                        }`}
                      >
                        <FieldLabel label="Product Images" required />
                        <div className="operations-image-picker">
                          <div className="operations-image-picker__panel">
                            <div className="operations-image-picker__copy">
                              <strong>
                                {uploadingImages
                                  ? "Preparing selected images..."
                                  : productForm.images.length > 0
                                    ? `${productForm.images.length} image${
                                        productForm.images.length === 1
                                          ? ""
                                          : "s"
                                      } in the gallery`
                                    : "Upload product images"}
                              </strong>
                              <p>
                                {uploadingImages
                                  ? `Processing ${selectedImageNames.length} file${
                                      selectedImageNames.length === 1 ? "" : "s"
                                    } for the gallery.`
                                  : productForm.images.length > 0
                                    ? "Add more files or remove any thumbnail below."
                                    : "PNG or JPG only, up to 4 MB each."}
                              </p>
                            </div>
                            <label
                              aria-busy={uploadingImages}
                              className={`operations-image-picker__trigger ${
                                uploadingImages
                                  ? "operations-image-picker__trigger--busy"
                                  : ""
                              }`}
                            >
                              <input
                                accept={PRODUCT_IMAGE_ACCEPT}
                                aria-invalid={Boolean(
                                  imageFieldMessage(productForm.images),
                                )}
                                className="operations-image-picker__input"
                                disabled={uploadingImages}
                                multiple
                                onChange={(event) =>
                                  void handleProductImageSelection(event)
                                }
                                type="file"
                              />
                              <span className="operations-image-picker__button">
                                {uploadingImages
                                  ? "Preparing..."
                                  : productForm.images.length > 0
                                    ? "Add more files"
                                    : "Choose files"}
                              </span>
                              <span className="operations-image-picker__status">
                                {selectedImageNames.length > 0
                                  ? `${selectedImageNames.length} selected: ${selectedImageNames.slice(0, 2).join(", ")}${
                                      selectedImageNames.length > 2
                                        ? ` +${selectedImageNames.length - 2} more`
                                        : ""
                                    }`
                                  : productForm.images.length > 0
                                    ? `${productForm.images.length} image${
                                        productForm.images.length === 1
                                          ? ""
                                          : "s"
                                      } currently in the gallery.`
                                    : "PNG or JPG, up to 4 MB each."}
                              </span>
                            </label>
                            {imageUploadError ? (
                              <p className="operations-image-picker__feedback operations-image-picker__feedback--error">
                                {imageUploadError}
                              </p>
                            ) : imageUploadMessage ? (
                              <p className="operations-image-picker__feedback operations-image-picker__feedback--success">
                                {imageUploadMessage}
                              </p>
                            ) : null}
                          </div>

                          {productForm.images.length > 0 ? (
                            <div className="operations-image-picker__grid">
                              {productForm.images.map((image, index) => (
                                <figure
                                  key={`${image}-${index}`}
                                  className="operations-image-picker__card"
                                >
                                  <img
                                    alt={`${productForm.name || "Product"} image ${index + 1}`}
                                    src={image}
                                  />
                                  <figcaption className="operations-image-picker__meta">
                                    <span>
                                      Image {String(index + 1).padStart(2, "0")}
                                    </span>
                                    <button
                                      className="operations-image-picker__remove"
                                      disabled={uploadingImages}
                                      onClick={() => removeProductImage(index)}
                                      type="button"
                                    >
                                      <Trash2 size={14} />
                                      Remove
                                    </button>
                                  </figcaption>
                                </figure>
                              ))}
                            </div>
                          ) : (
                            <div className="operations-image-picker__empty">
                              Your gallery is empty. Add at least one hero image
                              before publishing.
                            </div>
                          )}
                        </div>
                        <FieldHint
                          fallback={
                            productForm.images.length > 0
                              ? `${productForm.images.length} image${productForm.images.length === 1 ? "" : "s"} ready for this product.`
                              : "Pick PNG or JPG files directly from your device."
                          }
                          message={imageFieldMessage(productForm.images)}
                        />
                      </div>
                    </div>

                    <div className="operations-editor__variants">
                      <div className="operations-editor__variants-head">
                        <div>
                          <p className="orders-page__eyebrow">Variants</p>
                          <h4>Price, stock, and SKU matrix</h4>
                        </div>
                        <button
                          className="orders-page__button"
                          onClick={addVariantRow}
                          type="button"
                        >
                          <CirclePlus size={16} />
                          Add variant
                        </button>
                      </div>

                      <div className="operations-editor__variants-summary">
                        <strong>
                          {productForm.variants.length} variant
                          {productForm.variants.length === 1 ? "" : "s"}{" "}
                          configured
                        </strong>
                        <p>
                          Keep each SKU precise before publishing. Price,
                          discount, and stock are saved as live variant records
                          for this product.
                        </p>
                      </div>

                      <div className="operations-variant-list">
                        {productForm.variants.map((variant, index) => {
                          const generatedSku = buildGeneratedSku(
                            productForm,
                            variant,
                            index,
                          );
                          const colorMessage = requiredFieldMessage(
                            variant.color,
                            "Color",
                          );
                          const sizeMessage = sizeFieldMessage(variant.size);
                          const priceMessage = numericFieldMessage(
                            variant.price,
                            "Price",
                          );
                          const stockMessage = numericFieldMessage(
                            variant.stockQuantity,
                            "Stock",
                            { integerOnly: true },
                          );
                          const discountMessage = numericFieldMessage(
                            variant.discountPrice,
                            "Discount",
                            { allowEmpty: true },
                          );
                          const missingIdentity = [
                            colorMessage ? "color" : null,
                            sizeMessage ? "size" : null,
                          ].filter(Boolean);
                          const identityComplete = missingIdentity.length === 0;
                          const pricingComplete =
                            !priceMessage && !stockMessage;
                          const stockValue = Number(variant.stockQuantity || 0);
                          const statusTone =
                            !identityComplete || !pricingComplete
                              ? "draft"
                              : stockValue <= 0
                                ? "critical"
                                : stockValue <= 3
                                  ? "attention"
                                  : "healthy";
                          const statusLabel =
                            statusTone === "draft"
                              ? "Draft"
                              : statusTone === "critical"
                                ? "Sold out"
                                : statusTone === "attention"
                                  ? "Low stock"
                                  : "Ready";
                          const variantTitle =
                            variant.sku.trim() || generatedSku;
                          const variantSummary = identityComplete
                            ? [
                                variant.color.trim(),
                                formatProductSize(variant.size),
                              ]
                                .filter(Boolean)
                                .join(" • ")
                            : `Required: ${missingIdentity.join(" and ")}.`;

                          return (
                            <div
                              key={variant.id ?? `draft-${index}`}
                              className="operations-variant-row"
                            >
                              <div className="operations-variant-row__header">
                                <div className="operations-variant-row__identity">
                                  <span className="operations-variant-row__index">
                                    Variant {String(index + 1).padStart(2, "0")}
                                  </span>
                                  <div className="operations-variant-row__title-wrap">
                                    <strong>{variantTitle}</strong>
                                    <p>{variantSummary}</p>
                                  </div>
                                </div>

                                <div className="operations-variant-row__actions">
                                  <span
                                    className={`operations-variant-row__status operations-variant-row__status--${statusTone}`}
                                  >
                                    {statusLabel}
                                  </span>
                                  <button
                                    aria-label={`Remove variant ${index + 1}`}
                                    className="operations-variant-row__remove"
                                    disabled={productForm.variants.length === 1}
                                    onClick={() => removeVariantRow(index)}
                                    type="button"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>

                              <div className="operations-variant-row__groups">
                                <div className="operations-variant-group">
                                  <div className="operations-variant-group__head">
                                    <span>Identity</span>
                                    <strong>SKU, finish, and size</strong>
                                  </div>

                                  <div className="operations-variant-row__grid operations-variant-row__grid--identity">
                                    <label className="operations-field">
                                      <FieldLabel label="SKU" optional />
                                      <input
                                        onChange={(event) =>
                                          handleVariantChange(
                                            index,
                                            "sku",
                                            event.target.value,
                                          )
                                        }
                                        placeholder={generatedSku}
                                        value={variant.sku}
                                      />
                                      <FieldHint
                                        fallback={
                                          variant.sku.trim().length > 0
                                            ? "Manual override active"
                                            : "Auto-generated"
                                        }
                                        fallbackTone="accent"
                                      />
                                    </label>
                                    <label
                                      className={`operations-field ${
                                        colorMessage
                                          ? "operations-field--invalid"
                                          : ""
                                      }`}
                                    >
                                      <FieldLabel label="Color" required />
                                      <input
                                        aria-invalid={Boolean(colorMessage)}
                                        onChange={(event) =>
                                          handleVariantChange(
                                            index,
                                            "color",
                                            event.target.value,
                                          )
                                        }
                                        placeholder="Color"
                                        value={variant.color}
                                      />
                                      <FieldHint message={colorMessage} />
                                    </label>
                                    <label
                                      className={`operations-field ${
                                        sizeMessage
                                          ? "operations-field--invalid"
                                          : ""
                                      }`}
                                    >
                                      <FieldLabel label="Size" required />
                                      <div className="operations-field__input-wrap operations-field__input-wrap--suffix">
                                        <input
                                          aria-invalid={Boolean(sizeMessage)}
                                          inputMode="decimal"
                                          maxLength={6}
                                          onChange={(event) =>
                                            handleVariantChange(
                                              index,
                                              "size",
                                              event.target.value,
                                            )
                                          }
                                          placeholder="40"
                                          value={variant.size}
                                        />
                                        <span className="operations-field__suffix">
                                          mm
                                        </span>
                                      </div>
                                      <FieldHint
                                        fallback={
                                          formatProductSize(variant.size)
                                            ? `Displayed as ${formatProductSize(
                                                variant.size,
                                              )} on the storefront.`
                                            : "Enter the real case size as a number."
                                        }
                                        message={sizeMessage}
                                      />
                                    </label>
                                  </div>
                                </div>

                                <div className="operations-variant-group">
                                  <div className="operations-variant-group__head">
                                    <span>Commercial</span>
                                    <strong>Price, markdown, and stock</strong>
                                  </div>

                                  <div className="operations-variant-row__grid operations-variant-row__grid--commercial">
                                    <label
                                      className={`operations-field ${
                                        priceMessage
                                          ? "operations-field--invalid"
                                          : ""
                                      }`}
                                    >
                                      <FieldLabel label="Price" required />
                                      <input
                                        aria-invalid={Boolean(priceMessage)}
                                        min="0"
                                        onChange={(event) =>
                                          handleVariantChange(
                                            index,
                                            "price",
                                            event.target.value,
                                          )
                                        }
                                        placeholder="0"
                                        step="0.01"
                                        type="number"
                                        value={variant.price}
                                      />
                                      <FieldHint message={priceMessage} />
                                    </label>
                                    <label
                                      className={`operations-field ${
                                        discountMessage
                                          ? "operations-field--invalid"
                                          : ""
                                      }`}
                                    >
                                      <FieldLabel label="Discount" optional />
                                      <input
                                        aria-invalid={Boolean(discountMessage)}
                                        min="0"
                                        onChange={(event) =>
                                          handleVariantChange(
                                            index,
                                            "discountPrice",
                                            event.target.value,
                                          )
                                        }
                                        placeholder="Optional"
                                        step="0.01"
                                        type="number"
                                        value={variant.discountPrice}
                                      />
                                      <FieldHint
                                        fallback="Optional markdown."
                                        message={discountMessage}
                                      />
                                    </label>
                                    <label
                                      className={`operations-field ${
                                        stockMessage
                                          ? "operations-field--invalid"
                                          : ""
                                      }`}
                                    >
                                      <FieldLabel label="Stock" required />
                                      <input
                                        aria-invalid={Boolean(stockMessage)}
                                        min="0"
                                        onChange={(event) =>
                                          handleVariantChange(
                                            index,
                                            "stockQuantity",
                                            event.target.value,
                                          )
                                        }
                                        placeholder="0"
                                        step="1"
                                        type="number"
                                        value={variant.stockQuantity}
                                      />
                                      <FieldHint message={stockMessage} />
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="operations-editor__footer">
                      <p>
                        Product create, update, and delete actions are routed
                        through the admin product endpoints and persisted to
                        database.
                      </p>
                      <button
                        className="orders-page__button orders-page__button--primary"
                        disabled={isProductActionPending}
                        type="submit"
                      >
                        {selectedProductId ? (
                          <PencilLine size={16} />
                        ) : (
                          <CirclePlus size={16} />
                        )}
                        {uploadingImages
                          ? "Uploading images"
                          : isProductActionPending
                            ? "Saving"
                            : selectedProductId
                              ? "Save product"
                              : "Create product"}
                      </button>
                    </div>
                  </form>
                </div>
              </section>

              <section
                className="operations-panel operations-panel--reviews"
                id="operations-reviews"
              >
                <div className="operations-panel__head">
                  <div>
                    <p className="orders-page__eyebrow">Moderation queue</p>
                    <h2>Ratings &amp; member comments</h2>
                  </div>
                  <span className="operations-panel__meta">
                    {reviews.length} review{reviews.length === 1 ? "" : "s"} in
                    the system
                  </span>
                </div>

                <div className="operations-reviews-toolbar">
                  <label className="operations-search">
                    <Search size={16} />
                    <input
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setReviewSearch(event.target.value)
                      }
                      placeholder="Search by author, product, or comment"
                      value={reviewSearch}
                    />
                  </label>

                  <div className="operations-reviews-sort">
                    {ADMIN_REVIEW_SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        className={`operations-reviews-sort__btn${
                          reviewSort === option.value
                            ? " operations-reviews-sort__btn--active"
                            : ""
                        }`}
                        onClick={() => setReviewSort(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredReviews.length === 0 ? (
                  <div className="orders-page__empty-state">
                    {reviews.length === 0
                      ? "No reviews have been submitted yet."
                      : "No reviews match your search."}
                  </div>
                ) : (
                  <div className="operations-reviews-list">
                    {filteredReviews.map((review) => (
                      <motion.article
                        key={review.id}
                        className="operations-review-card"
                        initial={{ opacity: 0, y: 16 }}
                        transition={{ duration: 0.35 }}
                        viewport={{ amount: 0.16, once: true }}
                        whileInView={{ opacity: 1, y: 0 }}
                      >
                        <div className="operations-review-card__header">
                          <div className="operations-review-card__author">
                            <span className="operations-review-card__avatar">
                              {review.authorInitials}
                            </span>
                            <div>
                              <strong>{review.authorName}</strong>
                              <span>
                                {review.productName ?? review.productId}
                              </span>
                            </div>
                          </div>

                          <div className="operations-review-card__meta">
                            <ReviewStarsRow rating={review.rating} />
                            <span className="operations-review-card__date">
                              {new Intl.DateTimeFormat("en-US", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }).format(
                                new Date(review.updatedAt || review.createdAt),
                              )}
                            </span>
                          </div>
                        </div>

                        {review.comment.trim().length > 0 ? (
                          <p className="operations-review-card__comment">
                            {review.comment}
                          </p>
                        ) : (
                          <p className="operations-review-card__comment operations-review-card__comment--empty">
                            No written comment — star rating only.
                          </p>
                        )}

                        <div className="operations-review-card__footer">
                          <span className="operations-review-card__id">
                            ID: {review.id}
                          </span>
                          <button
                            className="operations-review-card__delete"
                            disabled={pendingReviewId === review.id}
                            onClick={() => {
                              void handleDeleteReview(review.id);
                            }}
                            type="button"
                          >
                            <Trash2 size={14} />
                            {pendingReviewId === review.id
                              ? "Deleting"
                              : "Delete"}
                          </button>
                        </div>
                      </motion.article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
