# GA4 운영 계측

## Netlify 설정

각 플랫폼은 서로 다른 GA4 웹 데이터 스트림을 사용한다. Netlify의 해당 사이트에서
**Site configuration → Environment variables**에 다음 공개 빌드 변수를 등록한 뒤
새로 배포한다.

```text
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

이 값은 브라우저에 공개되는 GA 측정 ID이며 비밀키가 아니다. 값이 없거나 `G-` 형식이
아니면 Google 태그 로더와 추적 이벤트를 모두 렌더링하지 않는다. 정적 빌드 결과에
값이 들어가므로 Netlify에서 값을 바꾸면 반드시 다시 배포해야 한다.

## 이벤트 계약

| 이벤트 | 의미 | 파라미터 |
| --- | --- | --- |
| `page_view` | 첫 화면 및 App Router 경로 이동 | `platform_id`, `page_path`, `page_location`, `page_title`, 추론 가능한 경우 `page_type` |
| `phone_cta_clicked` | 브라우저에서 `tel:` 링크를 활성화함 | 위 페이지 문맥, `cta_location`, `transport_type=beacon` |

`tel:` 링크는 문서 단위 위임 리스너로 수집하므로 이후 추가되는 링크도 자동으로
포착된다. `data-analytics-location`에는 `region_hero`처럼 전화번호나 개인 정보가
없는 위치 토큰만 쓴다. 이벤트에는 `href`, 전화번호, CTA 원문, 검색어·쿼리스트링,
이름 또는 이메일을 보내지 않는다. `page_location`은 쿼리·해시를 제외하고,
`page_title`은 전화·이메일 패턴을 가린 뒤 150자로 제한한다.

GA4에서 비교 가능한 보고서를 만들려면 `platform_id`, `page_type`, `cta_location`을
이벤트 범위 맞춤 측정기준으로 등록한다. `page_path`는 경로 분석에 사용한다.
웹 데이터 스트림의 향상된 측정에서 브라우저 기록 변경 기반 페이지뷰가 켜져 있다면
수동 `page_view`와 중복될 수 있으므로 해당 옵션을 끄고 DebugView에서 1회만 들어오는지
확인한다.

## 전화 성과의 한계

`phone_cta_clicked`는 전화 버튼 클릭/활성화 횟수이지 통화 연결, 통화 시간 또는
유효 상담 횟수가 아니다. 웹 브라우저와 GA4만으로 사용자가 전화 앱에서 실제 발신했는지
확인할 수 없다. 유효 콜을 집계하려면 동적 번호 삽입을 지원하는 콜 트래킹 사업자와
통신사/전화 시스템의 연결·통화 로그 또는 webhook을 별도로 연동해야 한다.

## 검증

배포 미리보기에서 Google Tag Assistant 또는 GA4 DebugView를 열고 다음을 확인한다.

1. 페이지 진입 및 내부 이동마다 `page_view`가 한 번씩 보인다.
2. 각 전화 링크를 누르면 `phone_cta_clicked`가 보인다.
3. 이벤트 파라미터에 전화번호나 `tel:` URL이 없다.
4. 환경변수를 제거한 빌드에서는 `googletagmanager.com` 요청이 없다.
