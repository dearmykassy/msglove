import Link from "@/components/SiteLink";
import { createRegionContent } from "@/lib/region-content";
import { getDirectChildren, type RegionNode } from "@/lib/regions";

export function RegionDirectory({ node }: { node: RegionNode }) {
  const content = createRegionContent(node);
  const children = getDirectChildren(node);

  if (children.length === 0) {
    const aliases = node.aliases.filter((alias) => alias !== node.displayName);
    return (
      <section className="region-directory leaf-directory" aria-labelledby="region-directory-heading">
        <div className="section-heading horizontal">
          <div>
            <span>포함 행정동</span>
            <h2 id="region-directory-heading">{content.directory.coverageTitle}</h2>
          </div>
          <p>{content.directory.coverageLead}</p>
        </div>
        {aliases.length > 0 ? (
          <div className="alias-list" aria-label={`${node.displayName} 포함 행정동`}>
            {aliases.map((alias) => <span key={alias}>{alias}</span>)}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="region-directory" aria-labelledby="region-directory-heading">
      <div className="section-heading horizontal">
        <div>
          <span>하위 지역</span>
          <h2 id="region-directory-heading">{content.directory.title}</h2>
        </div>
        <p>{content.directory.lead}</p>
      </div>
      <div className="coordinate-grid">
        {children.map((child, index) => (
          <Link key={child.path} href={child.path}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{child.name}</strong>
            <small>{child.representativeCount}개 안내 지역</small>
            <i aria-hidden="true">↗</i>
          </Link>
        ))}
      </div>
    </section>
  );
}
