# 마사지러브 이미지 캠페인 계약

## 수량

- 지역 전용 원본: **323장**
- 활성 지역 경로: **1,291개**
- 재사용: **322장×4 + 1장×3 = 1,291**
- 메인홈 전용: **1장**, 지역 재사용 금지
- 전체 생성 작업: 324개, 5레인 65 wave (`64×5 + 4`)

## 생성 규칙

모든 요청은 text-only이며 참조 이미지는 0개다. 왼쪽 45%는 흰색 카피용
저밀도 안전영역, 밝은 건축 초점은 오른쪽 절반에 둔다. 상단에는 반투명
헤더가 놓일 여백을 남긴다. 17개 장면군과 19개 재료군의 323개 조합으로
각 prompt를 고유하게 만든다.

사람, 얼굴, 손, 신체, 실루엣, 침대, 마사지 베드, 치료대, 침실, 문자,
숫자, 로고, 간판, 워터마크, 하트, 벚꽃, 꽃, 별, 별자리, 클럽 분위기,
선정적 표현은 금지한다.

## 공개 전 게이트

1. 전용 세션의 exact job/request 결속과 중복 Send 0 검증
2. 323개 지역 원본 + 홈 1개 파일/SHA 고유성 및 사람 육안 QA
3. 전 원본의 전용 refine 경로 통과
4. desktop 2048×922, tablet 1536×1024, mobile 1024×2048 decode 검증
5. source/refine/public SHA, pHash, 상단 팔레트, 헤더 gradient 결속
6. 홈 이미지가 `/`에서만 쓰이고 지역 assignment에 0건인지 검사
7. staging 원장 검증 후 atomic promotion

계획 원장과 5레인 wave는 `artifacts/image-generation-plan.json`, 전체
route 결속은 `artifacts/image-campaign-contract.json`에 있다. 현재 status는
이미지가 없음을 명시하는 `PLANNED_NO_ASSETS`이며 자동 공개할 수 없다.
