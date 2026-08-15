import { RootRegionGrid } from "@/components/RootRegionGrid";
import { fixedPageMetadata } from "@/lib/site-config";
import { AREAS_COPY } from "@/lib/visible-content";

export const metadata = fixedPageMetadata({
  route: "/areas/",
  title: AREAS_COPY.metadataTitle,
  description: AREAS_COPY.metadataDescription,
});

export default function AreasPage() {
  return (
    <main className="simple-page love-fixed-page love-fixed-areas">
      <section className="simple-hero love-fixed-hero">
        <div className="page-shell love-fixed-hero-inner">
          <span className="eyebrow">{AREAS_COPY.eyebrow}</span>
          <h1>{AREAS_COPY.h1}</h1>
          <p>{AREAS_COPY.heroParagraph}</p>
        </div>
      </section>
      <section className="page-shell simple-content love-fixed-content" aria-labelledby="areas-directory-heading">
        <div className="section-heading simple-section-heading love-fixed-heading">
          <span>{AREAS_COPY.directoryEyebrow}</span>
          <h2 id="areas-directory-heading">{AREAS_COPY.directoryHeading}</h2>
          <p>{AREAS_COPY.directoryParagraph}</p>
        </div>
        <RootRegionGrid />
      </section>
    </main>
  );
}
