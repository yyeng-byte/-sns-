// 매일 자동 수집용 엔드포인트. POST /api/collect?source=youtube|instagram|all&brand=KK|SE|all&days=3&dry=1
// 과거 채우기: &end=2025-10-31&only=daily (end 날짜까지 days일치 일별 성과만 저장)
// 헤더 X-Collect-Secret 이 환경변수 COLLECT_SECRET 과 같아야 실행됨.
import { upsert, readTab, appendLog } from '../_lib/sheet.js';
import { collectYouTube } from '../_lib/youtube.js';
import { collectInstagram } from '../_lib/instagram.js';

const json = (o, status = 200) => new Response(JSON.stringify(o, null, 2), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const ymd = d => d.toISOString().slice(0, 10);
const yymmdd = iso => iso.slice(2, 10).replace(/-/g, '');
const nowIso = () => new Date().toISOString();

export async function runOne(env, source, brand, { days, dry, today, dailyOnly }) {
  const collect = source === 'youtube' ? collectYouTube : collectInstagram;
  const out = await collect(env, brand, { days, today, skipContents: dailyOnly });
  const ch = source === 'youtube' ? 'YT' : 'IG';
  // 1) 콘텐츠: 이미 있는 건 external_id 로 매칭, 새 글은 콘텐츠 ID 자동 부여
  const { rows } = await readTab(env, 'contents');
  const byExt = new Map(rows.filter(r => r.external_id && r.brand === brand && r.channel === ch).map(r => [String(r.external_id), r.content_id]));
  const used = new Set(rows.map(r => r.content_id));
  const idOf = new Map(), newContents = [];
  for (const c of out.contents.slice().sort((a, b) => a.published_at.localeCompare(b.published_at))) {
    let id = byExt.get(String(c.external_id));
    if (!id) {
      const prefix = `${brand}-${ch}-${yymmdd(c.published_at)}-`;
      let k = 1; while (used.has(prefix + String(k).padStart(2, '0'))) k++;
      id = prefix + String(k).padStart(2, '0'); used.add(id);
      newContents.push({ ...c, content_id: id, created_at: nowIso(), updated_at: nowIso() });
    }
    idOf.set(String(c.external_id), id);
  }
  const stamp = nowIso();
  const metrics = out.metrics.filter(m => idOf.has(String(m.external_id))).map(({ external_id, ...m }) => { const content_id = idOf.get(String(external_id)); return { ...m, content_id, key: `${content_id}|${m.snapshot_date}`, collected_at: stamp }; });
  const daily = out.daily.map(d => ({ ...d, key: `${d.brand}|${d.channel}|${d.date}`, collected_at: stamp }));
  const r = {
    contents: await upsert(env, 'contents', newContents, 'content_id', { dry }),   // 새 글만 추가(기존 행은 사람이 고친 값 보호)
    metrics: await upsert(env, 'content_metrics', metrics, 'key', { dry }),
    daily: await upsert(env, 'channel_daily', daily, 'key', { dry }),
  };
  const summary = { source, brand, newContents: newContents.length, metrics: metrics.length, daily: daily.length, warnings: out.warnings || [], write: r };
  if (dry) summary.sample = { daily: daily.slice(-2), contents: newContents.slice(0, 2), metrics: metrics.slice(0, 2) };
  return summary;
}

export async function onRequestPost({ request, env }) {
  if (!env.COLLECT_SECRET || request.headers.get('X-Collect-Secret') !== env.COLLECT_SECRET) return json({ error: 'unauthorized' }, 401);
  const q = new URL(request.url).searchParams;
  const source = q.get('source') || 'all', brandQ = q.get('brand') || 'all', days = Math.min(30, +q.get('days') || 3), dry = q.get('dry') === '1';
  const end = q.get('end'), today = end ? new Date(Date.parse(end) + 864e5) : new Date(), dailyOnly = q.get('only') === 'daily';   // end=과거 날짜, only=daily: 과거 일별 데이터만 채우기
  const sources = source === 'all' ? ['youtube', 'instagram'] : [source], brands = brandQ === 'all' ? ['KK', 'SE'] : [brandQ];
  const results = [];
  for (const s of sources) for (const b of brands) {
    try { const r = await runOne(env, s, b, { days, dry, today, dailyOnly }); results.push(r); await appendLog(env, { run_at: nowIso(), source: s, brand: b, status: dry ? 'dry' : 'ok', rows_daily: r.daily, rows_contents: r.newContents, rows_metrics: r.metrics, message: r.warnings.join(' / ').slice(0, 300) }).catch(() => {}); }
    catch (err) { results.push({ source: s, brand: b, error: err.message }); await appendLog(env, { run_at: nowIso(), source: s, brand: b, status: 'error', message: err.message.slice(0, 300) }).catch(() => {}); }
  }
  return json({ ok: results.every(r => !r.error), results }, results.some(r => r.error) ? 207 : 200);
}
