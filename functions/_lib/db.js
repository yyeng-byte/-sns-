// Cloudflare D1(데이터베이스) 입출력. 테이블/열 정의는 schema/sheet-schema.json 하나로 관리.
import schema from '../../schema/sheet-schema.json' with { type: 'json' };

const q = n => `"${n}"`;
export const columnsOf = tab => { if (!schema[tab]) throw new Error(`알 수 없는 테이블: ${tab}`); return schema[tab].columns.map(c => c[0]); };
const db = env => { if (!env.DB) throw new Error('D1 데이터베이스 연결(DB)이 설정되지 않았습니다'); return env.DB; };

export async function readTab(env, tab) {
  const headers = columnsOf(tab);
  const { results } = await db(env).prepare(`SELECT ${headers.map(q).join(',')} FROM ${q(tab)} ORDER BY rowid`).all();
  return { headers, rows: results };
}

// objs 를 keyField 기준으로 저장: 없으면 추가, 있으면 "들어온 값이 있는 열만" 갱신 (빈 값은 기존 값 유지)
export async function upsert(env, tab, objs, keyField, { dry = false } = {}) {
  if (!objs.length) return { written: 0 };
  const known = columnsOf(tab);
  const cols = known.filter(c => objs.some(o => o[c] !== undefined));
  if (!cols.includes(keyField)) throw new Error(`${tab}: 키 열(${keyField}) 값이 없습니다`);
  if (!dry) {
    const sql = `INSERT INTO ${q(tab)} (${cols.map(q).join(',')}) SELECT ${cols.map(c => `NULLIF(json_extract(value,'$.${c}'),'')`).join(',')} FROM json_each(?) WHERE true ` +
      `ON CONFLICT(${q(keyField)}) DO UPDATE SET ${cols.filter(c => c !== keyField).map(c => `${q(c)}=COALESCE(excluded.${q(c)},${q(tab)}.${q(c)})`).join(',')}`;
    for (let i = 0; i < objs.length; i += 300) await db(env).prepare(sql).bind(JSON.stringify(objs.slice(i, i + 300))).run();
  }
  return { written: objs.length };
}

export async function appendLog(env, row) {
  const cols = columnsOf('_sync');
  await db(env).prepare(`INSERT INTO "_sync" (${cols.map(q).join(',')}) VALUES (${cols.map(() => '?').join(',')})`).bind(...cols.map(c => row[c] ?? null)).run();
}
