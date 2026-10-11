// 인스타그램: Meta Graph API (프로페셔널 계정). 장기 토큰 사용.
const GRAPH = 'https://graph.facebook.com/v21.0';
const ymd = d => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const unix = d => Math.floor(d.getTime() / 1000);

async function gget(path, token) {
  const res = await fetch(`${GRAPH}${path}${path.includes('?') ? '&' : '?'}access_token=${token}`);
  const j = await res.json();
  if (!res.ok) throw new Error(`Meta API ${res.status}: ${j.error?.message || ''}`);
  return j;
}
const FORMAT = m => m.media_product_type === 'REELS' ? '릴스' : m.media_type === 'CAROUSEL_ALBUM' ? '카드뉴스' : m.media_type === 'VIDEO' ? '릴스' : '피드사진';
const clean = s => (s || '').replace(/\s+/g, ' ').trim().slice(0, 40) || '(캡션 없음)';

export async function collectInstagram(env, brand, { days = 2, today = new Date(), mediaLimit = 25, skipContents = false } = {}) {
  const id = env[`IG_USER_ID_${brand}`], token = env[`IG_TOKEN_${brand}`];
  if (!id || !token) throw new Error(`인스타 환경변수 없음 (IG_USER_ID_${brand}/IG_TOKEN_${brand})`);
  const warnings = [];
  const acct = await gget(`/${id}?fields=followers_count`, token);
  const dayStart = n => { const d = addDays(today, -n); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
  const byDate = {};
  const put = (date, o) => { byDate[date] = { ...(byDate[date] || { brand, channel: 'IG', date, source: 'api' }), ...o }; };

  try {                                                          // 도달·팔로워 증감 (일별 시계열)
    const s = dayStart(days), e = dayStart(0);
    const reach = await gget(`/${id}/insights?metric=reach&period=day&since=${unix(s)}&until=${unix(e)}`, token);
    for (const v of reach.data?.[0]?.values || []) put(v.end_time.slice(0, 10), { reach: v.value });
    const fc = await gget(`/${id}/insights?metric=follower_count&period=day&since=${unix(s)}&until=${unix(e)}`, token);
    for (const v of fc.data?.[0]?.values || []) put(v.end_time.slice(0, 10), { followers_gain: v.value });
  } catch (err) { warnings.push(`계정 일별 지표: ${err.message}`); }

  for (let n = days; n >= 1; n--) {                              // 조회·반응 합계 (하루씩)
    const s = dayStart(n), e = dayStart(n - 1);
    try {
      const r = await gget(`/${id}/insights?metric=views,likes,comments,shares,saves&metric_type=total_value&period=day&since=${unix(s)}&until=${unix(e)}`, token);
      const o = {}; for (const m of r.data || []) o[{ views: 'views', likes: 'likes', comments: 'comments', shares: 'shares', saves: 'saves' }[m.name]] = m.total_value?.value ?? 0;
      put(ymd(s), o);
    } catch (err) { warnings.push(`${ymd(s)} 반응 합계: ${err.message}`); }
  }
  // 팔로워 수: 현재값에서 일별 순증가를 거꾸로 빼서 복원
  const anchored = Date.now() - today.getTime() < 2 * 864e5;      // 과거 구간 채우기일 때는 팔로워 수 역산 불가 → 비워 둠
  let followers = acct.followers_count; const daily = [];
  for (const d of Object.keys(byDate).sort().reverse()) { if (anchored) byDate[d].followers = followers; followers -= byDate[d].followers_gain || 0; daily.unshift(byDate[d]); }

  if (skipContents) return { daily, contents: [], metrics: [], warnings };
  const list = await gget(`/${id}/media?fields=id,caption,media_type,media_product_type,permalink,timestamp&limit=${mediaLimit}`, token);
  const contents = [], metrics = [];
  for (const m of list.data || []) {
    contents.push({ external_id: m.id, brand, channel: 'IG', title: clean(m.caption), format: FORMAT(m), status: 'published', published_at: m.timestamp, post_url: m.permalink });
    try {
      const r = await gget(`/${m.id}/insights?metric=reach,views,likes,comments,shares,saved`, token);
      const o = {}; for (const x of r.data || []) o[x.name] = x.values?.[0]?.value ?? 0;
      metrics.push({ external_id: m.id, snapshot_date: ymd(today), reach: o.reach ?? '', views: o.views ?? '', likes: o.likes ?? '', comments: o.comments ?? '', shares: o.shares ?? '', saves: o.saved ?? '', source: 'api' });
    } catch (err) { warnings.push(`${m.id} 성과: ${err.message}`); }
  }
  return { daily, contents, metrics, warnings };
}
