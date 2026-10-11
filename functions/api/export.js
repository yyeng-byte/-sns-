// 엑셀에서 열 수 있는 CSV 내려받기. GET /api/export?tab=channel_daily|content_metrics|contents|bitly_clicks ...
import { readTab, columnsOf } from '../_lib/db.js';
export async function onRequestGet({ request, env }) {
  const tab = new URL(request.url).searchParams.get('tab') || 'channel_daily';
  try {
    columnsOf(tab);
    const { headers, rows } = await readTab(env, tab);
    const esc = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const csv = '﻿' + [headers, ...rows.map(r => headers.map(h => r[h]))].map(r => r.map(esc).join(',')).join('\r\n');
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${tab}.csv"`, 'Cache-Control': 'no-store' } });
  } catch (err) { return new Response(err.message, { status: 400 }); }
}
