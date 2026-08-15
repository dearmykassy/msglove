import { BUSINESS } from "@/data/business";
import { fixedPageMetadata } from "@/lib/site-config";
import { EVENING_NOTE_COPY } from "@/lib/visible-content";

export const metadata = fixedPageMetadata({
  route: "/evening-note/",
  title: EVENING_NOTE_COPY.metadataTitle,
  description: EVENING_NOTE_COPY.metadataDescription,
});

export default function EveningNotePage() {
  return (
    <main className="editorial-page evening-note-page">
      <section className="page-shell editorial-hero">
        <span className="eyebrow">{EVENING_NOTE_COPY.eyebrow}</span>
        <h1>{EVENING_NOTE_COPY.h1}</h1>
        <p>{EVENING_NOTE_COPY.heroParagraph}</p>
      </section>
      <section className="page-shell editorial-content">
        <div className="section-heading note-heading">
          <span>FOUR-LINE CHECK</span>
          <h2>{EVENING_NOTE_COPY.checklistHeading}</h2>
        </div>
        <div className="note-checklist">
          {EVENING_NOTE_COPY.checklist.map((item, index) => (
            <article key={item.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
        <article className="note-change">
          <span>SCHEDULE CHANGE</span>
          <h2>{EVENING_NOTE_COPY.changeHeading}</h2>
          {EVENING_NOTE_COPY.changeParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <a
            className="primary-button"
            data-analytics-location="evening_note"
            href={BUSINESS.phoneHref}
          >
            {EVENING_NOTE_COPY.phoneCta}
          </a>
        </article>
      </section>
    </main>
  );
}
