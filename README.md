# 마사지러브

[마사지러브 공식 사이트](https://msglove.kr/)

마사지러브는 지역별 서비스 범위와 코스, 이용 절차를 확인할 수 있는 방문 마사지
안내 사이트입니다. 고객 문장, 검색 메타, 디자인, 편집 콘텐츠와 이미지는 다른
플랫폼에서 복제하지 않고 이 프로젝트 안에서 독립적으로 관리합니다.

## 운영 페이지

- [지역 안내](https://msglove.kr/areas/)
- [가격 안내](https://msglove.kr/pricing/)
- [이용 가이드](https://msglove.kr/guide/)
- [공지사항](https://msglove.kr/notice/)
- [블로그](https://msglove.kr/blog/)
- [XML 사이트맵](https://msglove.kr/sitemap.xml)
- [RSS 2.0 피드](https://msglove.kr/rss.xml)

## 현재 상태

- Next.js 16.3.0 App Router와 완전 정적 export를 사용합니다.
- 11개 상위 권역을 시작으로 시·군·구와 세부 지역을 연결하며 활성 지역 페이지는
  1,291개입니다.
- 사이트맵은 홈을 포함한 고정·편집 페이지 10개와 지역 페이지를 합친 1,301개
  canonical URL을 제공합니다.
- `robots.txt`는 공개 페이지 수집을 허용하고 사이트맵 위치를 안내합니다.
- 지역 배너 130세트의 데스크톱·태블릿·모바일 WebP 390개가 지역 경로에 배정되어
  있으며 홈 히어로와 11개 상위 권역 카드는 별도 이미지를 사용합니다.
- RSS에는 실제 발행일이 있는 블로그 글 2건의 본문만 포함합니다. 1,291개 지역 URL은
  사이트맵에서 관리합니다.

각 지역 페이지에는 고유 title, description, H1과 self-canonical이 있습니다. 내부
링크는 상위 권역에서 하위 지역으로 이어지며, 근거 없는 후기·도착 시간·인력·효능은
게시하지 않습니다. 검색어를 정해진 비율로 반복하기보다 해당 지역에서 확인해야 할
정보를 자연스러운 문장으로 설명합니다.

## 개발과 검증

```bash
pnpm install
pnpm artifacts:generate
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

배포 후 `https://msglove.kr/rss.xml`이 RSS 2.0 XML과 최신 블로그 글 2건을
반환하는지도 확인한다. 전체 지역 URL 목록은 기존 sitemap에서 관리한다.

`pnpm build`는 corpus와 이미지 계획 원장을 결정적으로 다시 만든 뒤
`out/`에 정적 사이트를 내보내고, built semantic·AI 검토·로컬 Chromium·
FAST 후보 영수증을 현재 입력 해시에 다시 결속한다.

## 주요 산출물

- `artifacts/content-corpus.json`
- `artifacts/image-campaign-contract.json`
- `artifacts/image-generation-plan.json`
- `artifacts/region-source-manifest.json`
- `artifacts/artifact-receipt.json`
- `artifacts/content-ai-review-decisions.v1.json`
- `artifacts/content-ai-review.v1.json`
- `artifacts/local-chromium-qa.v1.json`
- `artifacts/fast-candidate.v1.json`

운영 origin은 `src/lib/site-config.ts`에 `https://msglove.kr`로 고정되어 canonical,
Open Graph, robots와 sitemap이 같은 호스트를 가리킵니다. 계획 단계에서 만든 일부
감사 산출물은 이력으로 남아 있으며 현재 운영 여부는 소스의 index/follow 설정과
실제 배포 결과를 기준으로 판단합니다.

## GA4 / Netlify 환경변수

이 사이트 전용 GA4 웹 데이터 스트림을 만든 뒤 Netlify의 **Site configuration →
Environment variables**에 `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX`를 등록하고
다시 배포합니다. 이 공개 빌드 변수가 없거나 형식이 잘못되면 Google 태그를 전혀
로드하지 않습니다. 이벤트 정의, 개인정보 제한과 전화 클릭 지표의 한계는
[`docs/analytics.md`](docs/analytics.md)를 참고하세요.
