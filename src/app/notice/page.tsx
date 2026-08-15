import { fixedPageMetadata } from "@/lib/site-config";
import { NOTICE_COPY } from "@/lib/visible-content";

export const metadata = fixedPageMetadata({
  route: "/notice/",
  title: NOTICE_COPY.metadataTitle,
  description: NOTICE_COPY.metadataDescription,
});

export default function NoticePage() {
  return (
    <main className="simple-page notice-page">
      <section className="simple-hero notice-hero">
        <div className="page-shell">
          <span className="eyebrow">{NOTICE_COPY.eyebrow}</span>
          <h1>{NOTICE_COPY.h1}</h1>
          <p>{NOTICE_COPY.heroParagraph}</p>
        </div>
      </section>
      <section className="page-shell simple-content notice-board" aria-labelledby="notice-board-heading">
        <div className="section-heading simple-section-heading notice-board-heading">
          <span>{NOTICE_COPY.boardEyebrow}</span>
          <h2 id="notice-board-heading">{NOTICE_COPY.boardHeading}</h2>
          <p>{NOTICE_COPY.boardParagraph}</p>
        </div>
        <div className="notice-board-list">
          {NOTICE_COPY.items.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <div>
                <h3>{item.heading}</h3>
                {item.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
