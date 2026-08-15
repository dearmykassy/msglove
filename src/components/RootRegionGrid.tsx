import Link from "next/link";
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
        return (
          <Link
            className={`${isHome ? "home-region-card" : "root-region-card"} tone-${CARD_TONES[index]}`}
            href={root.path}
            key={key}
          >
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
