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
