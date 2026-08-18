# Repository rules

- Preserve `https://msglove.kr` as the sole production origin for canonical,
  sitemap, robots and feed output unless the owner explicitly changes it.
- Every current and future production platform must ship a tested RSS 2.0 feed
  at `/rss.xml`. Use only canonical indexable editorial pages, same-origin HTTPS
  links, stable permalink GUIDs, complete article text and verified timestamps.
  Never use build time as freshness or publish the regional URL inventory as
  RSS; sitemap remains the complete crawl inventory.
- Do not store secrets in tracked files. Preserve current phone, pricing,
  verification metadata, analytics and index policy unless explicitly changed.
- This is not a Todaki-family platform. In every massage service or course
  image, the massage practitioner must be an adult woman. Treat the customer's
  gender and the practitioner's gender as separate roles and never infer one
  from the other.
- Regional search metadata (`title`, `keywords`, `description`) must use the
  concise labels customers type. For known official administrative tokens,
  strip the longest matching final suffix from `특별자치도|특별자치시|특별시|광역시|도|시`
  (`서울특별시→서울`, `인천광역시→인천`, `경기도→경기`, `수원시→수원`).
  Never strip `구|군|읍|면|동|리` globally, and never truncate lexical place
  names such as `송도`, `월미도`, or `여의도` unless they are explicitly in
  the official-administrative-name allowlist. Disambiguate duplicate place
  names with similarly shortened parent labels. Keep URLs, canonicals, and
  official visible H1/body/breadcrumb/schema names unchanged. Every regional
  route must retain exhaustive tests for all three metadata fields, uniqueness,
  the examples above, and formal-suffix leakage immediately before service keywords.
