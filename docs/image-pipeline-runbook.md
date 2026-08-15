# 마사지러브 이미지 파이프라인 실행서

## 현재 상태

이 파이프라인은 구현·검증만 완료된 상태이며 Meta 제출은 0건이다. 생성 원장은
324개 모두 `planned`, `generationSubmissions: 0`이다. 이미지 제작을 마지막
단계로 둔 사용자 결정과 전체 플랫폼 hero 생성 승인은 확보됐다. 다만 다른 Meta
캠페인과 동시 실행하지 않는 규칙 때문에 Star R043 선택 정합화가 끝난 뒤,
직전 preflight가 `READY`일 때만 `--live`를 실행한다.

## 고정 계약

- 생성 계획: 324개 작업, 65 wave, 최대 5 lane
- 구성: 홈 전용 1개 + 지역 323개
- 지역 사용량: 322개×4 + 1개×3 = 1,291개 경로
- plan SHA-256:
  `7217c6dc1dd98a17b0caec86da68e6c16c9b726898a3c9f971137db3298bd2fa`
- campaign SHA-256:
  `72668e5073767083d0a82eb7402330ae22aab2376d5de9565e8201a3debe9cf2`
- 모든 작업은 text-only, reference 0이다. 홈도 reference 0이며 이를 1로
  거짓 기록하지 않는다.

## 0. 안전한 사전 확인 — Meta 호출 없음

```bash
pnpm images:init
pnpm images:runner:validate
pnpm images:status
pnpm images:verify-contract
pnpm images:preflight
```

`images:status`는 실제 자산과 사람 검수 receipt가 없으면
`BLOCKED_EXPECTED`를 반환한다. 이것이 현재 정상 상태다.

`images:preflight`는 Meta/MCP를 호출하지 않고 plan·campaign·원장 SHA,
프로젝트 runner lock, 공유 `campaign-runner.lock`, 전역 `jobs.json`, 전역 slot
claim, 실행기 의존성을 읽기 전용으로 확인한다. 다른 Meta 캠페인이 끝난 직후와
실제 `--live` 바로 전에 다시 실행해 반드시 `READY`, blocker 0을 확인한다.
실제 runner는 공유 lock을 먼저 원자 획득하므로 마사지러브와 다른 캠페인을
동시에 제출할 수 없다.

## 1. 실제 생성 — 단일 캠페인 handoff와 직전 preflight 뒤에만

```bash
node pipeline/images/run-generation.mjs \
  --live \
  --confirm I_AUTHORIZE_324_TEXT_ONLY_META_SUBMISSIONS
```

실행기는 다음을 강제한다.

1. 기존 `generating/downloading` 작업을 새 Send보다 먼저 drain한다.
2. `submission_uncertain`이 하나라도 있으면 전체 새 Send를 중단한다.
3. 5개 lane을 넘지 않으며 각 wave를 완료한 뒤 다음 wave로 간다.
4. 같은 provider job을 최대 12회만 기다린다.
5. pending/timeout 때문에 replacement job을 만들지 않는다.
6. plan/campaign 파일의 정확한 SHA와 request/prompt/output 결속을 매번 확인한다.
7. 모든 상태 변경을 하나의 직렬 저장 큐로 atomic하게 기록한다.
8. 첫 실행의 0회 제출뿐 아니라 재시작 때도 5개 lane의 실제 제출 누계가
   원장의 확정 제출 누계와 정확히 같아야 한다.
9. provider 출력 루트의 실제 경로를 원장에 고정하고 이후 실행·QA에서
   다른 루트나 심볼릭 링크 탈출을 거부한다.

진행 중인 작업만 회수하고 새 작업을 만들지 않을 때:

```bash
node pipeline/images/run-generation.mjs \
  --live --drain-only \
  --confirm I_AUTHORIZE_324_TEXT_ONLY_META_SUBMISSIONS
```

## 2. 소스 기계 QA와 사람 검수

324개가 모두 완료된 뒤에만 실행된다.

여기에는 홈 전용 `MLV-HOME-001`도 포함된다. 홈 원본 역시 지역 원본과 같은
소스 QA·사람 검수·마사지러브 전용 정제·반응형 QA·사람 검수를 모두 거치며,
기존 플랫폼 정제 결과를 인정하는 면제나 원본의 `public/` 직접 복사는 없다.

```bash
pnpm images:source:qa
pnpm images:source:sheets
```

기계 QA는 디코드·MIME·최소 해상도·16:9·SHA·dHash를 검증하고, 동일
캠페인과 공유 거버넌스에 등록된 다른 플랫폼 공개 이미지 모두를 대상으로
정확 SHA 중복, 공유 규격 `dhash64-v1` 해밍거리 6 이하, 또는 보강 규격
`phash64-dct-v1` 해밍거리 8 이하 중 하나라도 해당하면 차단한다. 소스 contact
sheet는 18장씩 총 18개다.

사람 검수자는 contact sheet와 원본을 모두 확인한 뒤 324개 항목과 모든
체크를 명시적으로 `true`로 기록한 결정 JSON을 준비한다. 자동 승인이나
일괄 기본값은 없다.

```bash
node pipeline/images/source-qa.mjs record-review \
  --decisions /absolute/path/source-review-decisions.json \
  --reviewer owner-reviewer-id \
  --reviewed-at 2026-08-14T12:00:00+09:00 \
  --confirm I_REVIEWED_ALL_324_SOURCE_IMAGES
```

## 3. 반응형 정제와 두 번째 검수

```bash
pnpm images:refine
pnpm images:refined:qa
pnpm images:refined:sheets
```

고정 profile은 다음과 같다.

- desktop: 2048×922 WebP, focus X 0.50
- tablet: 1536×1024 WebP, focus X 0.58
- mobile: 1024×2048 WebP, focus X 0.69

정제 contact sheet는 한 자산의 세 profile을 한 행에 두고 9개 자산씩 총
36장이다. 두 번째 사람 검수도 324개 자산의 세 profile을 모두 확인한다.

```bash
node pipeline/images/refine-release.mjs record-review \
  --decisions /absolute/path/refined-review-decisions.json \
  --reviewer owner-reviewer-id \
  --reviewed-at 2026-08-14T15:00:00+09:00 \
  --confirm I_REVIEWED_ALL_324_REFINED_ASSETS
```

## 4. 팔레트·헤더 결속·원자적 배포

```bash
pnpm images:promote
pnpm artifacts:generate
pnpm build
```

승격은 다음이 모두 있을 때만 가능하다.

- 324개 소스 기계 QA PASS
- 324개 소스 사람 승인
- 972개 반응형 파일 기계 QA PASS
- 324개×3 profile 사람 승인
- 플랫폼 간 SHA/dHash 중복 0

각 desktop 정제 이미지 상단 정확히 18%에서 팔레트를 뽑고 alpha
0.94/0.91/0.88의 반투명 그라데이션을 만든다. 1,291개 경로마다
`paletteSha256`과 `{assetId,palette,route,style}`의 `bindingSha256`을 만든다.
공개 파일은 임시 디렉터리에서 완성한 뒤
`public/images/massage-love-heroes/v1`으로 한 번만 rename한다. 기존 bytes가
다르면 덮어쓰지 않는다. 소스·정제·공개 receipt도 서로 다른 파일이며
no-clobber다.

## 공유 full-image 감사의 현재 차단점

공유 정책은 홈 hero에 `references: 1`을 요구하지만, 마사지러브의 고정된
실제 계획은 text-only `references: 0`이다. 파이프라인은 진실한 0을 내보내며,
공유 정책이 text-only 홈을 명시적으로 허용하기 전에는 full-image 감사와
공개 출시는 계속 차단한다. 콘텐츠 감사 PASS와는 별개의 게이트다.
