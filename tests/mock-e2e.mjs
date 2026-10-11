// 가짜 구글/유튜브/메타 API 로 수집→시트→/api/data 흐름 점검. 실행: node tests/mock-e2e.mjs [출력JSON경로]
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost } from '../functions/api/collect.js';
import { onRequestGet } from '../functions/api/data.js';
import { onRequestGet as exportGet } from '../functions/api/export.js';

// Cloudflare D1 을 흉내 내는 진짜 SQLite (prepare/bind/run/all)
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
const DB = { prepare: sql => { let args = []; const st = { bind: (...a) => { args = a; return st; }, run: async () => { sqlite.prepare(sql).run(...args); return {}; }, all: async () => ({ results: sqlite.prepare(sql).all(...args).map(r => ({ ...r })) }) }; return st; } };
const env = { DB, COLLECT_SECRET: 's3', YT_CLIENT_ID: 'id', YT_CLIENT_SECRET: 'sec', YT_REFRESH_TOKEN_KK: 'r1', YT_REFRESH_TOKEN_SE: 'r2', IG_USER_ID_KK: '111', IG_TOKEN_KK: 't1', IG_USER_ID_SE: '222', IG_TOKEN_SE: 't2' };
const rows = sql => sqlite.prepare(sql).all().map(r => ({ ...r }));
// 사람이 미리 넣어 둔 콘텐츠 행(보존 확인용)
sqlite.prepare("INSERT INTO contents (content_id, brand, channel, title, status, memo) VALUES ('KK-IG-260101-01','KK','IG','사람이 쓴 제목','idea','직접 쓴 메모')").run();
const calls = { yt: 0, ig: 0 };
const dayStr = n => { const d = new Date(Date.now() - n * 864e5); return d.toISOString().slice(0, 10); };
const ok = o => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = async (url, init = {}) => {
  url = String(url); const u = new URL(url);
  if (u.host === 'oauth2.googleapis.com') return ok({ access_token: 'tok', expires_in: 3600 });
  if (u.host === 'www.googleapis.com') {
    calls.yt++;
    if (u.pathname.endsWith('/channels')) return ok({ items: [{ statistics: { subscriberCount: '1000' }, contentDetails: { relatedPlaylists: { uploads: 'UU1' } } }] });
    if (u.pathname.endsWith('/playlistItems')) return ok({ items: [{ contentDetails: { videoId: 'v1' } }, { contentDetails: { videoId: 'v2' } }] });
    if (u.pathname.endsWith('/videos')) return ok({ items: [
      { id: 'v1', snippet: { title: '긴 영상', publishedAt: '2026-10-05T03:00:00Z' }, contentDetails: { duration: 'PT12M3S' }, statistics: { viewCount: '500', likeCount: '20', commentCount: '3' } },
      { id: 'v2', snippet: { title: '짧은 영상', publishedAt: '2026-10-05T09:00:00Z' }, contentDetails: { duration: 'PT45S' }, statistics: { viewCount: '900' } }] });
  }
  if (u.host === 'youtubeanalytics.googleapis.com') {
    calls.yt++;
    const h = n => ({ name: n });
    if (u.searchParams.get('dimensions') === 'day') return ok({ columnHeaders: ['day', 'views', 'estimatedMinutesWatched', 'likes', 'comments', 'shares', 'subscribersGained', 'subscribersLost'].map(h), rows: [100, 120, 90].map((v, i) => [new Date(Date.parse(u.searchParams.get('startDate')) + i * 864e5).toISOString().slice(0, 10), v, 200, 5, 1, 1, 10 - i, 2 - i]) });
    return ok({ columnHeaders: ['video', 'views', 'estimatedMinutesWatched', 'averageViewPercentage', 'likes', 'comments', 'shares'].map(h), rows: [['v1', 480, 900, 41.5, 19, 3, 2], ['v2', 880, 300, 80, 40, 5, 9]] });
  }
  if (u.host === 'graph.facebook.com') {
    calls.ig++;
    if (/\/insights$/.test(u.pathname) && ['111', '222'].includes(u.pathname.split('/')[2])) {
      const metric = u.searchParams.get('metric');
      if (metric === 'reach') return ok({ data: [{ name: 'reach', values: [{ value: 300, end_time: dayStr(2) + 'T08:00:00+0000' }, { value: 350, end_time: dayStr(1) + 'T08:00:00+0000' }] }] });
      if (metric === 'follower_count') return ok({ data: [{ values: [{ value: 4, end_time: dayStr(2) + 'T08:00:00+0000' }, { value: 6, end_time: dayStr(1) + 'T08:00:00+0000' }] }] });
      return ok({ data: ['views', 'likes', 'comments', 'shares', 'saves'].map((n, i) => ({ name: n, total_value: { value: 100 * (i + 1) } })) });
    }
    if (u.pathname.endsWith('/media')) return ok({ data: [{ id: 'm1', caption: '카드뉴스 테스트 캡션', media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED', permalink: 'https://instagram.com/p/a', timestamp: '2026-10-05T01:00:00+0000' }, { id: 'm2', caption: '릴스 테스트', media_type: 'VIDEO', media_product_type: 'REELS', permalink: 'https://instagram.com/reel/b', timestamp: '2026-10-05T10:00:00+0000' }] });
    if (u.pathname.endsWith('/insights')) return ok({ data: ['reach', 'views', 'likes', 'comments', 'shares', 'saved'].map((n, i) => ({ name: n, values: [{ value: 50 * (i + 1) }] })) });
    return ok({ followers_count: 5000 });
  }
  throw new Error('mock 없음: ' + url);
};

const post = (qs) => onRequestPost({ request: new Request('https://x/api/collect?' + qs, { method: 'POST', headers: { 'X-Collect-Secret': 's3' } }), env });
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('ok  ', m); };

const bad = await onRequestPost({ request: new Request('https://x/api/collect', { method: 'POST' }), env });
assert(bad.status === 401, '비밀키 없으면 401');
const dry = await (await post('source=all&brand=KK&dry=1')).json();
assert(dry.ok && rows('SELECT * FROM channel_daily').length === 0, 'dry-run 은 DB에 쓰지 않음');
const r1 = await (await post('source=all&brand=all&days=3')).json();
console.log(JSON.stringify(r1.results.map(r => ({ s: r.source, b: r.brand, c: r.newContents, m: r.metrics, d: r.daily, w: r.warnings })), null, 0));
assert(r1.ok, '1차 수집 성공');
const cnt = t => rows(`SELECT COUNT(*) n FROM ${t}`)[0].n;
const snap = { c: cnt('contents'), m: cnt('content_metrics'), d: cnt('channel_daily') };
const r2 = await (await post('source=all&brand=all&days=3')).json();
assert(r2.ok && cnt('contents') === snap.c && cnt('content_metrics') === snap.m && cnt('channel_daily') === snap.d, `2차 실행해도 중복 행 없음 (콘텐츠 ${snap.c}, 성과 ${snap.m}, 일별 ${snap.d})`);
assert(rows("SELECT * FROM contents WHERE content_id='KK-IG-260101-01'")[0].memo === '직접 쓴 메모', '사람이 만든 행/메모 보존');
const ids = rows('SELECT content_id FROM contents').map(r => r.content_id); console.log('콘텐츠 ID:', ids.join(', '));
assert(ids.includes('KK-YT-261005-01') && ids.includes('KK-YT-261005-02') && ids.includes('KK-IG-261005-01'), '콘텐츠 ID 자동 부여(같은 날 일련번호)');
const yt = rows("SELECT * FROM channel_daily WHERE brand='KK' AND channel='YT' ORDER BY date");
assert(yt.length === 3 && yt[2].followers == 1000 && yt[1].followers == 992, '유튜브 구독자 수 역산 (1000 → 992 …)');
const ig = rows("SELECT * FROM content_metrics WHERE content_id='KK-IG-261005-01'");
assert(ig.length === 1 && ig[0].reach == 50 && ig[0].saves == 300, '콘텐츠 성과(도달·저장) 자동 저장');
assert(rows('SELECT * FROM _sync').length > 1, '수집 기록(_sync) 남김');
const before = { c: cnt('contents') };
const bf = await (await post('source=youtube&brand=KK&days=3&end=2025-10-31&only=daily')).json();
assert(bf.ok && cnt('contents') === before.c, '과거 채우기(only=daily)는 콘텐츠를 건드리지 않음');
const old = rows("SELECT * FROM channel_daily WHERE brand='KK' AND channel='YT' AND date < '2025-11-02'");
assert(old.length === 3 && old.every(r => r.followers === null), '과거 채우기는 구독자 수를 비워 둠(잘못된 역산 방지)');
const keep = await (await post('source=youtube&brand=KK&days=3&end=2025-10-31&only=daily')).json();
assert(keep.ok && rows("SELECT * FROM channel_daily WHERE brand='KK' AND channel='YT' AND date='" + yt[2].date + "'")[0].followers == 1000, '다시 실행해도 기존 값(구독자 수)은 지워지지 않음');
const data = await (await onRequestGet({ env })).json();
assert(data.contents.length === cnt('contents') && data.daily.length === cnt('channel_daily'), '/api/data 가 DB 내용을 반환');
const buf = new Uint8Array(await (await exportGet({ request: new Request('https://x/api/export?tab=channel_daily'), env })).arrayBuffer());
const csv = new TextDecoder('utf-8', { ignoreBOM: true }).decode(buf);
assert(buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF && csv.includes('KK|YT'), 'CSV 내려받기 (엑셀 한글 깨짐 방지 BOM 포함)');
console.log('호출 수', calls);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(data));
