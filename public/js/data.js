// ⚠ 가짜(샘플) 데이터. 실제 연결 단계에서 구글 시트 데이터로 교체됩니다.
const BRANDS = { KK: '키드키즈', SE: '실버에듀넷' };
const CHANNELS = { IG: '인스타그램', YT: '유튜브', BL: '네이버 블로그' };
const CH_COLOR = { IG: 'var(--c-ig)', YT: 'var(--c-yt)', BL: 'var(--c-bl)' };
const STATUS = { idea: '아이디어', drafting: '제작중', review: '검수', scheduled: '발행예정', published: '발행완료' };
const DAYS = 730;

function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(20261011);
const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
function dayDate(i) { const d = new Date(TODAY); d.setDate(d.getDate() - i); return d; }
function ymd(d) { return String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
function mmdd(d) { return (d.getMonth() + 1) + '/' + d.getDate(); }

// 일별 채널 성과 (DAILY[브랜드][채널][i], i=0 이 오늘, 큰 숫자일수록 과거)
const BASE = { KK: { IG: 5200, YT: 8800, BL: 1900 }, SE: { IG: 2100, YT: 3600, BL: 3300 } };
const DAILY = {};
for (const b in BRANDS) {
  DAILY[b] = {};
  for (const c in CHANNELS) {
    const arr = []; let followers = { IG: 12000, YT: 6400, BL: 900 }[c] * (b === 'KK' ? 1.6 : 1);
    for (let i = DAYS - 1; i >= 0; i--) {
      let trend = 1;
      if (b === 'KK' && c === 'IG' && i < 14) trend = 0.68;   // 샘플: 키드키즈 인스타 최근 하락
      if (b === 'SE' && c === 'YT' && i < 20) trend = 1.45;   // 샘플: 실버에듀넷 유튜브 최근 상승
      if (b === 'SE' && c === 'BL' && i < 10) trend = 1.2;
      const wk = [0.8, 1.05, 1.1, 1.1, 1.05, 0.95, 0.85][dayDate(i).getDay()];
      const reach = Math.round(BASE[b][c] * trend * wk * (0.8 + R() * 0.4));
      const views = Math.round(reach * (c === 'YT' ? 0.9 : c === 'IG' ? 1.3 : 0.85));
      const er = (c === 'IG' ? 0.06 : c === 'YT' ? 0.035 : 0.02) * (b === 'KK' && c === 'IG' && i < 14 ? 0.85 : 1) * (0.85 + R() * 0.3);
      const eng = Math.round(reach * er);
      const gain = Math.round((trend > 1 ? 14 : trend < 1 ? 1 : 6) * (0.5 + R()));
      followers += gain;
      arr[i] = { date: dayDate(i), reach, views, likes: Math.round(eng * 0.7), comments: Math.round(eng * 0.08), shares: Math.round(eng * 0.1), saves: Math.round(eng * 0.12), eng, clicks: Math.round(reach * 0.012 * (0.6 + R() * 0.8)), gain, followers };
    }
    DAILY[b][c] = arr;
  }
}

// 콘텐츠 목록
const FORMATS = { IG: ['카드뉴스', '릴스', '피드사진'], YT: ['롱폼', '쇼츠'], BL: ['블로그글'] };
const TOPICS = { KK: ['육아 꿀팁', '놀이 활동', '학습 습관', '이벤트', '제품 소개'], SE: ['시니어 디지털', '건강 상식', '평생학습', '수강 후기', '이벤트'] };
const TITLES = {
  KK: ['아이 집중력 키우는 5분 놀이', '우리 아이 첫 책 고르는 법', '비 오는 날 집콕 놀이 7가지', '초등 입학 전 체크리스트', '10월 가족 이벤트 안내', '아이와 함께하는 종이접기', '잠들기 전 그림책 루틴', '아이 낯가림 이렇게 해보세요'],
  SE: ['스마트폰 사진 정리 쉽게 하기', '무릎 건강 지키는 스트레칭', '은퇴 후 배우기 좋은 취미 5가지', '수강생 인터뷰: 처음 배운 키오스크', '카카오톡 단체방 활용법', '혈압 관리 식단 이야기', '시니어 영상통화 가이드', '가을 특강 모집 안내']
};
const CONTENTS = [];
const seq = {};
for (const b in BRANDS) for (const c in CHANNELS) {
  const n = c === 'BL' ? 110 : 120;
  for (let k = 0; k < n; k++) {
    const ago = Math.round(R() * 700) + 1;
    const dt = dayDate(ago);
    const key = b + c + ymd(dt); seq[key] = (seq[key] || 0) + 1;
    const fmt = FORMATS[c][Math.floor(R() * FORMATS[c].length)];
    const topic = TOPICS[b][Math.floor(R() * TOPICS[b].length)];
    const boost = (fmt === '릴스' || fmt === '쇼츠') ? 1.8 : fmt === '카드뉴스' ? 1.3 : 1;
    const reach = Math.round(BASE[b][c] * 2.2 * boost * (0.4 + R() * 1.4));
    const eng = Math.round(reach * ({ IG: 0.07, YT: 0.04, BL: 0.025 }[c]) * (0.7 + R() * 0.7));
    CONTENTS.push({
      id: `${b}-${c}-${ymd(dt)}-${String(seq[key]).padStart(2, '0')}`, brand: b, ch: c, title: TITLES[b][Math.floor(R() * TITLES[b].length)], format: fmt, topic,
      date: dt, ago, status: 'published', reach, views: Math.round(reach * 1.1), eng, clicks: Math.round(reach * 0.012 * (0.5 + R() * 1.5)),
      growth7: Math.round((R() * 2 - 0.6) * 100)  // 최근 7일 증가율(%) 샘플
    });
  }
}
// 앞으로 발행할 콘텐츠 (플래너용)
const FUTURE = [['idea', 0], ['idea', 0], ['drafting', 3], ['drafting', 4], ['review', 2], ['scheduled', 1], ['scheduled', 3], ['scheduled', 6]];
FUTURE.forEach(([st, ahead], k) => {
  const b = k % 2 ? 'SE' : 'KK', c = Object.keys(CHANNELS)[k % 3];
  const dt = dayDate(-ahead - 1);
  CONTENTS.push({ id: `${b}-${c}-${ymd(dt)}-0${k % 3 + 1}`, brand: b, ch: c, title: TITLES[b][(k + 3) % 8], format: FORMATS[c][0], topic: TOPICS[b][k % 5], date: dt, ago: -ahead - 1, status: st, reach: 0, views: 0, eng: 0, clicks: 0, growth7: 0 });
});

// 경쟁사·유사 콘텐츠 (샘플)
const COMPETITORS = [
  { brand: 'KK', name: '○○키즈 (경쟁사 A)', ch: 'IG', followers: 48200, post: '장난감 없이 10분 놀이 4가지', views: 182000, ratio: 3.8, trend: 240 },
  { brand: 'KK', name: '△△유아교육 (경쟁사 B)', ch: 'YT', followers: 91000, post: '엄마표 영어 하루 루틴', views: 410000, ratio: 4.5, trend: 180 },
  { brand: 'KK', name: '□□맘 블로그', ch: 'BL', followers: 7300, post: '입학 전 준비물 총정리', views: 23000, ratio: 3.1, trend: 95 },
  { brand: 'SE', name: '◇◇시니어아카데미 (경쟁사 C)', ch: 'YT', followers: 38000, post: '70대도 쉽게 배우는 챗GPT', views: 295000, ratio: 7.7, trend: 410 },
  { brand: 'SE', name: '☆☆평생교육원', ch: 'IG', followers: 9800, post: '키오스크 주문 연습 영상', views: 41000, ratio: 4.2, trend: 130 },
  { brand: 'SE', name: '▽▽실버라이프', ch: 'BL', followers: 5200, post: '스마트폰 기초 10강', views: 18000, ratio: 3.5, trend: 88 },
];
// 소재 추천 (샘플 — 실제로는 Claude가 성과·트렌드 데이터를 근거로 생성)
const TOPIC_RECS = [
  { brand: 'KK', title: '집콕 10분 놀이 시리즈 (릴스)', score: 92, why: ['내 릴스 평균 도달이 카드뉴스보다 1.4배', '경쟁사 A의 "10분 놀이" 게시물 급상승(+240%)', '"집콕 놀이" 검색량 한 달 +35%'], ch: 'IG,BL' },
  { brand: 'KK', title: '초등 입학 준비 체크리스트 (블로그→카드뉴스)', score: 85, why: ['지난 입학 관련 글이 블로그 상위 3위', '"입학 준비물" 검색량 상승 시즌', '비틀리 클릭이 평균의 2.1배'], ch: 'BL,IG' },
  { brand: 'SE', title: '시니어 챗GPT 첫걸음 (롱폼 + 쇼츠)', score: 94, why: ['경쟁사 C 동일 주제 조회 +410%', '내 유튜브 최근 20일 상승 중, 교육형 영상이 반응 최고', '"시니어 챗GPT" 검색량 월 +60%'], ch: 'YT,BL' },
  { brand: 'SE', title: '수강생 인터뷰 숏폼 (쇼츠/릴스)', score: 78, why: ['후기 소재의 저장 수가 평균 2배', '비틀리 클릭 전환이 가장 높은 소재'], ch: 'YT,IG' },
];
const KEYWORDS = [
  { brand: 'KK', kw: '집콕 놀이', vol: 14200, comp: '중', docs: 38000, chg: 35, why: '검색량 상승 + 문서 수 적음 → 상위 노출 여지' },
  { brand: 'KK', kw: '입학 준비물', vol: 33800, comp: '높음', docs: 152000, chg: 22, why: '시즌 상승, 경쟁 높아 롱테일(예: 입학 준비물 남자아이) 권장' },
  { brand: 'KK', kw: '아이 집중력 놀이', vol: 5100, comp: '낮음', docs: 7400, chg: 12, why: '경쟁 낮음, 내 인기 소재와 일치' },
  { brand: 'SE', kw: '시니어 챗GPT', vol: 8900, comp: '낮음', docs: 6200, chg: 60, why: '급상승 + 경쟁 낮음 → 우선 추천' },
  { brand: 'SE', kw: '키오스크 사용법', vol: 21500, comp: '중', docs: 44000, chg: 9, why: '꾸준한 수요, 내 후기 콘텐츠와 연결 가능' },
  { brand: 'SE', kw: '스마트폰 사진 정리', vol: 6700, comp: '낮음', docs: 9100, chg: 18, why: '내 블로그 상위 글 주제와 일치' },
];

// 실버에듀넷 네이버 카페: 비틀리 클릭만 수집 (기존 대시보드의 '실버카페' 링크 규칙)
const CAFE_DAILY = [];
for (let i = DAYS - 1; i >= 0; i--) CAFE_DAILY[i] = Math.round(70 * (0.6 + R() * 0.9) * (i < 20 ? 1.1 : 1));

// ---------- 실데이터 적용 (index.html 이 /api/data 를 받아오면 window.LIVE 에 담김) ----------
const LIVE_STATE = { on: false, at: '' };
function applyLive(L) {
  const toDate = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const idxOf = dt => Math.round((TODAY - new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())) / 864e5);
  const num = v => (v === '' || v == null || isNaN(+v)) ? 0 : +v;
  for (const b in BRANDS) for (const c in CHANNELS) DAILY[b][c] = Array.from({ length: DAYS }, (_, i) => ({ date: dayDate(i), reach: 0, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, eng: 0, clicks: 0, gain: 0, followers: 0 }));
  for (const r of L.daily || []) {
    const dt = toDate(r.date), arr = DAILY[r.brand]?.[r.channel]; if (!dt || !arr) continue;
    const i = idxOf(dt); if (i < 0 || i >= DAYS) continue;
    const o = arr[i]; Object.assign(o, { reach: num(r.reach), views: num(r.views), likes: num(r.likes), comments: num(r.comments), shares: num(r.shares), saves: num(r.saves), clicks: num(r.clicks), gain: num(r.followers_gain), followers: num(r.followers) });
    o.eng = o.likes + o.comments + o.shares + o.saves;
  }
  const latest = {};
  for (const m of L.metrics || []) if (!latest[m.content_id] || String(m.snapshot_date) > String(latest[m.content_id].snapshot_date)) latest[m.content_id] = m;
  CONTENTS.length = 0; FUTURE.length = 0;
  for (const r of L.contents || []) {
    if (!BRANDS[r.brand] || !CHANNELS[r.channel]) continue;
    const dt = toDate(r.published_at) || toDate(r.scheduled_at) || new Date(r.published_at || r.scheduled_at || TODAY); if (!dt || isNaN(dt)) continue;
    const m = latest[r.content_id] || {}, status = r.status || 'published', ago = idxOf(dt);
    const likes = num(m.likes), eng = likes + num(m.comments) + num(m.shares) + num(m.saves);
    CONTENTS.push({ id: r.content_id, brand: r.brand, ch: r.channel, title: r.title || '(제목 없음)', format: r.format || '', topic: r.topic_category || '', date: dt, ago, status, reach: num(m.reach), views: num(m.views), eng, clicks: 0, growth7: 0 });
  }
  LIVE_STATE.on = true; LIVE_STATE.at = L.generatedAt || '';
}
if (window.LIVE) applyLive(window.LIVE);
