import Link from "next/link";
import type { CSSProperties } from "react";
import { ROOT_REGION_CARD_IMAGES } from "@/data/root-region-card-images";
import {
  ACTIVE_ROOT_KEYS,
  ROOT_LABELS,
  getRootNode,
} from "@/lib/regions";

const CARD_TONES = [
  "plum",
  "rosewood",
  "pearl",
  "aubergine",
  "claret",
  "cocoa",
  "mulberry",
  "garnet",
  "silk",
  "merlot",
  "mauve",
] as const;

const HOME_CARD_PHOTO_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  pointerEvents: "none",
};

const HOME_CARD_PHOTO_OVERLAY_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 0,
  pointerEvents: "none",
  background:
    "linear-gradient(180deg, rgba(20, 11, 16, 0.16) 0%, rgba(20, 11, 16, 0.3) 44%, rgba(20, 11, 16, 0.86) 100%)",
};

type RootRegionGridProps = {
  variant?: "default" | "home";
  cardLabel?: string;
};

export function RootRegionGrid({
  variant = "default",
  cardLabel = "지역 안내",
}: RootRegionGridProps) {
  const isHome = variant === "home";
  return (
    <div className={isHome ? "home-region-grid" : "root-region-grid"}>
      {ACTIVE_ROOT_KEYS.map((key, index) => {
        const root = getRootNode(key);
        const label = ROOT_LABELS[key];
        const image = ROOT_REGION_CARD_IMAGES[key];
        return (
          <Link
            className={`${isHome ? "home-region-card" : `root-region-card tone-${CARD_TONES[index]}`}`}
            href={root.path}
            key={key}
          >
            {isHome ? (
              <>
                <img
                  src={image.src}
                  width={image.width}
                  height={image.height}
                  alt={image.alt}
                  loading="lazy"
                  decoding="async"
                  style={{ ...HOME_CARD_PHOTO_STYLE, objectPosition: image.objectPosition }}
                />
                <span aria-hidden="true" style={HOME_CARD_PHOTO_OVERLAY_STYLE} />
              </>
            ) : null}
            <span className="root-number">{String(index + 1).padStart(2, "0")}</span>
            {isHome ? (
              <div>
                <strong>{label.short}</strong>
                <span>{cardLabel}</span>
              </div>
            ) : (
              <div>
                <small>EVENING AREA</small>
                <h3>{label.short}</h3>
                <p>{label.scope}</p>
              </div>
            )}
            <i aria-hidden="true">↗</i>
          </Link>
        );
      })}
    </div>
  );
}
