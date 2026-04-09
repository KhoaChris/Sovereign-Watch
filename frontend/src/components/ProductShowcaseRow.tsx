import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import type { ProductRecord } from "../shared";
import "../styles/components/product-showcase-row.css";

function startingPrice(product: ProductRecord): number {
  return product.variants.reduce((lowest, variant) => {
    const price = variant.discountPrice ?? variant.price;
    return Math.min(lowest, price);
  }, Number.POSITIVE_INFINITY);
}

function availabilityState(product: ProductRecord): {
  label: string;
  tone: "available" | "limited" | "soldout";
} {
  const stock = product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0);

  if (stock <= 0) {
    return { label: "Sold out", tone: "soldout" };
  }

  if (stock <= 8) {
    return { label: "Low stock", tone: "limited" };
  }

  return { label: "Available now", tone: "available" };
}

export function ProductShowcaseRow({
  index,
  product,
}: {
  index: number;
  product: ProductRecord;
}) {
  const price = startingPrice(product);
  const availability = availabilityState(product);
  const leadVariant = product.variants[0];

  return (
    <motion.article
      className={`product-showcase-row ${index % 2 === 1 ? "product-showcase-row--reverse" : ""}`}
      initial={{ opacity: 0, y: 32 }}
      transition={{ duration: 0.55, delay: index * 0.08 }}
      viewport={{ once: true, amount: 0.25 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <Link className="product-showcase-row__visual" to={`/collection/${product.id}`}>
        <div className="product-showcase-row__orb product-showcase-row__orb--left" />
        <div className="product-showcase-row__orb product-showcase-row__orb--right" />
        <div className="product-showcase-row__stage">
          <div className="product-showcase-row__frame" />
          <img alt={product.name} className="product-showcase-row__image" src={product.images[0]} />
        </div>
        <div className="product-showcase-row__overlay" />
        <div className="product-showcase-row__caption">
          <span>{leadVariant?.sku ?? product.id}</span>
          <span>{leadVariant?.size ?? "Collector spec"}</span>
        </div>
      </Link>

      <div className="product-showcase-row__content">
        <div className="product-showcase-row__topline">
          <span className={`product-showcase-row__availability product-showcase-row__availability--${availability.tone}`}>
            {availability.label}
          </span>
          <span className="product-showcase-row__index">0{index + 1}</span>
        </div>

        <div className="product-showcase-row__copy">
          <p className="product-showcase-row__type">{product.type}</p>
          <div>
            <h3 className="product-showcase-row__title">{product.name}</h3>
            <p className="product-showcase-row__description">{product.description}</p>
          </div>
        </div>

        <div className="product-showcase-row__specs">
          <div className="product-showcase-row__spec">
            <span className="product-showcase-row__spec-label">Model</span>
            <span className="product-showcase-row__spec-value">{leadVariant?.color ?? "Signature"}</span>
          </div>
          <div className="product-showcase-row__spec">
            <span className="product-showcase-row__spec-label">Diameter</span>
            <span className="product-showcase-row__spec-value">{leadVariant?.size ?? "42mm"}</span>
          </div>
          <div className="product-showcase-row__spec">
            <span className="product-showcase-row__spec-label">Inventory</span>
            <span className="product-showcase-row__spec-value">
              {product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0)} pieces
            </span>
          </div>
        </div>

        <div className="product-showcase-row__meta">
          <div>
            <p className="product-showcase-row__price-label">From</p>
            <p className="product-showcase-row__price">${price.toFixed(0)}</p>
          </div>

          <Link
            className="product-showcase-row__link"
            to={`/collection/${product.id}`}
          >
            View Piece
            <ArrowUpRight className="product-showcase-row__link-icon" />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
