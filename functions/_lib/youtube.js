// 유튜브: Analytics API(성과) + Data API(영상 목록). OAuth refresh token 사용.
const ymd = d => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);

async function accessToken(env, brand) {
  const refresh = env[`YT_REFRESH_TOKEN_${brand}`];
  if (!env.YT_CLIENT_ID || !env.YT_CLIENT_SECRET || !refresh) throw new Error(`유튜브 환경변수 없음 (YT_CLIENT_ID/YT_CLIENT_SECRET/YT_REFRESH_TOKEN_${brand})`);
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.YT_CLIENT_ID, client_secret: env.YT_CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' }) });
  const j = await res.json();
  if (!res.ok) throw new Error(`유튜브 로그인 실패: ${j.error_description || j.error}`);
  return j.access_token;
}
async function get(tok, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
  const j = await res.json();
  if (!res.ok) throw new Error(`유튜브 API ${res.status}: ${j.error?.message || ''}`);
  return j;
}
const durationSec = iso => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || ''); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
const rowsOf = r => (r.rows || []).map(row => Object.fromEntries(r.columnHeaders.map((h, i) => [h.name, row[i]])));

export async function collectYouTube(env, brand, { days = 3, today = new Date(), videoLimit = 50, skipContents = false } = {}) {
  const tok = await accessToken(env, brand);
  const end = addDays(today, -1), start = addDays(today, -days);        // 어제까지(오늘은 집계 미완료)
  const ch = await get(tok, 'https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&mine=true');
  const item = ch.items?.[0]; if (!item) throw new Error('연결된 유튜브 채널을 찾을 수 없습니다');
  const subs = +item.statistics.subscriberCount, uploads = item.contentDetails.relatedPlaylists.uploads;

  const rep = rowsOf(await get(tok, `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${ymd(start)}&endDate=${ymd(end)}&dimensions=day&sort=day&metrics=views,estimatedMinutesWatched,likes,comments,shares,subscribersGained,subscribersLost`));
  // 구독자 수: 현재값에서 일별 순증가를 거꾸로 빼서 복원
  const anchored = Date.now() - today.getTime() < 2 * 864e5;      // 과거 구간 채우기일 때는 구독자 수 역산 불가 → 비워 둠
  let followers = subs; const daily = [];
  for (const r of [...rep].reverse()) {
    const gain = (r.subscribersGained || 0) - (r.subscribersLost || 0);
    daily.unshift({ brand, channel: 'YT', date: r.day, reach: r.views, views: r.views, likes: r.likes, comments: r.comments, shares: r.shares, saves: '', ...(anchored ? { followers } : {}), followers_gain: gain, watch_minutes: r.estimatedMinutesWatched, source: 'api' });
    followers -= gain;
  }

  if (skipContents) return { daily, contents: [], metrics: [] };
  const pl = await get(tok, `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=${videoLimit}`);
  const ids = (pl.items || []).map(i => i.contentDetails.videoId);
  const contents = [], metrics = [];
  if (ids.length) {
    const vids = await get(tok, `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${ids.join(',')}`);
    const an = rowsOf(await get(tok, `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2010-01-01&endDate=${ymd(end)}&dimensions=video&filters=video==${ids.join(',')}&metrics=views,estimatedMinutesWatched,averageViewPercentage,likes,comments,shares&maxResults=200`));
    const anBy = Object.fromEntries(an.map(r => [r.video, r]));
    for (const v of vids.items || []) {
      const a = anBy[v.id] || {}, st = v.statistics;
      contents.push({ external_id: v.id, brand, channel: 'YT', title: v.snippet.title, format: durationSec(v.contentDetails.duration) <= 60 ? '쇼츠' : '롱폼', status: 'published', published_at: v.snippet.publishedAt, post_url: `https://www.youtube.com/watch?v=${v.id}` });
      metrics.push({ external_id: v.id, snapshot_date: ymd(today), reach: a.views ?? +st.viewCount, views: a.views ?? +st.viewCount, likes: a.likes ?? +(st.likeCount || 0), comments: a.comments ?? +(st.commentCount || 0), shares: a.shares ?? '', saves: '', watch_minutes: a.estimatedMinutesWatched ?? '', avg_view_pct: a.averageViewPercentage ?? '', source: 'api' });
    }
  }
  return { daily, contents, metrics };
}
