import runtimeRelease from "@/data/image-release.generated.json";

export type RuntimeImageBinding = {
  assetId: string;
  paths: {
    desktop: string;
    tablet: string;
    mobile: string;
  };
  palette: {
    dominantHex: string;
    gradientStops: string[];
  };
  headerBinding: {
    paletteSha256: string;
    bindingSha256: string;
    style: Record<string, string>;
  };
  sourceSha256?: string;
  derivedSha256?: Record<string, string>;
};

type RuntimeRelease = {
  schemaVersion: "massage-love-runtime-image-release/v2";
  status: "PENDING_NO_ASSETS" | "COMPLETE";
  home: RuntimeImageBinding | null;
  routes: Record<string, RuntimeImageBinding>;
};

const release = runtimeRelease as RuntimeRelease;

function validBinding(binding: RuntimeImageBinding | null | undefined) {
  if (!binding) return null;
  if (
    !/^MLV-(HOME|RH)-\d{3}$/.test(binding.assetId) ||
    !binding.paths?.desktop?.startsWith("/images/massage-love-heroes/v2/") ||
    !binding.paths?.tablet?.startsWith("/images/massage-love-heroes/v2/") ||
    !binding.paths?.mobile?.startsWith("/images/massage-love-heroes/v2/")
  ) {
    throw new Error("MASSAGE_LOVE_RUNTIME_IMAGE_BINDING_INVALID");
  }
  const expectedHeaderAlpha: Record<string, string> = {
    "--route-header-start": "0.82",
    "--route-header-mid": "0.86",
    "--route-header-end": "0.90",
    "--route-header-border": "0.32",
    "--route-header-shadow": "0.38",
  };
  const entries = Object.entries(binding.headerBinding.style);
  if (entries.length !== Object.keys(expectedHeaderAlpha).length) {
    throw new Error("MASSAGE_LOVE_RUNTIME_HEADER_BINDING_INVALID");
  }
  for (const [key, value] of entries) {
    const expectedAlpha = expectedHeaderAlpha[key];
    if (!expectedAlpha || !new RegExp(`^rgba\\(\\d{1,3}, \\d{1,3}, \\d{1,3}, ${expectedAlpha.replace(".", "\\.")}\\)$`).test(value)) {
      throw new Error("MASSAGE_LOVE_RUNTIME_HEADER_BINDING_INVALID");
    }
  }
  return binding;
}

export function getRuntimeImage(route: string): RuntimeImageBinding | null {
  if (release.status !== "COMPLETE") return null;
  return validBinding(route === "/" ? release.home : release.routes[route]);
}
