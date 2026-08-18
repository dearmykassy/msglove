# 마사지러브 배포 기록

## 2026-08-19 — 안정적인 sitemap lastmod

- 1,301개 canonical URL에 의미 있는 콘텐츠 revision 시각을 route group별로 고정했다.
  홈은 metadata/지역 표현 revision `3ffeec0e`, 일반 고정 페이지는 운영 launch
  `dc5054db`, 지역 1,291개는 검색 메타 revision `6f94fd69`의 실제 commit 시각을 쓴다.
  블로그 2건은 기존 각 글의 `modifiedAt`을 그대로 사용한다.
- 빌드 시각이나 `Date.now()`로 freshness를 만들지 않으며 Google이 무시하는 sitemap
  `priority`·`changefreq`를 제거했다. canonical URL·metadata·화면 문구는 변경하지 않았다.
- 내부 Next 링크는 중앙 `SiteLink`를 통해서만 렌더하고 운영에서는 `prefetch=false`를
  강제한다. wrapper 외 직접 `next/link` import를 막는 전체 source 회귀 계약을 추가해
  자동 `_rsc` crawl 요청의 재발을 차단한다.
- URL 수·고유성, 날짜 parse/nonfuture/stability, 블로그 exact modifiedAt, 금지 필드
  0건을 sitemap 회귀 테스트로 유지한다.
- sitemap/link 집중 계약 5/5와 TypeScript, Next 정적 build 1,306페이지,
  built visible/SEO audit 1,301경로가 통과했다. 변경 파일 lint는 오류 0(기존 img warning
  1)이다. 전체 suite는 이 변경과 무관한 기존 artifact 영수증 2개 누락, visible-copy
  기대값 2건, 전화 CTA 1건, 이미지 preflight lock 1건으로 계속 실패하고, 전체 lint도
  기존 `GoogleAnalytics.tsx`의 `prefer-rest-params` 오류 1건이 남아 있다.

## 2026-08-19 — 고객 검색형 지역 메타 영구 규칙

- 1,291개 지역 title·keywords·description의 검색 지역 표기를 정식 행정명보다
  고객이 입력하는 축약명으로 통일했다. `서울특별시→서울`, `인천광역시→인천`,
  `경기도→경기`, `수원시→수원`처럼 확인된 행정명 토큰의 끝 접미사만 제거한다.
- `구·군·읍·면·동·리`는 일괄 제거하지 않고 `송도·월미도·여의도`처럼 글자 자체가
  `도`로 끝나는 고유 지명도 allowlist 밖에서는 자르지 않는다. 동명 지역은 축약한
  상위 지역명을 붙여 고유하게 유지한다.
- 이 변환은 검색 메타에만 적용한다. URL·canonical 및 화면 H1·본문·breadcrumb·schema의
  기존 정식 지역명은 바꾸지 않는다.
- 전체 경로의 세 메타 필드, 대표 예시, 고유성, 서비스 검색어 직전 정식 접미사,
  동명 지역 구분과 정적 export 값을 회귀 계약으로 검증한다.
- `msgbom` 정본 `069f7ed748c8270f800e76dbf9d8c9e209fb8ce7`에서 다시 생성했으며,
  1,291개 경로의 비메타 화면 콘텐츠 차이는 0건이다. 집중 테스트 14건,
  TypeScript, Next 정적 빌드 1,306페이지와 built SEO 1,301경로 검사가 통과했다.

## 2026-08-17 — 서비스 이미지 역할 규칙

- 토닥이 계열이 아닌 플랫폼의 코스·서비스 이미지에서는 마사지사를 항상
  성인 여성으로 사용한다. 고객 성별과 마사지사 성별을 서로 다른 역할로
  검토하며 혼동하지 않는 영구 규칙을 `AGENTS.md`에 기록했다.

## 2026-08-17 — RSS 2.0 피드

- 네이버 공식 RSS 가이드에 맞춰 최신 블로그 글 2건의 전체 본문을
  `https://msglove.kr/rss.xml`에서 제공한다.
- 링크와 GUID는 `msglove.kr`의 self-canonical HTTPS URL이며, 날짜는 최초
  운영 릴리스 commit `dc5054d`의 실제 시각을 사용한다. 빌드 시각으로
  갱신하지 않는다.
- 지역 1,291개 URL은 RSS에 복제하지 않고 기존 sitemap에서 계속 관리한다.
- RSS 단위 테스트 2건, 변경 파일 ESLint, TypeScript, Next 전체 빌드와 기존
  built SEO 감사가 통과했다. 정적 `out/rss.xml`은 6,590 bytes·item 2건이며
  `xmllint`와 홈의 RSS 자동 발견 링크 1건을 통과했다.
- 운영 배포 후 `https://msglove.kr/rss.xml`은 HTTP 200, `application/xml`,
  item 2건, SHA-256
  `147460e05d233c21b60b05089d34dc10f47ac4ae0c7b07c6b8c17572ae9a1741`이며
  운영 홈의 autodiscovery 링크도 정확히 1건이다.
- 배포 번들의 전체 legacy test/lint는 RSS와 무관한 기존 누락 증거 파일,
  옛 visible-copy 기대값, 기존 GoogleAnalytics lint 오류 때문에 계속 실패한다.
  RSS 변경 파일의 집중 검증과 실제 정적 빌드는 모두 통과했다.
