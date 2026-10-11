// 구글 서비스 계정 로그인(JWT) + 시트 API. 키는 Cloudflare 환경변수에만 둡니다.
const enc = s => new TextEncoder().encode(s);
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let cached = null;
export async function serviceToken(env) {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const pem = (env.GOOGLE_SA_KEY || '').replace(/\\n/g, '\n');
  if (!env.GOOGLE_SA_EMAIL || !pem) throw new Error('GOOGLE_SA_EMAIL / GOOGLE_SA_KEY 환경변수가 없습니다');
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(enc(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64u(enc(JSON.stringify({ iss: env.GOOGLE_SA_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const sig = b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc(`${head}.${body}`)));
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${sig}` }) });
  const j = await res.json();
  if (!res.ok) throw new Error(`구글 로그인 실패: ${j.error_description || j.error}`);
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

export async function sheetsApi(env, path, init = {}) {
  const token = await serviceToken(env);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const j = await res.json();
  if (!res.ok) throw new Error(`시트 API ${res.status}: ${j.error?.message || ''}`);
  return j;
}
