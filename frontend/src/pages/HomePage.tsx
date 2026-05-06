import { useEffect, useRef, useState } from "react";

import {
  motion,
  type MotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import {
  formatProductSize,
  type ProductRecord,
  type ProductVariant,
} from "../shared";
import "../styles/pages/home-page.css";

function useMediaQuery(query: string): boolean {
  const getMatches = () =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false;

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);
    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);

    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}

function selectEntryVariant(
  product?: ProductRecord,
): ProductVariant | undefined {
  if (!product) {
    return undefined;
  }

  return product.variants.reduce<ProductVariant | undefined>(
    (selected, variant) => {
      if (!selected) {
        return variant;
      }

      const selectedPrice = selected.discountPrice ?? selected.price;
      const candidatePrice = variant.discountPrice ?? variant.price;
      return candidatePrice < selectedPrice ? variant : selected;
    },
    undefined,
  );
}

function totalStock(product?: ProductRecord): number {
  return (
    product?.variants.reduce(
      (sum, variant) => sum + variant.stockQuantity,
      0,
    ) ?? 0
  );
}

function reserveTone(product?: ProductRecord): string {
  const stock = totalStock(product);

  if (stock <= 0) {
    return "Waitlist only";
  }

  if (stock <= 8) {
    return "Limited allocation";
  }

  return "Reserve available";
}

type EditorialVolume = {
  id: string;
  index: string;
  label: string;
  kicker: string;
  title: string;
  body: string;
  hotspotLabel: string;
};

type EditorialChapterRange = readonly [number, number, number, number];

const editorialVolumes: EditorialVolume[] = [
  {
    id: "layers",
    index: "01",
    label: "Volume I",
    kicker: "Sculpted Layers",
    title: "Crystal lifted, silhouette kept light.",
    body: "The upper architecture separates into readable planes, letting the glass, bezel, and shell feel engineered rather than ornamental.",
    hotspotLabel: "Raised crystal",
  },
  {
    id: "performance",
    index: "02",
    label: "Volume II",
    kicker: "Quiet Performance",
    title: "Information stays calm under pressure.",
    body: "The dial keeps hybrid intelligence discreet and legible, so utility stays present without turning the wrist into a screen.",
    hotspotLabel: "Hybrid dial",
  },
  {
    id: "core",
    index: "03",
    label: "Volume III",
    kicker: "Engineered Core",
    title: "Precision revealed at the point of power.",
    body: "The exposed lower assembly makes the mechanism part of the composition, showing that composure is backed by disciplined motion.",
    hotspotLabel: "Open core",
  },
];

const editorialChapterRanges: EditorialChapterRange[] = [
  [0.1, 0.18, 0.32, 0.38],
  [0.42, 0.48, 0.64, 0.7],
  [0.74, 0.8, 0.96, 1],
];

function EditorialHotspot({
  chapter,
  progress,
  range,
  isAnimated,
}: {
  chapter: EditorialVolume;
  progress: MotionValue<number>;
  range: EditorialChapterRange;
  isAnimated: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [enter, active, linger, exit] = range;
  const xOffset = chapter.id === "performance" ? 14 : -14;

  const opacity = useTransform(
    progress,
    [enter, active, linger, exit],
    [0, 1, 1, 0],
  );
  const x = useTransform(
    progress,
    [enter, active, exit],
    [xOffset, 0, xOffset / 2],
  );
  const y = useTransform(progress, [enter, active, exit], [8, 0, -6]);
  const scale = useTransform(
    progress,
    [enter, active, linger, exit],
    [0.94, 1, 1, 0.96],
  );
  const lineScale = useTransform(
    progress,
    [enter, active, linger, exit],
    [0.3, 1, 1, 0.55],
  );
  const dotScale = useTransform(
    progress,
    [enter, active, linger, exit],
    [0.76, 1.08, 1.08, 0.82],
  );

  return (
    <motion.div
      className={`home-page__story-hotspot home-page__story-hotspot--${chapter.id}`}
      style={
        isAnimated && !prefersReducedMotion
          ? { opacity, scale, x, y }
          : undefined
      }
    >
      <motion.span
        className="home-page__story-hotspot-line"
        style={
          isAnimated && !prefersReducedMotion
            ? { scaleX: lineScale }
            : undefined
        }
      />
      <motion.span
        className="home-page__story-hotspot-dot"
        style={
          isAnimated && !prefersReducedMotion ? { scale: dotScale } : undefined
        }
      />
      <span className="home-page__story-hotspot-label">
        {chapter.hotspotLabel}
      </span>
    </motion.div>
  );
}

function EditorialVolumeBadge({
  chapter,
  progress,
  range,
  isAnimated,
  total,
  position,
}: {
  chapter: EditorialVolume;
  progress: MotionValue<number>;
  range: EditorialChapterRange;
  isAnimated: boolean;
  total: number;
  position: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [enter, active, linger, exit] = range;

  const opacity = useTransform(
    progress,
    [enter, active, linger, exit],
    [0, 1, 1, 0],
  );
  const y = useTransform(
    progress,
    [enter, active, linger, exit],
    [10, 0, 0, -8],
  );

  return (
    <motion.div
      aria-hidden="true"
      className="home-page__story-badge"
      style={
        isAnimated && !prefersReducedMotion ? { opacity, y } : undefined
      }
    >
      <span className="home-page__story-badge-counter">
        <strong>{String(position).padStart(2, "0")}</strong>
        <em>/{String(total).padStart(2, "0")}</em>
      </span>
      <span className="home-page__story-badge-divider" aria-hidden="true" />
      <span className="home-page__story-badge-title">{chapter.kicker}</span>
    </motion.div>
  );
}

function EditorialVolumeItem({
  chapter,
  progress,
  range,
  isAnimated,
}: {
  chapter: EditorialVolume;
  progress: MotionValue<number>;
  range: EditorialChapterRange;
  isAnimated: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [enter, active, linger, exit] = range;

  const opacity = useTransform(
    progress,
    [enter, active, linger, exit],
    [0.28, 1, 1, 0.34],
  );
  const y = useTransform(
    progress,
    [enter, active, linger, exit],
    [24, 0, 0, -18],
  );
  const scale = useTransform(
    progress,
    [enter, active, linger, exit],
    [0.98, 1, 1, 0.985],
  );
  const filter = useTransform(
    progress,
    [enter, active, linger, exit],
    ["blur(6px)", "blur(0px)", "blur(0px)", "blur(2px)"],
  );
  const markerOpacity = useTransform(
    progress,
    [enter, active, linger, exit],
    [0.35, 1, 1, 0.42],
  );
  const markerScale = useTransform(
    progress,
    [enter, active, linger, exit],
    [0.72, 1, 1, 0.8],
  );

  return (
    <motion.article
      className="home-page__story-volume"
      style={
        isAnimated && !prefersReducedMotion
          ? { opacity, y, scale, filter }
          : undefined
      }
    >
      <div className="home-page__story-volume-header">
        <motion.span
          className="home-page__story-volume-dot"
          style={
            isAnimated && !prefersReducedMotion
              ? { opacity: markerOpacity, scale: markerScale }
              : undefined
          }
        />
        <p className="home-page__story-volume-index">
          <span>{chapter.index}</span>
          {chapter.label}
        </p>
      </div>

      <p className="home-page__story-volume-kicker">{chapter.kicker}</p>
      <h3 className="home-page__story-volume-title">{chapter.title}</h3>
      <p className="home-page__story-volume-body">{chapter.body}</p>
    </motion.article>
  );
}

export function HomePage({
  products,
}: {
  products: ProductRecord[];
}) {
  const heroRef = useRef<HTMLElement | null>(null);
  const storyRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const isStoryDesktop = useMediaQuery("(min-width: 768px)");
  const shouldAnimateStory = isStoryDesktop && !prefersReducedMotion;
  const heroReferenceImage = "/editorial/3.png";
  const storyReferenceImage = "/editorial/5.png";

  const heroProduct = products[0];
  const secondaryProduct = products[1] ?? heroProduct;
  const secondaryVariant = selectEntryVariant(secondaryProduct);

  const secondaryAvailability = reserveTone(secondaryProduct);

  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const { scrollYProgress: storyProgress } = useScroll({
    target: storyRef,
    offset: ["start start", "end end"],
  });

  const heroPosterY = useTransform(heroProgress, [0, 1], [0, 40]);
  const heroPosterScale = useTransform(heroProgress, [0, 1], [1, 0.985]);
  const heroBackdropY = useTransform(heroProgress, [0, 1], [0, 28]);
  const heroBackdropScale = useTransform(heroProgress, [0, 1], [1.08, 1.15]);
  const heroHeadingY = useTransform(heroProgress, [0, 1], [0, -18]);
  const heroWatchY = useTransform(heroProgress, [0, 1], [0, -24]);
  const heroWatchScale = useTransform(
    heroProgress,
    [0, 0.45, 1],
    [1, 1.04, 0.98],
  );
  const heroActionsY = useTransform(heroProgress, [0, 1], [0, -10]);

  const storyPanelScale = useTransform(
    storyProgress,
    [0, 0.22, 0.3, 0.84, 1],
    [0.985, 1, 1, 1.008, 0.996],
  );
  const storyPanelY = useTransform(storyProgress, [0, 0.28, 1], [14, 0, -18]);
  const storyVisualX = useTransform(
    storyProgress,
    [0, 0.22, 0.3, 0.66, 1],
    [-18, 0, 0, 14, 6],
  );
  const storyVisualY = useTransform(
    storyProgress,
    [0, 0.24, 0.38, 0.74, 1],
    [14, 0, 0, -10, -4],
  );
  const storyWatchX = useTransform(
    storyProgress,
    [0, 0.22, 0.3, 0.66, 1],
    [-26, 0, 0, 16, 8],
  );
  const storyWatchY = useTransform(
    storyProgress,
    [0, 0.24, 0.38, 0.64, 0.82, 1],
    [16, 0, 0, -6, 10, -4],
  );
  const storyWatchScale = useTransform(
    storyProgress,
    [0, 0.22, 0.3, 0.58, 0.82, 1],
    [0.92, 1, 1, 1.04, 1.08, 1.02],
  );
  const storyWatchRotate = useTransform(
    storyProgress,
    [0, 0.22, 0.3, 0.58, 0.82, 1],
    [-8, 0, 0, 2, 6, 3],
  );
  const storyGlowX = useTransform(
    storyProgress,
    [0, 0.22, 0.3, 0.66, 1],
    [-44, -8, -8, 26, 12],
  );
  const storyGlowY = useTransform(
    storyProgress,
    [0, 0.22, 0.3, 0.66, 1],
    [18, -6, -6, 12, 6],
  );
  const storyGlowScale = useTransform(
    storyProgress,
    [0, 0.22, 0.3, 0.66, 1],
    [0.82, 1, 1, 1.16, 0.98],
  );
  const storyGlowOpacity = useTransform(
    storyProgress,
    [0, 0.22, 0.3, 0.66, 1],
    [0.28, 0.52, 0.52, 0.7, 0.46],
  );
  const storyAuraY = useTransform(
    storyProgress,
    [0, 0.22, 0.3, 0.66, 1],
    [-22, -6, -6, 8, 4],
  );
  const storyAuraScale = useTransform(
    storyProgress,
    [0, 0.22, 0.3, 0.66, 1],
    [0.88, 1, 1, 1.08, 1],
  );
  const storyAuraRotate = useTransform(
    storyProgress,
    [0, 0.22, 0.3, 0.66, 1],
    [-20, -6, -6, 10, 18],
  );
  const storyAuraOpacity = useTransform(
    storyProgress,
    [0, 0.22, 0.3, 0.66, 1],
    [0.1, 0.22, 0.22, 0.36, 0.22],
  );
  const storyCopyOpacity = useTransform(
    storyProgress,
    [0, 0.04, 0.12, 1],
    [0.4, 0.7, 1, 1],
  );
  const storyCopyX = useTransform(
    storyProgress,
    [0, 0.12, 1],
    [18, 0, 0],
  );
  const storyHotspotsOpacity = useTransform(
    storyProgress,
    [0, 0.04, 0.12, 1],
    [0, 0.6, 1, 1],
  );
  const storyHotspotsY = useTransform(
    storyProgress,
    [0, 0.12, 1],
    [10, 0, 0],
  );
  const storyRailOpacity = useTransform(
    storyProgress,
    [0, 0.04, 0.14, 1],
    [0, 0.4, 1, 1],
  );
  const storyRailScale = useTransform(
    storyProgress,
    [0.04, 0.96],
    [0.02, 1],
  );
  const storyMetaY = useTransform(
    storyProgress,
    [0, 0.12, 1],
    [14, 0, -4],
  );
  const storyMetaOpacity = useTransform(
    storyProgress,
    [0, 0.1, 0.92, 1],
    [0.2, 1, 1, 0.85],
  );

  return (
    <div className="home-page">
      <section ref={heroRef} className="home-page__hero">
        <motion.div
          aria-hidden="true"
          className="home-page__hero-backdrop"
          style={
            prefersReducedMotion
              ? undefined
              : { scale: heroBackdropScale, y: heroBackdropY }
          }
        />

        <div className="home-page__hero-shell">
          <motion.div
            className="home-page__hero-poster"
            style={
              prefersReducedMotion
                ? undefined
                : { scale: heroPosterScale, y: heroPosterY }
            }
          >
            <motion.div
              className="home-page__hero-content"
              style={prefersReducedMotion ? undefined : { y: heroHeadingY }}
            >
              <div className="home-page__hero-heading-group">
                <p className="home-page__hero-panel-eyebrow">
                  THE PINNACLE OF HOROLOGY
                </p>
                <h1 className="home-page__hero-title">Command Every Second</h1>
              </div>

              <motion.div
                className="home-page__hero-spotlight"
                style={
                  prefersReducedMotion
                    ? undefined
                    : {
                        scale: heroWatchScale,
                        y: heroWatchY,
                      }
                }
              >
                <motion.div
                  aria-hidden="true"
                  animate={prefersReducedMotion ? undefined : { y: [0, -8, 0] }}
                  className="home-page__hero-watch-frame"
                  transition={{
                    duration: 8,
                    ease: "easeInOut",
                    repeat: Number.POSITIVE_INFINITY,
                  }}
                >
                  <img
                    alt=""
                    className="home-page__hero-watch-image"
                    src={heroReferenceImage}
                  />
                </motion.div>
              </motion.div>

              <motion.div
                className="home-page__hero-actions"
                style={prefersReducedMotion ? undefined : { y: heroActionsY }}
              >
                <Link
                  className="home-page__hero-button home-page__hero-button--primary"
                  to="/collection"
                >
                  View Timepieces
                </Link>
                <Link className="home-page__hero-button" to="/contact">
                  Discover Our Heritage
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section ref={storyRef} id="editorial-story" className="home-page__story">
        <div className="home-page__story-track">
          <div className="home-page__story-stage">
            <motion.div
              className="home-page__story-panel"
              style={
                prefersReducedMotion
                  ? undefined
                  : { scale: storyPanelScale, y: storyPanelY }
              }
            >
              <motion.div
                className="home-page__story-visual"
                style={
                  prefersReducedMotion
                    ? undefined
                    : { x: storyVisualX, y: storyVisualY }
                }
              >
                <div className="home-page__story-visual-stage">
                  <motion.div
                    className="home-page__story-glow"
                    style={
                      prefersReducedMotion
                        ? undefined
                        : {
                            opacity: storyGlowOpacity,
                            scale: storyGlowScale,
                            x: storyGlowX,
                            y: storyGlowY,
                          }
                    }
                  />
                  <motion.div
                    aria-hidden="true"
                    className="home-page__story-aura"
                    style={
                      prefersReducedMotion
                        ? undefined
                        : {
                            opacity: storyAuraOpacity,
                            rotate: storyAuraRotate,
                            scale: storyAuraScale,
                            y: storyAuraY,
                          }
                    }
                  />

                  <motion.img
                    alt={`${secondaryProduct?.name ?? "Editorial"} exploded view`}
                    className="home-page__story-watch"
                    src={storyReferenceImage}
                    style={
                      prefersReducedMotion
                        ? undefined
                        : {
                            rotate: storyWatchRotate,
                            scale: storyWatchScale,
                            x: storyWatchX,
                            y: storyWatchY,
                          }
                    }
                  />

                  <motion.div
                    aria-hidden="true"
                    className="home-page__story-hotspots"
                    style={
                      shouldAnimateStory
                        ? { opacity: storyHotspotsOpacity, y: storyHotspotsY }
                        : undefined
                    }
                  >
                    {editorialVolumes.map((chapter, index) => (
                      <EditorialHotspot
                        key={chapter.id}
                        chapter={chapter}
                        isAnimated={!prefersReducedMotion}
                        progress={storyProgress}
                        range={editorialChapterRanges[index]}
                      />
                    ))}
                  </motion.div>

                  <div className="home-page__story-badges" aria-hidden="true">
                    {editorialVolumes.map((chapter, index) => (
                      <EditorialVolumeBadge
                        key={chapter.id}
                        chapter={chapter}
                        isAnimated={!prefersReducedMotion}
                        position={index + 1}
                        progress={storyProgress}
                        range={editorialChapterRanges[index]}
                        total={editorialVolumes.length}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="home-page__story-copy"
                style={
                  shouldAnimateStory
                    ? { opacity: storyCopyOpacity, x: storyCopyX }
                    : prefersReducedMotion
                      ? undefined
                      : { x: storyCopyX }
                }
              >
                <div className="home-page__story-copyhead">
                  <p className="home-page__section-eyebrow">
                    Editorial Selection
                  </p>
                  <p className="home-page__story-overview">
                    Three measured volumes on silhouette, utility, and core
                    motion, paced to the same calm scroll.
                  </p>
                </div>

                <div className="home-page__story-narrative">
                  <div aria-hidden="true" className="home-page__story-rail">
                    <span className="home-page__story-rail-track" />
                    <motion.span
                      className="home-page__story-rail-progress"
                      style={
                        shouldAnimateStory
                          ? {
                              opacity: storyRailOpacity,
                              scaleY: storyRailScale,
                            }
                          : prefersReducedMotion
                            ? undefined
                            : { scaleY: storyRailScale }
                      }
                    />
                  </div>

                  <div className="home-page__story-volume-list">
                    {editorialVolumes.map((chapter, index) => (
                      <EditorialVolumeItem
                        key={chapter.id}
                        chapter={chapter}
                        isAnimated={!prefersReducedMotion}
                        progress={storyProgress}
                        range={editorialChapterRanges[index]}
                      />
                    ))}
                  </div>
                </div>

                <motion.div
                  className="home-page__story-meta"
                  style={
                    prefersReducedMotion
                      ? undefined
                      : { opacity: storyMetaOpacity, y: storyMetaY }
                  }
                >
                  <div className="home-page__story-stat">
                    <span>Type</span>
                    <strong>
                      {secondaryProduct?.type ?? "Smart Performance"}
                    </strong>
                  </div>
                  <div className="home-page__story-stat">
                    <span>Profile</span>
                    <strong>{formatProductSize(secondaryVariant?.size, "40mm")}</strong>
                  </div>
                  <div className="home-page__story-stat">
                    <span>Access</span>
                    <strong>{secondaryAvailability}</strong>
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="featured" className="home-page__preview">
        <div className="home-page__preview-shell">
          <div className="home-page__preview-interlude">
            <span aria-hidden="true" className="home-page__preview-rule" />
            <p className="home-page__section-eyebrow">Collection Passage</p>
            <h2 className="home-page__featured-title">TIMELESS HERITAGE</h2>
            <p className="home-page__preview-body">
              Beyond this gateway lies the full archive of our limited editions
              and mechanical masterpieces, curated for the discerning collector.
            </p>

            <div className="home-page__preview-meta">
              <span>TECHNICAL SPECIFICATIONS | PRIVATE ACQUISITIONS</span>
            </div>

            <Link className="home-page__section-link" to="/collection">
              DISCOVER PIECES
              <ArrowRight className="home-page__link-icon" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
