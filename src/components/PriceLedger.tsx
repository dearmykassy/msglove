import { COURSE_PRICING } from "@/data/business";
import type { RegionalPriceCourse } from "@/lib/region-content";

function formatPrice(price: number): string {
  return `${price.toLocaleString("ko-KR")}원`;
}

export function PriceLedger({
  compact = false,
  pricing,
}: {
  compact?: boolean;
  pricing?: readonly RegionalPriceCourse[];
}) {
  const courses = pricing
    ? pricing.map((course) => ({
        id: course.id,
        name: course.name,
        items: course.options.map((item) => ({
          minutes: item.minutes,
          price: item.priceKrw,
        })),
      }))
    : COURSE_PRICING.map((course) => ({ ...course, id: course.name }));

  return (
    <div className={compact ? "price-ledger compact" : "price-ledger"}>
      {courses.map((course, index) => (
        <article key={course.name} className="price-row" id={`course-${course.id}`}>
          <span className="price-index">{String(index + 1).padStart(2, "0")}</span>
          <h3>{course.name}</h3>
          <div className="price-items">
            {course.items.map((item) => (
              <span key={`${course.name}-${item.minutes}`}>
                <b>{item.minutes}분</b>
                {formatPrice(item.price)}
              </span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
