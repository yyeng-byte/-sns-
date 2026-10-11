// 대시보드가 읽는 데이터 (D1). GET /api/data  (접근 제한은 Cloudflare Access 로 건다)
import { readTab } from '../_lib/db.js';
export async function onRequestGet({ env }) {
  try {
    const [daily, contents, metrics] = await Promise.all(['channel_daily', 'contents', 'content_metrics'].map(t => readTab(env, t)));
    const strip = r => r;
    return new Response(JSON.stringify({ generatedAt: new Date().toISOString(), daily: daily.rows.map(strip), contents: contents.rows.map(strip), metrics: metrics.rows.map(strip) }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }
}
