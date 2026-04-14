import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { ArrowUpRight, Search, SlidersHorizontal, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { storefrontApi } from "../services/api";
import {
  formatProductSize,
  type ProductAvailabilityFilter,
  type ProductDiscoveryQuery,
  type ProductDiscoveryResponse,
  type ProductFacetOption,
  type ProductRecord,
  type ProductSortOption,
} from "../shared";
import "../styles/pages/collection-page.css";

const collectionPosterAsset = "/editorial/7.png";

const availabilityLabels: Record<
  Exclude<ProductAvailabilityFilter, "all">,
  string
> = {
  available: "Ready now",
  limited: "Low stock",
  soldout: "Sold out",
};

const sortOptions: Array<{ label: string; value: ProductSortOption }> = [
  { label: "Newest arrivals", value: "newest" },
  { label: "Price: low to high", value: "price-asc" },
  { label: "Price: high to low", value: "price-desc" },
  { label: "Name: A to Z", value: "name-asc" },
];

const availabilityOptions: Array<{
  label: string;
  value: ProductAvailabilityFilter;
}> = [
  { label: "All stock states", value: "all" },
  { label: "Ready now", value: "available" },
  { label: "Low stock", value: "limited" },
  { label: "Sold out", value: "soldout" },
];

interface CollectionCardImagePresentation {
  scale: number;
  shiftX: number;
  shiftY: number;
}

const DEFAULT_COLLECTION_CARD_IMAGE_PRESENTATION: CollectionCardImagePresentation =
  {
    scale: 1,
    shiftX: 0,
    shiftY: 0,
  };

const collectionCardImagePresentationCache = new Map<
  string,
  CollectionCardImagePresentation
>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fallbackCardImagePresentation(
  image: HTMLImageElement,
): CollectionCardImagePresentation {
  const ratio = image.naturalWidth / image.naturalHeight;

  if (ratio <= 0.56) {
    return { scale: 1.08, shiftX: 0, shiftY: 2.5 };
  }

  if (ratio >= 0.88) {
    return { scale: 0.94, shiftX: 0, shiftY: 1 };
  }

  return DEFAULT_COLLECTION_CARD_IMAGE_PRESENTATION;
}

function detectBackgroundColor(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): [number, number, number] {
  const sampleSpan = Math.max(4, Math.round(Math.min(width, height) * 0.06));
  const sampleOrigins = [
    [0, 0],
    [Math.max(0, width - sampleSpan), 0],
    [0, Math.max(0, height - sampleSpan)],
    [Math.max(0, width - sampleSpan), Math.max(0, height - sampleSpan)],
  ];

  let red = 0;
  let green = 0;
  let blue = 0;
  let samples = 0;

  for (const [originX, originY] of sampleOrigins) {
    for (let y = originY; y < originY + sampleSpan; y += 1) {
      for (let x = originX; x < originX + sampleSpan; x += 1) {
        const index = (y * width + x) * 4;
        const alpha = pixels[index + 3] / 255;

        if (alpha <= 0.02) {
          continue;
        }

        red += pixels[index];
        green += pixels[index + 1];
        blue += pixels[index + 2];
        samples += 1;
      }
    }
  }

  if (samples === 0) {
    return [12, 14, 20];
  }

  return [red / samples, green / samples, blue / samples];
}

function analyzeCollectionCardImage(
  image: HTMLImageElement,
): CollectionCardImagePresentation {
  const fallbackPresentation = fallbackCardImagePresentation(image);
  const maxDimension = 320;
  const scaleFactor = maxDimension / Math.max(image.naturalWidth, image.naturalHeight);
  const width = Math.max(32, Math.round(image.naturalWidth * scaleFactor));
  const height = Math.max(32, Math.round(image.naturalHeight * scaleFactor));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return fallbackPresentation;
  }

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let pixels: Uint8ClampedArray;

  try {
    pixels = context.getImageData(0, 0, width, height).data;
  } catch {
    return fallbackPresentation;
  }

  const [backgroundRed, backgroundGreen, backgroundBlue] =
    detectBackgroundColor(pixels, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = pixels[index + 3];

      if (alpha <= 16) {
        continue;
      }

      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const colorDistance = Math.sqrt(
        (red - backgroundRed) ** 2 +
          (green - backgroundGreen) ** 2 +
          (blue - backgroundBlue) ** 2,
      );
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      const isForeground =
        alpha >= 64 || colorDistance >= 26 || luminance >= 46;

      if (!isForeground) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX === -1 || maxY === -1) {
    return fallbackPresentation;
  }

  const objectWidth = (maxX - minX + 1) / width;
  const objectHeight = (maxY - minY + 1) / height;
  const objectCenterX = (minX + maxX + 1) / 2 / width;
  const objectCenterY = (minY + maxY + 1) / 2 / height;
  const normalizedScale = clamp(
    Math.min(0.64 / objectWidth, 0.8 / objectHeight),
    0.9,
    1.16,
  );
  const shiftX = clamp((0.5 - objectCenterX) * 18, -6, 6);
  const shiftY = clamp((0.55 - objectCenterY) * 22, -5, 8);

  return {
    scale: Number(normalizedScale.toFixed(3)),
    shiftX: Number(shiftX.toFixed(2)),
    shiftY: Number(shiftY.toFixed(2)),
  };
}

function CollectionCardImage({
  alt,
  src,
}: {
  alt: string;
  src: string;
}) {
  const cachedPresentation = collectionCardImagePresentationCache.get(src);
  const [measuredPresentation, setMeasuredPresentation] =
    useState<CollectionCardImagePresentation>(
      cachedPresentation ?? DEFAULT_COLLECTION_CARD_IMAGE_PRESENTATION,
    );
  const [measuredSrc, setMeasuredSrc] = useState(
    cachedPresentation ? src : "",
  );

  useEffect(() => {
    if (cachedPresentation) {
      return;
    }

    let active = true;
    const image = new Image();

    if (!src.startsWith("data:")) {
      image.crossOrigin = "anonymous";
    }

    image.decoding = "async";
    image.onload = () => {
      const nextPresentation = analyzeCollectionCardImage(image);
      collectionCardImagePresentationCache.set(src, nextPresentation);

      if (active) {
        setMeasuredPresentation(nextPresentation);
        setMeasuredSrc(src);
      }
    };
    image.onerror = () => {
      if (active) {
        setMeasuredPresentation(DEFAULT_COLLECTION_CARD_IMAGE_PRESENTATION);
        setMeasuredSrc(src);
      }
    };
    image.src = src;

    return () => {
      active = false;
    };
  }, [cachedPresentation, src]);

  const presentation =
    cachedPresentation ??
    (measuredSrc === src
      ? measuredPresentation
      : DEFAULT_COLLECTION_CARD_IMAGE_PRESENTATION);

  const imageFrameStyle = {
    "--collection-card-image-scale": presentation.scale,
    "--collection-card-image-shift-x": `${presentation.shiftX}%`,
    "--collection-card-image-shift-y": `${presentation.shiftY}%`,
  } as CSSProperties;

  return (
    <div className="collection-page__card-image-frame" style={imageFrameStyle}>
      <img
        alt={alt}
        className="collection-page__card-image"
        loading="lazy"
        src={src}
      />
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function productStartingPrice(product: ProductRecord): number {
  return product.variants.reduce((lowestPrice, variant) => {
    return Math.min(lowestPrice, variant.discountPrice ?? variant.price);
  }, Number.POSITIVE_INFINITY);
}

function productStock(product: ProductRecord): number {
  return product.variants.reduce(
    (stock, variant) => stock + variant.stockQuantity,
    0,
  );
}

function productAvailability(
  product: ProductRecord,
): Exclude<ProductAvailabilityFilter, "all"> {
  const stock = productStock(product);

  if (stock <= 0) {
    return "soldout";
  }

  if (stock <= 8) {
    return "limited";
  }

  return "available";
}

function humanizeFacet(value: string): string {
  return value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function facetLabel(options: ProductFacetOption[], id?: string): string | null {
  if (!id) {
    return null;
  }

  return options.find((option) => option.id === id)?.label ?? humanizeFacet(id);
}

function productLeadImage(product: ProductRecord): string | null {
  return product.images[0] ?? null;
}

function updateParams(
  current: URLSearchParams,
  updates: Record<string, string | null | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(current);

  Object.entries(updates).forEach(([key, value]) => {
    const normalized = value?.trim();

    if (!normalized) {
      next.delete(key);
      return;
    }

    next.set(key, normalized);
  });

  return next;
}

function activeFilterSummary(
  discovery: ProductDiscoveryResponse | null,
  query: ProductDiscoveryQuery & {
    availability: ProductAvailabilityFilter;
    sort: ProductSortOption;
  },
): string[] {
  if (!discovery) {
    return [];
  }

  const summary: string[] = [];

  if (query.search) {
    summary.push(`Search: ${query.search}`);
  }

  const category = facetLabel(discovery.facets.categories, query.category);
  if (category) {
    summary.push(category);
  }

  const brand = facetLabel(discovery.facets.brands, query.brand);
  if (brand) {
    summary.push(brand);
  }

  const size = facetLabel(discovery.facets.sizes, query.size);
  if (size) {
    summary.push(size);
  }

  if (query.availability !== "all") {
    summary.push(availabilityLabels[query.availability]);
  }

  if (query.priceMin !== undefined || query.priceMax !== undefined) {
    const min =
      query.priceMin !== undefined ? formatCurrency(query.priceMin) : "Min";
    const max =
      query.priceMax !== undefined ? formatCurrency(query.priceMax) : "Max";
    summary.push(`${min} - ${max}`);
  }

  return summary;
}

function CollectionProductCard({
  index,
  product,
}: {
  index: number;
  product: ProductRecord;
}) {
  const price = productStartingPrice(product);
  const availability = productAvailability(product);
  const leadVariant = product.variants[0];
  const image = productLeadImage(product);

  return (
    <motion.article
      className="collection-page__card"
      initial={{ opacity: 0, y: 22 }}
      transition={{ duration: 0.45, delay: Math.min(index, 6) * 0.04 }}
      viewport={{ amount: 0.15, once: true }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
    >
      <Link className="collection-page__card-link" to={`/collection/${product.id}`}>
        <div className="collection-page__card-media">
          <div className="collection-page__card-glow" />
          {image ? (
            <CollectionCardImage alt={product.name} src={image} />
          ) : (
            <div className="collection-page__card-placeholder">
              Live image pending
            </div>
          )}

          <div className="collection-page__card-overlay">
            <span className="collection-page__type-chip">{product.type}</span>
            <span
              className={`collection-page__stock-chip collection-page__stock-chip--${availability}`}
            >
              {availabilityLabels[availability]}
            </span>
          </div>
        </div>

        <div className="collection-page__card-body">
          <div className="collection-page__card-copy">
            <h2 className="collection-page__card-title">{product.name}</h2>
            <p className="collection-page__card-description">
              {product.description}
            </p>
          </div>

          <div className="collection-page__card-price">
            <span className="collection-page__card-price-label">From</span>
            <strong className="collection-page__card-price-value">
              {formatCurrency(price)}
            </strong>
          </div>

          <div className="collection-page__card-foot">
            <div className="collection-page__card-specs">
              <span>
                {formatProductSize(leadVariant?.size, "Collector spec")}
              </span>
              <span>{leadVariant?.sku ?? product.id}</span>
            </div>
            <span className="collection-page__card-cta">
              View piece
              <ArrowUpRight className="collection-page__card-arrow" />
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

function CollectionSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="collection-page__skeleton collection-page__skeleton--card"
    >
      <div className="collection-page__skeleton-card">
        <div className="collection-page__skeleton-media">
          <div className="collection-page__skeleton-overlay">
            <span className="collection-page__skeleton-block collection-page__skeleton-pill collection-page__skeleton-pill--type" />
            <span className="collection-page__skeleton-block collection-page__skeleton-pill collection-page__skeleton-pill--stock" />
          </div>

          <div className="collection-page__skeleton-image-wrap">
            <div className="collection-page__skeleton-block collection-page__skeleton-image" />
          </div>
        </div>

        <div className="collection-page__skeleton-body">
          <div className="collection-page__skeleton-copy">
            <span className="collection-page__skeleton-block collection-page__skeleton-line collection-page__skeleton-line--title" />
            <span className="collection-page__skeleton-block collection-page__skeleton-line collection-page__skeleton-line--body" />
            <span className="collection-page__skeleton-block collection-page__skeleton-line collection-page__skeleton-line--body collection-page__skeleton-line--body-short" />
          </div>

          <div className="collection-page__skeleton-price">
            <span className="collection-page__skeleton-block collection-page__skeleton-line collection-page__skeleton-line--label" />
            <span className="collection-page__skeleton-block collection-page__skeleton-line collection-page__skeleton-line--price" />
          </div>

          <div className="collection-page__skeleton-foot">
            <div className="collection-page__skeleton-specs">
              <span className="collection-page__skeleton-block collection-page__skeleton-line collection-page__skeleton-line--spec" />
              <span className="collection-page__skeleton-block collection-page__skeleton-line collection-page__skeleton-line--spec collection-page__skeleton-line--spec-wide" />
            </div>

            <span className="collection-page__skeleton-block collection-page__skeleton-line collection-page__skeleton-line--cta" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CollectionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [discovery, setDiscovery] = useState<ProductDiscoveryResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [resolvedRequestKey, setResolvedRequestKey] = useState("");
  const heroRef = useRef<HTMLElement | null>(null);

  const prefersReducedMotion = useReducedMotion();
  const heroPointerX = useMotionValue(0);
  const heroPointerY = useMotionValue(0);
  const heroPointerSpringX = useSpring(heroPointerX, {
    damping: 24,
    mass: 0.45,
    stiffness: 160,
  });
  const heroPointerSpringY = useSpring(heroPointerY, {
    damping: 24,
    mass: 0.45,
    stiffness: 160,
  });
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start end", "end start"],
  });
  const posterY = useTransform(heroProgress, [0, 0.55, 1], [20, 0, -12]);
  const posterRotate = useTransform(heroProgress, [0, 1], [-2.2, 1]);
  const posterScale = useTransform(
    heroProgress,
    [0, 0.45, 1],
    [0.955, 1, 1.02],
  );
  const heroWordmarkY = useTransform(heroProgress, [0, 1], [28, -20]);
  const heroWordmarkOpacity = useTransform(
    heroProgress,
    [0, 0.45, 1],
    [0.16, 0.34, 0.18],
  );
  const heroGlowOpacity = useTransform(
    heroProgress,
    [0, 0.5, 1],
    [0.34, 0.76, 0.42],
  );
  const heroGlowScale = useTransform(
    heroProgress,
    [0, 0.5, 1],
    [0.92, 1.05, 1.01],
  );
  const heroGlowX = useTransform(heroProgress, [0, 1], [-18, 16]);
  const heroHorizonOpacity = useTransform(
    heroProgress,
    [0, 0.5, 1],
    [0.24, 0.56, 0.34],
  );
  const heroHorizonScale = useTransform(heroProgress, [0, 1], [0.94, 1.08]);
  const heroPosterX = useTransform(() => heroPointerSpringX.get() * 18);
  const heroPosterY = useTransform(
    () => posterY.get() + heroPointerSpringY.get() * 14,
  );
  const heroPosterRotate = useTransform(
    () => posterRotate.get() + heroPointerSpringX.get() * 1.2,
  );
  const heroPosterTiltX = useTransform(
    heroPointerSpringY,
    [-1, 1],
    [4.5, -4.5],
  );
  const heroPosterTiltY = useTransform(
    heroPointerSpringX,
    [-1, 1],
    [-6.5, 6.5],
  );
  const heroGlowMotionX = useTransform(
    () => heroGlowX.get() + heroPointerSpringX.get() * 16,
  );
  const heroGlowMotionY = useTransform(() => heroPointerSpringY.get() * 10);
  const heroHorizonX = useTransform(heroPointerSpringX, [-1, 1], [-20, 20]);
  const heroBeamX = useTransform(heroPointerSpringX, [-1, 1], [-28, 28]);
  const heroBeamY = useTransform(heroPointerSpringY, [-1, 1], [-16, 16]);
  const heroBeamRotate = useTransform(heroPointerSpringX, [-1, 1], [-5, 5]);
  const heroBeamOpacity = useTransform(
    heroProgress,
    [0, 0.45, 1],
    [0.24, 0.58, 0.32],
  );
  const heroOrbitX = useTransform(heroPointerSpringX, [-1, 1], [-14, 14]);
  const heroOrbitY = useTransform(heroPointerSpringY, [-1, 1], [-10, 10]);
  const heroOrbitScale = useTransform(
    heroPointerSpringX,
    [-1, 1],
    [0.985, 1.03],
  );
  const heroOrbitOpacity = useTransform(
    heroProgress,
    [0, 0.45, 1],
    [0.18, 0.44, 0.22],
  );
  const heroPlinthX = useTransform(heroPointerSpringX, [-1, 1], [-12, 12]);
  const heroPlinthScale = useTransform(heroProgress, [0, 1], [0.94, 1.04]);
  const heroFogOpacity = useTransform(
    heroProgress,
    [0, 0.5, 1],
    [0.22, 0.52, 0.3],
  );
  const heroFogX = useTransform(heroPointerSpringX, [-1, 1], [-10, 10]);
  const heroReflectionX = useTransform(heroPointerSpringX, [-1, 1], [-18, 18]);
  const heroReflectionY = useTransform(heroPointerSpringY, [-1, 1], [-10, 8]);

  function handleHeroPointerMove(event: ReactPointerEvent<HTMLElement>): void {
    if (prefersReducedMotion || !heroRef.current) {
      return;
    }

    const bounds = heroRef.current.getBoundingClientRect();
    const nextX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const nextY = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;

    heroPointerX.set(Math.max(-1, Math.min(1, nextX)));
    heroPointerY.set(Math.max(-1, Math.min(1, nextY)));
  }

  function handleHeroPointerLeave(): void {
    heroPointerX.set(0);
    heroPointerY.set(0);
  }

  const searchValue = searchParams.get("search") ?? "";
  const availabilityParam =
    (searchParams.get("availability") as ProductAvailabilityFilter | null) ??
    "all";
  const brandParam = searchParams.get("brand") ?? undefined;
  const categoryParam = searchParams.get("category") ?? undefined;
  const priceMaxParam = searchParams.get("priceMax") ?? undefined;
  const priceMinParam = searchParams.get("priceMin") ?? undefined;
  const sizeParam = searchParams.get("size") ?? undefined;
  const sortParam =
    (searchParams.get("sort") as ProductSortOption | null) ?? "newest";
  const deferredSearch = useDeferredValue(searchValue);
  const currentQuery = useMemo(
    () => ({
      availability: availabilityParam,
      brand: brandParam,
      category: categoryParam,
      priceMax: priceMaxParam ? Number(priceMaxParam) : undefined,
      priceMin: priceMinParam ? Number(priceMinParam) : undefined,
      search: deferredSearch.trim() || undefined,
      size: sizeParam,
      sort: sortParam,
    }),
    [
      availabilityParam,
      brandParam,
      categoryParam,
      deferredSearch,
      priceMaxParam,
      priceMinParam,
      sizeParam,
      sortParam,
    ],
  );
  const currentRequestKey = useMemo(
    () => JSON.stringify({ query: currentQuery, reloadKey }),
    [currentQuery, reloadKey],
  );
  const loading = resolvedRequestKey !== currentRequestKey;
  const activeError = resolvedRequestKey === currentRequestKey ? error : null;

  useEffect(() => {
    if (!isFilterDrawerOpen) {
      return undefined;
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isFilterDrawerOpen]);

  useEffect(() => {
    let active = true;

    storefrontApi
      .getProductDiscovery(currentQuery)
      .then((result) => {
        if (!active) {
          return;
        }

        setDiscovery(result);
        setError(null);
        setResolvedRequestKey(currentRequestKey);
      })
      .catch((requestError: unknown) => {
        if (!active) {
          return;
        }

        setDiscovery(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "The collection archive is temporarily unavailable.",
        );
        setResolvedRequestKey(currentRequestKey);
      });

    return () => {
      active = false;
    };
  }, [currentQuery, currentRequestKey]);

  const collectionItems = discovery?.items ?? [];
  const activeSummary = activeFilterSummary(discovery, currentQuery);
  const hasActiveFilters = activeSummary.length > 0;
  const currentPriceMin = searchParams.get("priceMin") ?? "";
  const currentPriceMax = searchParams.get("priceMax") ?? "";

  function applyQueryPatch(
    updates: Record<string, string | null | undefined>,
  ): void {
    startTransition(() => {
      setSearchParams((current) => updateParams(current, updates));
    });
  }

  function clearAllFilters(): void {
    startTransition(() => {
      setSearchParams(new URLSearchParams());
    });
    setIsFilterDrawerOpen(false);
  }

  function renderFacetOptions(
    title: string,
    param: "brand" | "size" | "availability",
    options: ProductFacetOption[],
    currentValue: string,
  ) {
    const availabilityTotalCount = discovery
      ? discovery.facets.availability.reduce((sum, item) => sum + item.count, 0)
      : 0;

    const decoratedOptions =
      param === "availability"
        ? availabilityOptions.map((option) => ({
            count:
              option.value === "all"
                ? (discovery?.total ?? availabilityTotalCount)
                : (discovery?.facets.availability.find(
                    (entry) => entry.id === option.value,
                  )?.count ?? 0),
            id: option.value,
            label: option.label,
          }))
        : options;

    return (
      <section className="collection-page__drawer-group">
        <div className="collection-page__drawer-group-head">
          <p className="collection-page__drawer-group-title">{title}</p>
        </div>
        <div className="collection-page__drawer-options">
          {decoratedOptions.map((option) => (
            <button
              key={option.id}
              className={`collection-page__drawer-option ${
                currentValue === option.id
                  ? "collection-page__drawer-option--active"
                  : ""
              }`}
              onClick={() => {
                applyQueryPatch({
                  [param]:
                    param === "availability" && option.id === "all"
                      ? null
                      : currentValue === option.id
                        ? null
                        : option.id,
                });
              }}
              type="button"
            >
              <span>{option.label}</span>
              <span>{option.count}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="collection-page">
      <div className="collection-page__ambient collection-page__ambient--left" />
      <div className="collection-page__ambient collection-page__ambient--right" />

      <motion.section
        ref={heroRef}
        className="collection-page__hero"
        initial={{ opacity: 0, y: 20 }}
        onPointerLeave={handleHeroPointerLeave}
        onPointerMove={handleHeroPointerMove}
        transition={{ duration: 0.55 }}
        whileInView={{ opacity: 1, y: 0 }}
      >
        <p className="collection-page__eyebrow collection-page__eyebrow--hero">
          Collection
        </p>

        <motion.h1
          className="collection-page__hero-wordmark"
          style={
            prefersReducedMotion
              ? undefined
              : {
                  opacity: heroWordmarkOpacity,
                  x: heroBeamX,
                  y: heroWordmarkY,
                }
          }
        >
          Marketplace
        </motion.h1>

        <div className="collection-page__hero-stage">
          <motion.div
            aria-hidden="true"
            className="collection-page__hero-horizon"
            style={
              prefersReducedMotion
                ? undefined
                : {
                    opacity: heroHorizonOpacity,
                    scale: heroHorizonScale,
                    x: heroHorizonX,
                  }
            }
          />
          <motion.div
            aria-hidden="true"
            className="collection-page__hero-beam"
            style={
              prefersReducedMotion
                ? undefined
                : {
                    opacity: heroBeamOpacity,
                    rotate: heroBeamRotate,
                    x: heroBeamX,
                    y: heroBeamY,
                  }
            }
          />
          <motion.div
            aria-hidden="true"
            className="collection-page__hero-orbit"
            style={
              prefersReducedMotion
                ? undefined
                : {
                    opacity: heroOrbitOpacity,
                    scale: heroOrbitScale,
                    x: heroOrbitX,
                    y: heroOrbitY,
                  }
            }
          />
          <motion.div
            aria-hidden="true"
            className="collection-page__hero-plinth"
            style={
              prefersReducedMotion
                ? undefined
                : { scaleX: heroPlinthScale, x: heroPlinthX }
            }
          />
          <motion.div
            aria-hidden="true"
            className="collection-page__hero-fog"
            style={
              prefersReducedMotion
                ? undefined
                : { opacity: heroFogOpacity, x: heroFogX }
            }
          />
          <motion.div
            className="collection-page__hero-poster-wrap"
            initial={
              prefersReducedMotion
                ? undefined
                : { opacity: 0, scale: 0.92, y: 46 }
            }
            transition={{ delay: 0.08, duration: 0.75 }}
            viewport={{ amount: 0.45, once: true }}
            whileInView={
              prefersReducedMotion ? undefined : { opacity: 1, scale: 1, y: 0 }
            }
          >
            <motion.div
              className="collection-page__hero-glow"
              style={
                prefersReducedMotion
                  ? undefined
                  : {
                      opacity: heroGlowOpacity,
                      scale: heroGlowScale,
                      x: heroGlowMotionX,
                      y: heroGlowMotionY,
                    }
              }
            />
            <motion.div
              className="collection-page__hero-poster"
              style={
                prefersReducedMotion
                  ? undefined
                  : {
                      rotate: heroPosterRotate,
                      rotateX: heroPosterTiltX,
                      rotateY: heroPosterTiltY,
                      scale: posterScale,
                      x: heroPosterX,
                      y: heroPosterY,
                    }
              }
              whileHover={
                prefersReducedMotion
                  ? undefined
                  : { scale: 1.02, transition: { duration: 0.35 } }
              }
            >
              <motion.span
                aria-hidden="true"
                className="collection-page__hero-reflection"
                style={
                  prefersReducedMotion
                    ? undefined
                    : { x: heroReflectionX, y: heroReflectionY }
                }
              />
              <img
                alt="Sovereign marketplace campaign poster"
                className="collection-page__hero-image"
                src={collectionPosterAsset}
              />
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      <div className="collection-page__shell">
        <motion.section
          className="collection-page__utility"
          initial={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="collection-page__utility-primary">
            <div className="collection-page__utility-module collection-page__utility-module--search">
              <p className="collection-page__utility-label">Search archive</p>
              <label className="collection-page__searchbar">
                <Search className="collection-page__search-icon" />
                <input
                  className="collection-page__search-input"
                  onChange={(event) => {
                    applyQueryPatch({ search: event.target.value || null });
                  }}
                  placeholder="Reference, material, dial, or SKU"
                  value={searchValue}
                />
                {searchValue ? (
                  <button
                    aria-label="Clear search"
                    className="collection-page__search-clear"
                    onClick={() => applyQueryPatch({ search: null })}
                    type="button"
                  >
                    <X className="collection-page__search-clear-icon" />
                  </button>
                ) : null}
              </label>
            </div>

            <div className="collection-page__utility-module collection-page__utility-module--count">
              <p className="collection-page__utility-label">Live references</p>
              <p className="collection-page__utility-value">
                {loading ? "..." : (discovery?.total ?? 0)}
              </p>
            </div>

            <label className="collection-page__utility-module collection-page__utility-module--sort">
              <span className="collection-page__utility-label">Sort</span>
              <select
                className="collection-page__sort-select"
                onChange={(event) =>
                  applyQueryPatch({ sort: event.target.value })
                }
                value={currentQuery.sort}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="collection-page__utility-module collection-page__utility-module--filters"
              onClick={() => setIsFilterDrawerOpen(true)}
              type="button"
            >
              <span className="collection-page__utility-label">
                Advanced filters
              </span>
              <span className="collection-page__filters-trigger">
                <SlidersHorizontal className="collection-page__filters-trigger-icon" />
                Open
              </span>
            </button>
          </div>

          <div className="collection-page__utility-secondary">
            <div className="collection-page__category-rail">
              <button
                className={`collection-page__category-pill ${
                  !currentQuery.category
                    ? "collection-page__category-pill--active"
                    : ""
                }`}
                onClick={() => applyQueryPatch({ category: null })}
                type="button"
              >
                All categories
              </button>

              {(discovery?.facets.categories ?? []).map((category) => (
                <button
                  key={category.id}
                  className={`collection-page__category-pill ${
                    currentQuery.category === category.id
                      ? "collection-page__category-pill--active"
                      : ""
                  }`}
                  onClick={() => applyQueryPatch({ category: category.id })}
                  type="button"
                >
                  {category.label}
                </button>
              ))}
            </div>

            <div className="collection-page__active-strip">
              {hasActiveFilters ? (
                <>
                  {activeSummary.map((item) => (
                    <span key={item} className="collection-page__active-chip">
                      {item}
                    </span>
                  ))}
                  <button
                    className="collection-page__clear-filters"
                    onClick={clearAllFilters}
                    type="button"
                  >
                    Clear all
                  </button>
                </>
              ) : (
                <p className="collection-page__active-hint">
                  Search and category sit up front. Deeper filters stay tucked
                  behind the utility dock.
                </p>
              )}
            </div>
          </div>
        </motion.section>

        <div className="collection-page__content">
          {activeError ? (
            <div className="collection-page__notice collection-page__notice--error">
              <div className="collection-page__notice-copy">
                <p className="collection-page__notice-title">
                  Collection archive unavailable.
                </p>
                <p className="collection-page__notice-text">{activeError}</p>
              </div>
              <button
                className="collection-page__notice-action"
                onClick={() => setReloadKey((value) => value + 1)}
                type="button"
              >
                Retry
              </button>
            </div>
          ) : null}

          {!activeError && loading ? (
            <section className="collection-page__cards">
              {Array.from({ length: 6 }).map((_, index) => (
                <CollectionSkeleton key={index} />
              ))}
            </section>
          ) : null}

          {!activeError &&
          !loading &&
          discovery &&
          discovery.items.length === 0 ? (
            <div className="collection-page__empty">
              <p className="collection-page__empty-title">
                No live references match this cut.
              </p>
              <p className="collection-page__empty-copy">
                Widen the search or reset the active filters to reopen the full
                collection.
              </p>
              <button
                className="collection-page__empty-action"
                onClick={clearAllFilters}
                type="button"
              >
                Reset filters
              </button>
            </div>
          ) : null}

          {!activeError &&
          !loading &&
          discovery &&
          discovery.items.length > 0 ? (
            <section className="collection-page__cards">
              {collectionItems.map((product, index) => (
                <CollectionProductCard
                  key={product.id}
                  index={index}
                  product={product}
                />
              ))}
            </section>
          ) : null}
        </div>
      </div>

      <div
        aria-hidden={!isFilterDrawerOpen}
        className={`collection-page__drawer-backdrop ${
          isFilterDrawerOpen ? "collection-page__drawer-backdrop--visible" : ""
        }`}
        onClick={() => setIsFilterDrawerOpen(false)}
      />

      <div
        className={`collection-page__drawer ${
          isFilterDrawerOpen ? "collection-page__drawer--open" : ""
        }`}
      >
        <div className="collection-page__drawer-shell">
          <div className="collection-page__drawer-head">
            <div>
              <p className="collection-page__eyebrow">Advanced filters</p>
              <p className="collection-page__drawer-copy">
                Tune availability, brand, size, and price without leaving the
                catalog.
              </p>
            </div>
            <button
              aria-label="Close filters"
              className="collection-page__drawer-close"
              onClick={() => setIsFilterDrawerOpen(false)}
              type="button"
            >
              <X className="collection-page__drawer-close-icon" />
            </button>
          </div>

          <div className="collection-page__drawer-body">
            {renderFacetOptions(
              "Availability",
              "availability",
              discovery?.facets.availability ?? [],
              currentQuery.availability,
            )}
            {renderFacetOptions(
              "Brand",
              "brand",
              discovery?.facets.brands ?? [],
              currentQuery.brand ?? "",
            )}
            {renderFacetOptions(
              "Size",
              "size",
              discovery?.facets.sizes ?? [],
              currentQuery.size ?? "",
            )}

            <section className="collection-page__drawer-group">
              <div className="collection-page__drawer-group-head">
                <p className="collection-page__drawer-group-title">
                  Price range
                </p>
                <p className="collection-page__drawer-caption">
                  {discovery
                    ? `${formatCurrency(
                        discovery.facets.priceRange.min,
                      )} - ${formatCurrency(discovery.facets.priceRange.max)}`
                    : "Live range"}
                </p>
              </div>

              <div className="collection-page__price-grid">
                <label className="collection-page__price-field">
                  <span>Min</span>
                  <input
                    inputMode="numeric"
                    onChange={(event) =>
                      applyQueryPatch({ priceMin: event.target.value || null })
                    }
                    placeholder="0"
                    value={currentPriceMin}
                  />
                </label>

                <label className="collection-page__price-field">
                  <span>Max</span>
                  <input
                    inputMode="numeric"
                    onChange={(event) =>
                      applyQueryPatch({ priceMax: event.target.value || null })
                    }
                    placeholder="2500"
                    value={currentPriceMax}
                  />
                </label>
              </div>
            </section>
          </div>

          <div className="collection-page__drawer-actions">
            <button
              className="collection-page__drawer-button"
              onClick={clearAllFilters}
              type="button"
            >
              Reset
            </button>
            <button
              className="collection-page__drawer-button collection-page__drawer-button--primary"
              onClick={() => setIsFilterDrawerOpen(false)}
              type="button"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
