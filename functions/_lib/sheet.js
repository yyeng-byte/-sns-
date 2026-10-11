// 시트 탭을 "헤더 이름 기준"으로 읽고 쓴다 (열이 추가/이동되어도 안 깨짐)
import { sheetsApi } from './google.js';

const colLetter = n => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };

export async function readTab(env, tab) {
  const j = await sheetsApi(env, `/values/${encodeURIComponent(tab)}!A1:AZ?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`);
  const [headers = [], ...rows] = j.values || [];
  return { headers, rows: rows.map((r, i) => ({ __row: i + 2, ...Object.fromEntries(headers.map((h, k) => [h, r[k] ?? ''])) })) };
}

// objs 를 key 열 기준으로 갱신(있으면 덮어쓰기, 없으면 추가). 사람이 쓴 다른 열 값은 보존.
export async function upsert(env, tab, objs, keyField, { dry = false } = {}) {
  if (!objs.length) return { updated: 0, appended: 0 };
  const { headers, rows } = await readTab(env, tab);
  if (!headers.length) throw new Error(`"${tab}" 탭에 헤더(1행)가 없습니다. 시트 양식을 확인하세요`);
  const byKey = new Map(rows.map(r => [String(r[keyField]), r]));
  const data = [], append = [];
  for (const o of objs) {
    const old = byKey.get(String(o[keyField]));
    if (old) { const m = { ...old, ...o }; data.push({ range: `${tab}!A${old.__row}:${colLetter(headers.length)}${old.__row}`, values: [headers.map(h => m[h] ?? '')] }); }
    else append.push(headers.map(h => o[h] ?? ''));
  }
  if (!dry) {
    for (let i = 0; i < data.length; i += 200) await sheetsApi(env, '/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: data.slice(i, i + 200) }) });
    if (append.length) await sheetsApi(env, `/values/${encodeURIComponent(tab)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: append }) });
  }
  return { updated: data.length, appended: append.length };
}

export async function appendLog(env, row) {
  const { headers } = await readTab(env, '_sync');
  if (!headers.length) return;
  await sheetsApi(env, `/values/${encodeURIComponent('_sync')}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: [headers.map(h => row[h] ?? '')] }) });
}
