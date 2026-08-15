# 마사지러브

마사지러브는 1,291개 활성 지역 그래프를 제공하는 별도 정적 플랫폼이다.
고객 문장, 검색 메타, 디자인, 에디토리얼 브랜드와 이미지 캠페인은
프로젝트 안에서 독립적으로 관리한다.

## 현재 상태

- Next.js 16.3.0 App Router, 완전 정적 export
- 고정 페이지 7개 + 활성 지역 페이지 1,291개
- 지역 문서 1,291개/문단 9,037개/키워드 7,746개 고유 corpus
- 지역 배너 323장 배정 계약: 322장×4회 + 1장×3회
- 메인홈 전용 히어로 1장 별도 계약
- 이미지 파일은 아직 생성·정제·배포하지 않은 계획 상태
- 실제 도메인과 공개 승인 전까지 robots/noindex fail-closed
- 현재 판정은 공개 GO가 아닌 프로젝트 로컬 `FAST_CANDIDATE`
- 독립 AI 콘텐츠 검토 82개 후보/2,087개 full-text field 전부 명시적 승인
- 로컬 Chromium 기능 QA 9건 PASS: 지역 루트·허브·리프 × 320/390/1440
- AI 검토는 사람 검수가 아니며 로컬 Chromium QA는 in-app browser 검수가 아님

## 명령

```bash
pnpm install
pnpm artifacts:generate
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

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

공개 전에는 `docs/launch-gates.md`의 모든 항목을 통과해야 한다.

## GA4 / Netlify 환경변수

이 사이트 전용 GA4 웹 데이터 스트림을 만든 뒤 Netlify의 **Site configuration →
Environment variables**에 `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX`를 등록하고
다시 배포한다. 이 공개 빌드 변수가 없거나 형식이 잘못되면 Google 태그를 전혀
로드하지 않는다. 이벤트 정의, 개인정보 제한과 전화 클릭 지표의 한계는
[`docs/analytics.md`](docs/analytics.md)를 참고한다.
