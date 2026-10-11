# SNS 콘텐츠 통합 대시보드 — 시트 구조 & UTM 규칙 (v0.1, 확인 대기)

## 0. 공통 원칙
- 구글 시트 = DB. **모든 탭은 `content_id`로 연결**, 브랜드는 `brand` 열로 구분 (브랜드별 시트 분리 X)
- 행 1 = 헤더(영문 snake_case 키), 행 2 = 한글 설명(앱은 건너뜀). 열 순서가 아니라 **헤더 이름**으로 읽음 → 열 추가해도 안 깨짐
- 각 탭 끝에 `ext_1 ~ ext_5` 예비 열 + 가입/GA4 전용 예약 열(빈 값 허용)
- 수집 데이터는 **누적 스냅샷(append)**, 사람이 쓰는 데이터는 **수정(update)**

## 1. ID 규칙
| 대상 | 형식 | 예 |
|---|---|---|
| 브랜드 코드 | `KK` 키드키즈 / `SE` 실버에듀넷 | |
| 채널 코드 | `IG` 인스타 / `YT` 유튜브 / `BL` 네이버 블로그 | |
| **content_id** (채널별 발행물 1건) | `{브랜드}-{채널}-{YYMMDD}-{NN}` (발행 예정일 기준, NN=당일 일련번호) | `KK-IG-261015-01` |
| **topic_id** (소재, 여러 채널 발행물을 묶음) | `T-{YYMM}-{NNN}` | `T-2610-007` |

- 같은 소재를 인스타·블로그에 올리면 content_id는 2개, topic_id는 1개 → "소재 단위" 성과 비교 가능
- content_id는 발행 전(기획 단계)에 생성 → 비틀리 링크를 미리 만들 수 있음

## 2. 탭 설계

### ① `contents` (콘텐츠 목록) — 사람이 관리, 허브 탭
| 열 | 설명 |
|---|---|
| content_id (PK) | 위 규칙 |
| topic_id | 소재 묶음 |
| brand / channel | KK·SE / IG·YT·BL |
| format | card_news · reels · feed_photo · long_video · shorts · blog_post |
| title | 콘텐츠 제목 |
| status | idea → drafting → review → scheduled → published → archived |
| scheduled_at / published_at | 예정/실제 발행일시 |
| post_url | 발행 URL |
| external_id | 인스타 media_id / 유튜브 videoId / 블로그 logNo (수집 매칭 키) |
| owner | 담당자 |
| hook_type, cta_type, topic_category, tags | 소재 분석용 태그 (AI 분석이 사용) |
| has_link | 비틀리 링크 포함 여부 |
| draft_ref | 제작 탭 초안 저장 위치(문서 링크 등) |
| memo, created_at, updated_at | |
| *예약:* signup_count, ga4_sessions, ga4_key_events, ext_1~5 | 나중에 가입·GA4 |

### ② `channel_metrics` (채널 성과) — 자동 수집 + 블로그 엑셀, **long 형식 스냅샷**
키: `content_id` + `snapshot_date`
| 열 | 설명 |
|---|---|
| content_id, brand, channel, snapshot_date, days_since_publish | |
| views | 조회 (IG 조회수/YT views/블로그 조회) |
| reach | 도달·순방문자 |
| likes, comments, shares, saves | 채널에 없는 지표는 빈 값 |
| watch_time_sec, avg_view_pct | 유튜브/릴스 |
| profile_visits, follows | 인스타 |
| subscribers_gained | 유튜브 |
| avg_stay_sec | 블로그 |
| engagement_total (수식) | 좋아요+댓글+공유+저장 |
| source (api / excel / manual), collected_at | |
| extra_json | 채널 특수 지표(스키마 변경 없이 보관) |
| *예약:* ext_1~5 | |

> 스냅샷은 발행 후 D+1, D+3, D+7, D+14, D+30에만 적재(이후 중단) → 시트 행 수 폭증 방지. 대시보드는 content별 "최신 스냅샷"을 기본 표시.

### ③ `bitly_clicks` (비틀리 클릭) — 자동 수집
키: `link_id` + `date`
| 열 | 설명 |
|---|---|
| content_id | 링크 title에서 파싱 (규칙 아래) |
| link_slot | 같은 콘텐츠 내 링크 위치 (main/bio/comment/pin…) |
| bitly_link, long_url_utm | |
| date, clicks | 일별 클릭 |
| top_referrer, top_country | 선택 |
| collected_at | |
| *예약:* ext_1~5 | |

### ④ `topics` (소재 후보)
| 열 | 설명 |
|---|---|
| topic_id (PK), brand | |
| topic_title, angle | 소재명, 접근 각도 |
| source | trend · competitor · ai_recommend · manual · past_hit |
| keywords | 쉼표 구분 |
| target_channels | IG,BL … |
| rationale | 추천 근거 (AI 생성) |
| score | 우선순위 점수 |
| status | candidate → approved → in_production → published → dropped |
| content_ids | 이 소재로 만든 발행물들 |
| created_by (user/claude), created_at | |

### ⑤ `competitors` (경쟁사) — 스냅샷
키: `competitor_id` + `snapshot_date`
| 열 | 설명 |
|---|---|
| competitor_id, brand(우리 쪽 비교 대상), name, channel, handle_or_url | |
| snapshot_date, followers, posts_30d | |
| top_post_url, top_post_title, top_post_metric | 최근 인기 게시물 |
| note | |

### 추가 제안 (요청하신 5개 외 2개)
- `keywords` — 블로그 키워드 스냅샷 (keyword, brand, snapshot_date, 월 검색량PC/모바일, 경쟁도, 문서수). 트렌드 탭의 근거. *competitors에 합칠 수도 있으나 성격이 달라 분리 권장*
- `config` — 브랜드/채널 코드표, 드롭다운 값(status 등), 비틀리 그룹, 수집 대상 계정 ID. 드롭다운의 단일 출처

## 3. 비틀리 UTM & 링크 이름 규칙

**원칙: 링크 1개 = 콘텐츠 1건(+위치). 소문자·영문·숫자·`-`·`_`만 사용. 공백/한글 금지.**

| 파라미터 | 규칙 | 값 |
|---|---|---|
| utm_source | 게시된 플랫폼 | `instagram` / `youtube` / `naverblog` |
| utm_medium | 유입 형태 | 인스타·유튜브 `social`, 블로그 `blog` |
| utm_campaign | **content_id 소문자** (조인 키) | `kk-ig-261015-01` |
| utm_content (선택, 4번째) | 링크 위치 | `bio` / `desc` / `comment` / `pin` / `body` |

- 최종 URL 예: `https://kidkids.example/event?utm_source=instagram&utm_medium=social&utm_campaign=kk-ig-261015-01&utm_content=bio`
- **비틀리 링크 이름(title)** = `{content_id}` (링크 1개일 때) / `{content_id}_{slot}` (여러 개일 때)
  - 예: `KK-IG-261015-01`, `KK-YT-261020-01_desc`
- 비틀리 태그: `brand:KK`, `ch:IG`, `topic:T-2610-007` (그룹은 브랜드별 2개)
- 수집기는 title을 `_`로 split → content_id / slot 분리해 `bitly_clicks`에 적재
- 캠페인에 content_id를 쓰는 이유: 소재·월 단위 묶음은 시트의 `topic_id`·`published_at`으로 이미 가능하고, GA4에서도 같은 키로 나중에 가입과 바로 조인됨
- GA4 "Direct 과다" 대응: 위 UTM이 일관되게 붙으면 소셜/블로그 유입이 분리되기 시작함 (이번 범위 아님, 규칙만 선반영)

## 4. 아키텍처 메모 (확인용)
- Cloudflare Pages(정적 SPA) + **Pages Functions** = 시트 읽기/쓰기 프록시, Claude API 호출 (키는 환경변수)
- 시트 접근: 구글 서비스 계정 (시트에 편집자로 공유)
- 수집 스케줄: Pages Functions는 cron이 없어 **별도 Cloudflare Worker(Cron Trigger)** 로 일 1회 수집 → 시트 append (2단계 이후)
- 접근 제어: Cloudflare Access(회사 이메일) 권장 — 컨펌온과 동일 방식이면 맞추겠음
- 기존 Make.com/Apps Script는 일절 연동하지 않음 (새 시트, 새 repo)

---
## 확인 요청
1. content_id 형식(`KK-IG-261015-01`)과 "채널별 1건 + topic_id로 묶기" 구조 OK?
2. UTM: campaign=content_id, medium=social/blog, 선택 utm_content=링크위치 OK?
3. `keywords`, `config` 탭 2개 추가 OK?
4. 접근 제어는 Cloudflare Access로 갈까요? (컨펌온 방식 알려주시면 맞춤)
