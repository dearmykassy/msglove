import { getRuntimeImage } from "@/lib/image-release";

export function ReleasedHeroPicture({ route }: { route: string }) {
  const binding = getRuntimeImage(route);
  if (!binding) return null;
  return (
    <picture className="released-hero-picture" data-asset-id={binding.assetId}>
      <source media="(max-width: 700px)" srcSet={binding.paths.mobile} />
      <source media="(max-width: 1100px)" srcSet={binding.paths.tablet} />
      <img src={binding.paths.desktop} alt="" decoding="async" fetchPriority="high" />
    </picture>
  );
}

export function ReleasedHeaderStyle({ route }: { route: string }) {
  const binding = getRuntimeImage(route);
  if (!binding) return null;
  const declarations = Object.entries(binding.headerBinding.style)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
  return <style data-header-binding={binding.headerBinding.bindingSha256}>{`:root{${declarations}}`}</style>;
}
