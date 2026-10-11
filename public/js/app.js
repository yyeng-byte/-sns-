const TABS = [
  ['perf', '📊', '채널 성과'], ['traffic', '🔗', '유입 성과'], ['why', '🔍', '분석 (왜?)'], ['rise', '🚀', '급상승'],
  ['rec', '💡', '추천'], ['make', '✍️', '제작'], ['plan', '🗓️', '플래너']
];
const PRESET = { '1주': 7, '1개월': 30, '3개월': 90, '6개월': 180, '12개월': 360 };
const S = { tab: 'perf', brand: 'ALL', days: 30, end0: 0, sub: 'ops', ch: 'ALL', scope: 'ALL', more: 10 };
S.cmpMode = 'auto'; S.cmpStart = null;
const idx = d => Math.round((TODAY - d) / 864e5);
const shiftYear = (d, y) => { const x = new Date(d); x.setFullYear(x.getFullYear() + y); return x; };
function pr(period) {                           // 'cur' 이번 | 'prev' 직전 | 'yoy' 작년 동기 | 'cmp' 직접 지정 → [최근 인덱스, 오래된 인덱스]
  const f0 = S.end0, t0 = S.end0 + S.days - 1;
  if (period === 'cur') return [f0, t0];
  if (period === 'prev') return [f0 + S.days, t0 + S.days];
  if (period === 'yoy') return [idx(shiftYear(dayDate(f0), -1)), idx(shiftYear(dayDate(t0), -1))];
  const t = idx(S.cmpStart || dayDate(t0 + S.days)); return [t - (S.days - 1), t];
}
const valid = period => { const [f, t] = pr(period); return f >= 0 && t <= DAYS - 1; };
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = v => Math.round(v).toLocaleString('ko-KR');
const brands = () => S.brand === 'ALL' ? Object.keys(BRANDS) : [S.brand];

// ---------- 집계 ----------
function sumDaily(b, c, from, to) {           // from~to 일 전 (포함)
  const t = { reach: 0, views: 0, eng: 0, clicks: 0, gain: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
  for (let i = from; i <= to; i++) { const d = DAILY[b][c][i]; for (const k in t) t[k] += d[k]; }
  return t;
}
function agg(chs, period) {                   // period: 'cur' | 'prev'
  const [from, to] = pr(period);
  const t = { reach: 0, views: 0, eng: 0, clicks: 0, gain: 0, na: !valid(period) };
  if (t.na) return t;
  brands().forEach(b => chs.forEach(c => { const x = sumDaily(b, c, from, to); for (const k in t) t[k] += x[k]; }));
  return t;
}
const ALLCH = Object.keys(CHANNELS);
const chg = (cur, prev) => prev ? (cur - prev) / prev * 100 : 0;
function delta(p, inv) {
  const cls = Math.abs(p) < 1 ? 'flat' : ((p > 0) !== !!inv ? 'up' : 'down');
  return `<span class="delta ${cls}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(1)}%</span>`;
}
function inPeriod(c, period) {
  if (c.status !== 'published') return false;
  const [f, t] = pr(period); return c.ago >= f && c.ago <= t;
}
const myContents = () => CONTENTS.filter(c => brands().includes(c.brand));

// ---------- 차트 ----------
function spark(vals, color) {
  const w = 120, h = 30, mx = Math.max(...vals), mn = Math.min(...vals);
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - (v - mn) / ((mx - mn) || 1) * (h - 4) - 2).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="${color}" stroke-width="2" points="${pts}"/></svg>`;
}
function lineChart(series, labels) {                   // series: [{name,color,vals}]
  const w = 640, h = 190, p = 28, all = series.flatMap(s => s.vals), mx = Math.max(...all) * 1.08, len = series[0].vals.length;
  const X = i => p + i / (len - 1) * (w - p - 8), Y = v => h - 22 - v / mx * (h - 34);
  const grid = [0, .5, 1].map(f => `<line x1="${p}" x2="${w - 8}" y1="${Y(mx * f)}" y2="${Y(mx * f)}" stroke="var(--line)"/><text x="0" y="${Y(mx * f) + 4}" font-size="10" fill="var(--sub)">${mx >= 5000 ? n(mx * f / 1000) + 'k' : n(mx * f)}</text>`).join('');
  const lines = series.map(s => `<polyline fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? `stroke-dasharray="${s.dash === 1 ? '6 5' : s.dash}"` : ''} points="${s.vals.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}"/>`).join('');
  const legend = series.map(s => `<span><span class="dot" style="background:${s.color}"></span>${s.name}</span>`).join(' &nbsp; ');
  return `<div class="hint" style="margin-bottom:4px">${legend}</div><svg viewBox="0 0 ${w} ${h}" width="100%">${grid}${lines}${labels ? `<text x="${p}" y="${h - 4}" font-size="10" fill="var(--sub)">${labels[0]}</text><text x="${w - 8}" y="${h - 4}" font-size="10" text-anchor="end" fill="var(--sub)">${labels[1]}</text>` : ''}</svg>`;
}
function dailySeries(chs, key, period) {  // period: 'cur' | 'prev'         // 오래된 → 최근 (이동평균 3일)
  const out = [];
  const [pf, pt] = pr(period || 'cur');
  if (!valid(period || 'cur')) return [];
  for (let i = pt; i >= pf; i--) {
    let t = 0; brands().forEach(b => chs.forEach(c => { t += DAILY[b][c][i][key]; })); out.push(t);
  }
  return out.map((_, i, a) => { const s = a.slice(Math.max(0, i - 2), i + 1); return s.reduce((x, y) => x + y, 0) / s.length; });
}

// ---------- 뷰: 성과 (기존 sns-flow-dashboard의 유입 성과·운영 현황 구성을 참고) ----------
const fmtD = d => `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
const rangeLabel = () => `${fmtD(dayDate(S.end0 + S.days - 1))} – ${fmtD(dayDate(S.end0))}`;
const chName = c => c === 'CF' ? '네이버 카페' : CHANNELS[c];
const hasCafe = () => brands().includes('SE');
const pick = () => S.ch === 'ALL' ? ALLCH : [S.ch];

// ---------- 비교 기간 (전주/직전 · 작년 동기 · 직접 지정) ----------
const prevLabel = () => S.days === 7 ? '전주' : (S.days >= 28 && S.days <= 31) ? '전월' : '직전 기간';
const cmpList = () => S.cmpMode === 'custom' ? [['비교 기간', 'cmp']] : [[prevLabel(), 'prev'], ['작년 동기', 'yoy']];
const rangeText = p => { const [f, t] = pr(p); return `${fmtD(dayDate(t))}–${fmtD(dayDate(f))}`; };
function badges(get, chs) {                   // 이번 값 대비 비교 기간별 증감률
  const c = get(agg(chs, 'cur'));
  return `<div class="cmp">${cmpList().map(([l, p]) => { const a = agg(chs, p); return `<span><small>${l}</small> ${a.na ? '<span class="delta flat">데이터 없음</span>' : delta(chg(c, get(a)))}</span>`; }).join('')}</div>`;
}
const legendLine = () => `<span class="hint">이번 ${rangeText('cur')}${cmpList().map(([l, p]) => ` · ${l} ${valid(p) ? rangeText(p) : '(데이터 없음)'}`).join('')}</span>`;
const trendSeries = (chs, key) => [{ name: '이번 기간', color: 'var(--brand)', vals: dailySeries(chs, key, 'cur') },
  ...cmpList().filter(([, p]) => valid(p)).map(([l, p], i) => ({ name: l, color: i ? 'var(--c-bl)' : 'var(--sub)', dash: i ? '2 4' : 1, vals: dailySeries(chs, key, p) }))];

// ---------- 채널 성과 · 전체 요약 ----------
function metricBlock(c, key, label, fmt) {
  const cur = agg([c], 'cur')[key];
  const items = [['이번', cur, null]].concat(cmpList().map(([l, p]) => { const a = agg([c], p); return [l, a.na ? null : a[key], a.na ? null : chg(cur, a[key])]; }));
  const mx = Math.max(1, ...items.map(x => x[1] || 0));
  const rows = items.map(([l, v, d], i) => `<div class="brow"><small>${l}</small><div class="track">${v === null ? '' : `<i style="width:${Math.max(2, v / mx * 100)}%;background:${i ? 'var(--sub)' : CH_COLOR[c]};opacity:${i === 0 ? 1 : i === 1 ? .5 : .28}"></i>`}</div><b>${v === null ? '—' : fmt(v)}</b><span class="dl">${d === null ? '' : delta(d)}</span></div>`).join('');
  return `<div class="mblock"><div class="mlabel">${label}</div>${rows}</div>`;
}
function topCards() {
  const defs = [['IG', 'reach', '도달'], ['YT', 'views', '조회'], ['BL', 'views', '조회']];
  return defs.map(([ch, key, lab]) => {
    const l = myContents().filter(c => c.ch === ch && inPeriod(c, 'cur')).sort((a, b) => b[key] - a[key]).slice(0, 3);
    return `<div class="card" style="border-top:3px solid ${CH_COLOR[ch]}"><h3><span class="dot" style="background:${CH_COLOR[ch]}"></span>${CHANNELS[ch]} 인기 콘텐츠 <small>${lab}순 TOP3</small></h3>${l.map((c, i) => `<div class="trow"><i>${i + 1}</i><div><b>${esc(c.title)}</b><div class="hint">${S.brand === 'ALL' ? BRANDS[c.brand] + ' · ' : ''}${c.format} · ${mmdd(c.date)} · ${c.id}</div></div><div class="tv"><b>${n(c[key])}</b><small>${lab}</small></div></div>`).join('') || '<span class="hint">기간 내 발행 콘텐츠 없음</span>'}</div>`;
  }).join('');
}
function issues() {
  const out = [], cp = cmpList(), L1 = cp[0][0], L2 = cp[1] && cp[1][0];
  const cur = {}, p1 = {}, p2 = {};
  ALLCH.forEach(c => { cur[c] = agg([c], 'cur'); p1[c] = agg([c], cp[0][1]); p2[c] = cp[1] ? agg([c], cp[1][1]) : null; });
  const M = [['reach', '도달'], ['eng', '반응'], ['gain', '팔로워 증가'], ['clicks', '링크 유입']];
  let big = null;
  ALLCH.forEach(c => M.forEach(([k, l]) => { if (p1[c].na || !p1[c][k]) return; const d = chg(cur[c][k], p1[c][k]); if (!big || Math.abs(d) > Math.abs(big.d)) big = { c, l, d }; }));
  if (big && Math.abs(big.d) >= 5) out.push({ sev: big.d > 0 ? 'good' : 'bad', t: `${CHANNELS[big.c]} ${big.l}이(가) ${L1} 대비 ${big.d > 0 ? '+' : ''}${big.d.toFixed(1)}%로 가장 크게 변했습니다`, a: big.d > 0 ? '상승 요인(소재·포맷)을 [분석] 탭에서 확인하고 다른 채널에도 적용해 보세요.' : '[분석] 탭에서 원인을 확인하고 이번 주 편성에 보완하세요.' });
  if (L2) ALLCH.forEach(c => {
    if (p1[c].na || p2[c].na) return;
    const a = chg(cur[c].reach, p1[c].reach), b = chg(cur[c].reach, p2[c].reach);
    if (a > 3 && b < -3) out.push({ sev: 'warn', t: `${CHANNELS[c]} 도달: ${L1} 대비 ${a.toFixed(1)}% 올랐지만 ${L2}보다는 ${Math.abs(b).toFixed(1)}% 낮습니다`, a: '단기 회복 중이나 작년 수준엔 못 미칩니다. 작년 동기 인기 콘텐츠를 올해 다시 만들어 보세요.' });
    if (a < -3 && b > 3) out.push({ sev: 'warn', t: `${CHANNELS[c]} 도달: ${L1} 대비 ${Math.abs(a).toFixed(1)}% 떨어졌지만 ${L2}보다는 ${b.toFixed(1)}% 높습니다`, a: '일시적 하락일 수 있습니다. 다음 주 추이까지 확인하세요.' });
  });
  ALLCH.forEach(c => {
    if (p1[c].na) return;
    const r = chg(cur[c].reach, p1[c].reach), g = chg(cur[c].gain, p1[c].gain);
    if (r > 5 && g < -5) out.push({ sev: 'warn', t: `${CHANNELS[c]}: 도달은 늘었지만 팔로워 증가는 줄었습니다 (도달 ${r.toFixed(1)}%, 팔로워 ${g.toFixed(1)}%)`, a: '노출이 팔로우로 이어지지 않습니다. 프로필 링크·마지막 장 CTA·고정댓글을 점검하세요.' });
    const e0 = p1[c].eng / p1[c].reach, e1 = cur[c].eng / cur[c].reach;
    if (e1 / e0 < 0.92) out.push({ sev: 'bad', t: `${CHANNELS[c]} 반응률이 ${(e0 * 100).toFixed(1)}% → ${(e1 * 100).toFixed(1)}%로 하락했습니다`, a: '제목·첫 장 훅과 질문형 CTA(댓글·저장 유도)를 점검하세요.' });
  });
  ALLCH.forEach(c => {
    const pub = myContents().filter(x => x.ch === c && inPeriod(x, 'cur')).length, nxt = myContents().filter(x => x.ch === c && x.ago < 0 && x.ago >= -7).length;
    if (!pub) out.push({ sev: 'bad', t: `${CHANNELS[c]}: 이번 기간 발행이 없습니다`, a: '발행 공백은 도달 하락으로 이어집니다. 플래너에서 일정을 확인하세요.' });
    else if (!nxt) out.push({ sev: 'warn', t: `${CHANNELS[c]}: 앞으로 7일 발행 예정이 없습니다`, a: '[플래너]에서 소재를 배정하세요.' });
  });
  const eff = ALLCH.map(c => [c, cur[c].clicks / cur[c].views]).sort((a, b) => a[1] - b[1])[0];
  out.push({ sev: 'info', t: `${CHANNELS[eff[0]]}은(는) 조회 대비 링크 클릭률이 가장 낮습니다 (${(eff[1] * 100).toFixed(2)}%)`, a: '링크 위치(설명란·고정댓글·본문 상단)와 CTA 문구를 보강하세요. 자세한 내용은 [유입 성과]에서 확인하세요.' });
  const topC = myContents().filter(c => inPeriod(c, 'cur')).sort((a, b) => b.reach - a.reach)[0];
  if (topC) out.push({ sev: 'good', t: `이번 기간 최고 성과: "${topC.title}" (${CHANNELS[topC.ch]} · ${topC.format}, 도달 ${n(topC.reach)})`, a: '같은 소재를 다른 채널 포맷으로 확장해 보세요.' });
  const order = { bad: 0, warn: 1, good: 2, info: 3 };
  return out.sort((a, b) => order[a.sev] - order[b.sev]).slice(0, 7);
}
function viewSummary(tabs) {
  const cards = ALLCH.map(c => {
    const a = agg([c], 'cur');
    return `<div class="card chcard" style="border-top:3px solid ${CH_COLOR[c]}"><h3><span class="dot" style="background:${CH_COLOR[c]}"></span>${CHANNELS[c]} <a class="more" onclick="S.ch='${c}';render()">상세 →</a></h3>
      ${metricBlock(c, 'reach', '도달', n)}${metricBlock(c, 'views', '조회', n)}${metricBlock(c, 'eng', `반응 <small>(반응률 ${(a.eng / a.reach * 100).toFixed(1)}%)</small>`, n)}${metricBlock(c, 'gain', '팔로워 증가', v => '+' + n(v))}</div>`;
  }).join('');
  const SEV = { bad: ['주의', 'bad'], warn: ['확인', 'warn'], good: ['호재', 'good'], info: ['참고', 'info'] };
  const list = issues().map(i => `<div class="issue ${i.sev}"><span class="sev">${SEV[i.sev][0]}</span><div><b>${i.t}</b><div class="hint">→ ${i.a}</div></div></div>`).join('');
  return `<div class="subtabs">${tabs}</div><div class="subtabs">${legendLine()}</div>
  <div class="grid g3">${cards}</div>
  <div class="grid g3" style="margin-top:12px">${topCards()}</div>
  <div class="card" style="margin-top:12px"><h3>핵심 이슈 <small>세 채널을 통합해서 본 변화와 점검 사항</small> <span class="sample">규칙 기반 샘플 · 실제는 Claude가 요약</span></h3>${list}</div>`;
}

function viewOps() {
  const chs = pick(), all = S.ch === 'ALL';
  const tabs = [['ALL', '전체'], ...ALLCH.map(c => [c, CHANNELS[c]])].map(([k, l]) => `<button class="${S.ch === k ? 'on' : ''}" onclick="S.ch='${k}';render()">${l}</button>`).join('');
  if (all) return viewSummary(tabs);
  const list = myContents().filter(c => chs.includes(c.ch) && inPeriod(c, 'cur'));
  const byFmt = {}; list.forEach(c => { const r = byFmt[c.format] ||= { n: 0, reach: 0 }; r.n++; r.reach += c.reach; });
  const best = Object.entries(byFmt).sort((a, b) => b[1].reach / b[1].n - a[1].reach / a[1].n)[0];
  const cur = agg(chs, 'cur');
  const label = all ? '전체 채널' : CHANNELS[S.ch];
  const parts = cmpList().map(([l, p]) => { const a = agg(chs, p); return a.na ? '' : `${l} 대비 ${chg(cur.reach, a.reach) >= 0 ? '+' : ''}${chg(cur.reach, a.reach).toFixed(1)}%`; }).filter(Boolean).join(', ');
  const insight = `${label} 도달은 ${parts || '비교 데이터 없음'}입니다.${best ? ` 이번 기간 평균 도달이 가장 높은 포맷은 ${best[0]}(${n(best[1].reach / best[1].n)})입니다.` : ''}`;
  const kp = [['views', '조회', '채널 합계'], ['reach', '도달', '중복 포함'], ['eng', '반응', '좋아요·댓글·공유·저장'], ['gain', '팔로워 증가', '순증가']];
  const kpis = kp.map(([k, l, note]) => `<div class="card kpi"><div class="lbl">${l} <span class="hint">${note}</span></div><div class="val">${n(cur[k])}</div>${badges(a => a[k], chs)}<div>${spark(dailySeries(chs, k, 'cur'), 'var(--brand)')}</div></div>`).join('');

  const chCards = ALLCH.map(c => {
    const a = agg([c], 'cur');
    const row = (l, v, g) => `<div class="mrow"><span>${l}</span><b>${v}</b>${badges(g, [c])}</div>`;
    return `<div class="card chcard" style="border-top:3px solid ${CH_COLOR[c]}"><h3><span class="dot" style="background:${CH_COLOR[c]}"></span>${CHANNELS[c]} <a class="more" onclick="S.ch='${c}';render()">상세 →</a></h3>
      ${row('도달', n(a.reach), x => x.reach)}${row('조회', n(a.views), x => x.views)}${row('반응', `${n(a.eng)} <small>(${(a.eng / a.reach * 100).toFixed(1)}%)</small>`, x => x.eng)}${row('팔로워 증가', '+' + n(a.gain), x => x.gain)}</div>`;
  }).join('');

  const bestDay = (() => { const t = [0, 0, 0, 0, 0, 0, 0], c = [0, 0, 0, 0, 0, 0, 0]; brands().forEach(b => chs.forEach(ch => { for (let i = S.end0; i < S.end0 + S.days; i++) { const d = DAILY[b][ch][i]; t[d.date.getDay()] += d.reach; c[d.date.getDay()]++; } })); const avg = t.map((v, i) => v / (c[i] || 1)); return '일월화수목금토'[avg.indexOf(Math.max(...avg))] + '요일'; })();
  const topCh = ALLCH.map(c => [c, agg([c], 'cur')]).sort((a, b) => b[1].eng / b[1].reach - a[1].eng / a[1].reach)[0];
  const sched = myContents().filter(c => c.ago < 0 && c.ago >= -7).length;
  const signals = [['반응률', `${(cur.eng / cur.reach * 100).toFixed(1)}%`], ['도달이 가장 높은 요일', bestDay], ['반응률 최고 채널', `${CHANNELS[topCh[0]]} · ${(topCh[1].eng / topCh[1].reach * 100).toFixed(1)}%`], ['앞으로 7일 발행 예정', `${sched}건`]];

  const best1 = [...list].sort((a, b) => b.reach - a.reach)[0], recent = [...list].sort((a, b) => a.ago - b.ago)[0], rising = myContents().filter(c => chs.includes(c.ch) && c.status === 'published' && c.ago < 45).sort((a, b) => b.growth7 - a.growth7)[0];
  const hi = [['BEST', best1, c => `조회 ${n(c.views)} · 반응 ${n(c.eng)}`], ['RECENT', recent, c => `${mmdd(c.date)} 발행 · 조회 ${n(c.views)}`], ['RISING', rising, c => `최근 7일 ${c.growth7 >= 0 ? '+' : ''}${c.growth7}% · 조회 ${n(c.views)}`]]
    .filter(x => x[1]).map(([t, c, f]) => `<div class="hl"><span class="tag">${t}</span><span class="tag">${CHANNELS[c.ch]} · ${c.format}</span><b>${esc(c.title)}</b><div class="hint">${f(c)}</div><div class="hint">${c.id}</div></div>`).join('');
  const rowsC = [...list].sort((x, y) => y.reach - x.reach).slice(0, 10).map(c => `<tr><td class="l"><b>${esc(c.title)}</b><br><span class="tag">${CHANNELS[c.ch]}</span><span class="tag">${c.format}</span><span class="tag">${c.id}</span></td><td>${mmdd(c.date)}</td><td>${n(c.views)}</td><td>${n(c.reach)}</td><td>${n(c.eng)}</td><td>${(c.eng / c.reach * 100).toFixed(1)}%</td></tr>`).join('');

  const pastP = S.cmpMode === 'custom' ? 'cmp' : 'yoy';
  const pastList = valid(pastP) ? myContents().filter(c => chs.includes(c.ch) && inPeriod(c, pastP)).sort((x, y) => y.reach - x.reach).slice(0, 5) : [];
  const pastRows = pastList.map((c, i) => `<tr><td>${i + 1}</td><td class="l"><b>${esc(c.title)}</b><br><span class="tag">${BRANDS[c.brand]}</span><span class="tag">${CHANNELS[c.ch]}</span><span class="tag">${c.format}</span><span class="tag">${c.topic}</span></td><td>${fmtD(c.date)}</td><td>${n(c.views)}</td><td>${n(c.eng)}</td><td>${(c.eng / c.reach * 100).toFixed(1)}%</td><td><button onclick="toMake('${esc(c.title)}','${c.brand}')">올해 다시 만들기</button></td></tr>`).join('');
  const past = `<div class="card"><h3>${pastP === 'yoy' ? '작년 동기간' : '비교 기간'} 인기 콘텐츠 <small>${valid(pastP) ? rangeText(pastP) : ''} · 도달순 상위 5건</small></h3>${valid(pastP) ? `<div class="tablewrap"><table><tr><th>#</th><th class="l">콘텐츠</th><th>발행</th><th>조회</th><th>반응</th><th>반응률</th><th></th></tr>${pastRows || '<tr><td colspan=7>해당 기간 발행 콘텐츠 없음</td></tr>'}</table></div><p class="hint">시즌성 소재를 올해 일정에 다시 올릴 때 참고하세요. 버튼을 누르면 제작 화면으로 이동합니다.</p>` : '<span class="hint">해당 기간 데이터가 없습니다.</span>'}</div>`;
  const top = all
    ? `<div class="grid g4">${kpis}</div><div class="grid g3" style="margin-top:12px">${chCards}</div>
       <div class="grid g2" style="margin-top:12px"><div class="card"><h3>채널별 도달 추이 <small>이번 기간 · 3일 이동평균</small></h3>${lineChart(ALLCH.map(c => ({ name: CHANNELS[c], color: CH_COLOR[c], vals: dailySeries([c], 'reach', 'cur') })), [fmtD(dayDate(S.end0 + S.days - 1)), fmtD(dayDate(S.end0))])}</div>
       <div class="card"><h3>특이사항 <small>지금 확인하면 좋은 신호</small></h3><table>${signals.map((s, i) => `<tr><td class="l"><b>${i + 1}. ${s[0]}</b></td><td>${s[1]}</td></tr>`).join('')}</table></div></div>`
    : `<div class="grid g4">${kpis}</div><div class="grid g2" style="margin-top:12px">
       <div class="card"><h3>${label} 도달 추이 <small>3일 이동평균 · 점선/점=비교 기간</small></h3>${lineChart(trendSeries(chs, 'reach'), [fmtD(dayDate(S.end0 + S.days - 1)), fmtD(dayDate(S.end0))])}</div>
       <div class="card"><h3>${label} 특이사항 <small>지금 확인하면 좋은 신호</small></h3><table>${signals.map((s, i) => `<tr><td class="l"><b>${i + 1}. ${s[0]}</b></td><td>${s[1]}</td></tr>`).join('')}</table></div></div>`;

  return `<div class="subtabs">${tabs}</div><div class="subtabs">${legendLine()}</div>
  <div class="banner"><div><b>${label} 핵심 인사이트</b> <span class="sample">규칙 기반 샘플 · 실제는 Claude 해설</span><br>${insight}</div><button onclick="S.tab='why';render()">원인 분석 보기 →</button></div>
  ${top}
  <div style="margin-top:12px">${past}</div>
  <div class="card"><h3>콘텐츠 하이라이트 <small>반응이 좋았던 콘텐츠와 최근 성과</small></h3><div class="grid g3">${hi || '<span class="hint">기간 내 콘텐츠 없음</span>'}</div></div>
  <div class="card"><h3>콘텐츠별 채널 성과 <small>도달순 상위 10건 / 전체 ${list.length}건 · 링크 유입은 [유입 성과]에서</small></h3><div class="tablewrap"><table><tr><th>콘텐츠</th><th>발행</th><th>조회</th><th>도달</th><th>반응</th><th>반응률</th></tr>${rowsC || '<tr><td colspan=6>기간 내 발행 콘텐츠 없음</td></tr>'}</table></div></div>`;
}

// 비틀리 클릭 (scope: ALL | IG | YT | BL | CF)
function clickDay(scope, i) {
  let t = 0;
  if (scope === 'ALL' || scope === 'CF') { if (hasCafe()) t += CAFE_DAILY[i]; }
  if (scope !== 'CF') brands().forEach(b => (scope === 'ALL' ? ALLCH : [scope]).forEach(c => { t += DAILY[b][c][i].clicks; }));
  return t;
}
function clickSum(scope, period) { if (!valid(period)) return null; const [f, t] = pr(period); let s = 0; for (let i = f; i <= t; i++) s += clickDay(scope, i); return s; }
function clickSeries(scope, period) { if (!valid(period)) return []; const [f, t] = pr(period); const o = []; for (let i = t; i >= f; i--) o.push(clickDay(scope, i)); return o; }

function cause(c, avgReach, avgRate) {
  const rate = c.clicks / c.views, hiR = c.reach >= avgReach, hiC = rate >= avgRate;
  if (hiR && hiC) return '도달·유입 모두 평균 이상. 같은 소재를 다른 채널로 확장해 보세요.';
  if (hiR) return '조회는 높지만 링크 전환이 낮습니다. CTA 문구와 링크 위치(설명란·고정댓글·마지막 장)를 보강하세요.';
  if (hiC) return '도달은 낮지만 전환이 강합니다. 제목·썸네일·발행 시간을 개선하면 확장 여지가 큽니다.';
  return '도달·전환 모두 평균 이하. 소재와 포맷을 재검토하세요.';
}
function rankRows() {
  const l = myContents().filter(c => inPeriod(c, 'cur') && (S.scope === 'ALL' || c.ch === S.scope)).sort((a, b) => b.clicks - a.clicks);
  const aR = l.reduce((s, c) => s + c.reach, 0) / (l.length || 1), aC = l.reduce((s, c) => s + c.clicks, 0) / Math.max(1, l.reduce((s, c) => s + c.views, 0));
  return l.map(c => ({ ...c, rate: c.clicks / c.views, why: cause(c, aR, aC) }));
}
function downloadCsv() {
  const rows = rankRows(), q = v => `"${String(v).replaceAll('"', '""')}"`;
  const csv = '﻿' + [['콘텐츠ID', '제목', '브랜드', '채널', '포맷', '발행일', '조회', '반응', '비틀리 클릭', '유입률'], ...rows.map(c => [c.id, c.title, BRANDS[c.brand], CHANNELS[c.ch], c.format, fmtD(c.date), c.views, c.eng, c.clicks, (c.rate * 100).toFixed(2) + '%'])].map(r => r.map(q).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `링크순위_${fmtD(dayDate(S.end0))}.csv`; a.click();
}
function viewRank() {
  const scopes = ['ALL', ...ALLCH, ...(hasCafe() ? ['CF'] : [])];
  if (!scopes.includes(S.scope)) S.scope = 'ALL';
  const tabs = scopes.map(k => `<button class="${S.scope === k ? 'on' : ''}" onclick="S.scope='${k}';S.more=10;render()">${k === 'ALL' ? '전체' : chName(k)}</button>`).join('');
  const cur = clickSum(S.scope, 'cur'), prev = clickSum(S.scope, 'prev');
  const chRows = scopes.filter(k => k !== 'ALL').map(k => ({ k, v: clickSum(k, 'cur'), p: clickSum(k, 'prev') || 0 }));
  const tot = chRows.reduce((s, r) => s + r.v, 0), mx = Math.max(1, ...chRows.map(r => r.v));
  const bars = chRows.map(r => `<button class="cbar ${S.scope === r.k ? 'sel' : ''}" onclick="S.scope='${r.k}';S.more=10;render()"><em>${n(r.v)}</em><div><i style="height:${Math.max(8, r.v / mx * 100)}%;background:${CH_COLOR[r.k] || 'var(--c-bt)'}"></i></div><b>${chName(r.k)}</b><small>${(r.v / tot * 100).toFixed(1)}% · ${delta(chg(r.v, r.p))}</small></button>`).join('');
  const rows = S.scope === 'CF' ? [] : rankRows();
  const body = rows.slice(0, S.more).map((c, i) => `<tr><td>${i + 1}</td><td class="l"><b>${esc(c.title)}</b><br><span class="tag">${CHANNELS[c.ch]}</span><span class="tag">${c.format}</span><span class="tag">${c.id}</span></td><td><b>${n(c.clicks)}</b></td><td>${(c.rate * 100).toFixed(2)}%</td><td class="l" style="white-space:normal;min-width:260px">${c.why}</td></tr>`).join('');
  const label = S.scope === 'ALL' ? '전체' : chName(S.scope);
  return `<div class="subtabs">${tabs}</div><div class="subtabs">${legendLine()} <span class="hint">· 채널 밖에서 우리 사이트로 들어온 유입(비틀리 클릭)</span></div>
  <div class="card kpi big"><div class="lbl">${label} 유입수 <span class="hint">· 비틀리 클릭 합계 (샘플)</span></div><div class="val">${n(cur)}</div><div class="cmp">${cmpList().map(([l, p]) => { const v = clickSum(S.scope, p); return `<span><small>${l}</small> ${v === null ? '<span class="delta flat">데이터 없음</span>' : delta(chg(cur, v))}</span>`; }).join('')}</div></div>
  <div class="grid g2" style="margin-top:12px">
   <div class="card"><h3>${label} 유입 추이 <small>점선/점=비교 기간</small></h3>${lineChart([{ name: '이번 기간', color: 'var(--brand)', vals: clickSeries(S.scope, 'cur') }, ...cmpList().filter(([, p]) => valid(p)).map(([l, p], i) => ({ name: l, color: i ? 'var(--c-bl)' : 'var(--sub)', dash: i ? '2 4' : 1, vals: clickSeries(S.scope, p) }))], [fmtD(dayDate(S.end0 + S.days - 1)), fmtD(dayDate(S.end0))])}</div>
   <div class="card"><h3>채널별 유입 <small>막대를 누르면 해당 채널 선택</small></h3><div class="cbars">${bars}</div></div>
  </div>
  <div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><h3>${label} 유입 링크 순위 <small>${rangeLabel()} · ${rows.length}건 · 클릭순</small></h3><button onclick="downloadCsv()">엑셀(CSV) 내려받기</button></div>
   ${S.scope === 'CF' ? '<div class="callout">네이버 카페는 비틀리 클릭만 집계합니다(실버카페 링크). 개별 글과의 연결은 지원하지 않습니다.</div>' : `<div class="tablewrap"><table><tr><th>#</th><th class="l">콘텐츠</th><th>유입수</th><th>유입률</th><th class="l">성과 원인과 부족한 부분 <span class="sample">샘플 규칙</span></th></tr>${body || '<tr><td colspan=5>기간 내 데이터 없음</td></tr>'}</table></div>${S.more < rows.length ? `<p><button onclick="S.more+=20;render()">더 보기 (${S.more} / ${rows.length})</button></p>` : ''}`}
  </div>
  <p class="hint">샘플 데이터입니다. 연결 후에는 비틀리 링크 제목 앞글자(키즈링크·키즈유튜브·키즈블로그·실버링크·실버유튜브·실버블로그·실버카페)로 브랜드·채널을 자동 분류합니다.</p>`;
}

// ---------- 뷰: 분석 ----------
function fmtStats(period) {
  const m = {};
  myContents().filter(c => inPeriod(c, period)).forEach(c => { const r = m[c.format] ||= { n: 0, reach: 0, eng: 0 }; r.n++; r.reach += c.reach; r.eng += c.eng; });
  return m;
}
function viewWhy() {
  const cur = agg(ALLCH, 'cur'), prev = agg(ALLCH, 'prev');
  const dReach = chg(cur.reach, prev.reach), dEr = chg(cur.eng / cur.reach, prev.eng / prev.reach), dClk = chg(cur.clicks, prev.clicks);
  const cc = myContents().filter(c => inPeriod(c, 'cur')), pc = myContents().filter(c => inPeriod(c, 'prev'));
  const short = l => l.filter(c => c.format === '릴스' || c.format === '쇼츠').length / (l.length || 1) * 100;
  const fs = fmtStats('cur'); const best = Object.entries(fs).sort((a, b) => b[1].reach / b[1].n - a[1].reach / a[1].n)[0];
  const down = dReach < -3, up = dReach > 3;
  const row = (l, c, p, unit, inv) => `<tr><td class="l">${l}</td><td>${unit(p)}</td><td>${unit(c)}</td><td>${delta(chg(c, p), inv)}</td></tr>`;
  const cause = [
    `발행 수: 직전 ${pc.length}건 → 이번 ${cc.length}건`,
    `릴스·숏폼 비중: ${short(pc).toFixed(0)}% → ${short(cc).toFixed(0)}%`,
    best ? `이번 기간 평균 도달이 가장 높은 포맷: ${best[0]} (${n(best[1].reach / best[1].n)})` : ''
  ].filter(Boolean);
  const verdict = down ? `<div class="callout bad"><b>도달이 직전 대비 ${Math.abs(dReach).toFixed(1)}% 떨어졌습니다.</b><br>숫자로 확인된 변화: ${cause.join(' / ')}.<br><b>보완 제안:</b> ${short(cc) < short(pc) ? '숏폼 비중을 이전 수준으로 되돌리고, ' : ''}${best ? best[0] + ' 포맷을 이번 주 우선 편성, ' : ''}반응률이 ${dEr < 0 ? '함께 떨어졌으므로 제목·첫 장 훅 점검' : '유지 중이므로 노출(발행 빈도·시간대) 위주 점검'}.</div>`
    : up ? `<div class="callout good"><b>도달이 직전 대비 ${dReach.toFixed(1)}% 올랐습니다.</b><br>숫자로 확인된 변화: ${cause.join(' / ')}.<br><b>유지 제안:</b> ${best ? best[0] + ' 포맷과 ' : ''}상승 콘텐츠의 소재를 시리즈로 이어가기.</div>`
    : `<div class="callout">큰 변화 없음 (${dReach.toFixed(1)}%).</div>`;

  const perCh = ALLCH.map(c => { const a = agg([c], 'cur'), p = agg([c], 'prev'); return `<tr><td class="l"><span class="dot" style="background:${CH_COLOR[c]}"></span>${CHANNELS[c]}</td><td>${delta(chg(a.reach, p.reach))}</td><td>${delta(chg(a.eng / a.reach, p.eng / p.reach))}</td><td>${delta(chg(a.clicks, p.clicks))}</td></tr>`; }).join('');
  const fRows = Object.entries(fs).map(([f, r]) => `<tr><td class="l">${f}</td><td>${r.n}</td><td>${n(r.reach / r.n)}</td><td>${(r.eng / r.reach * 100).toFixed(1)}%</td></tr>`).join('');

  return `<div class="card"><h3>한 줄 진단 <span class="sample">샘플 해설 · 실제로는 Claude가 같은 숫자를 읽고 작성</span></h3>${verdict}</div>
  <div class="grid g2">
   <div class="card"><h3>1단계 · 무엇이 변했나 <small>직전 ${S.days}일 대비</small></h3><table><tr><th>지표</th><th>직전</th><th>이번</th><th>증감</th></tr>
     ${row('도달', cur.reach, prev.reach, n)}${row('반응률', cur.eng / cur.reach, prev.eng / prev.reach, v => (v * 100).toFixed(1) + '%')}${row('비틀리 클릭', cur.clicks, prev.clicks, n)}${row('팔로워 증가', cur.gain, prev.gain, n)}${row('발행 수', cc.length, pc.length, n)}</table></div>
   <div class="card"><h3>2단계 · 어느 채널에서 변했나</h3><table><tr><th>채널</th><th>도달</th><th>반응률</th><th>클릭</th></tr>${perCh}</table></div>
  </div>
  <div class="card"><h3>3단계 · 원인 후보 점검 <small>포맷별 (이번 기간)</small></h3><table><tr><th>포맷</th><th>발행 수</th><th>평균 도달</th><th>반응률</th></tr>${fRows}</table>
   <p class="hint">이후 단계에서 요일·시간대, 소재 분류, 제목 유형도 같은 방식으로 점검합니다.</p></div>`;
}

// ---------- 뷰: 급상승 ----------
function viewRise() {
  const mine = myContents().filter(c => c.status === 'published' && c.ago < 45).sort((a, b) => b.growth7 - a.growth7).slice(0, 6);
  const comp = COMPETITORS.filter(c => brands().includes(c.brand)).sort((a, b) => b.trend - a.trend);
  return `<div class="grid g2">
  <div class="card"><h3>내 콘텐츠 중 최근 오르는 것 <small>최근 7일 조회 증가율</small></h3><table>${mine.map(c => `<tr><td class="l"><b>${esc(c.title)}</b><br><span class="tag">${CHANNELS[c.ch]}</span><span class="tag">${c.format}</span><span class="tag">${c.id}</span></td><td>${delta(c.growth7)}</td></tr>`).join('')}</table></div>
  <div class="card"><h3>경쟁사·유사 콘텐츠 급상승 <small>팔로워 대비 조회 배율</small></h3><table>${comp.map(c => `<tr><td class="l"><b>${esc(c.post)}</b><br><span class="tag">${CHANNELS[c.ch]}</span>${esc(c.name)} · 팔로워 ${n(c.followers)}</td><td>조회 ${n(c.views)}<br><span class="hint">${c.ratio}배</span></td><td>${delta(c.trend)}</td></tr>`).join('')}</table>
  <p class="hint">인스타 경쟁사는 공개 정보(팔로워·게시물 반응)만 수집 가능합니다. 유튜브·블로그는 조회수까지 확인합니다.</p></div></div>`;
}

// ---------- 뷰: 추천 ----------
function viewRec() {
  const recs = TOPIC_RECS.filter(r => brands().includes(r.brand));
  const kws = KEYWORDS.filter(k => brands().includes(k.brand));
  const fs = fmtStats('cur'), top = Object.entries(fs).sort((a, b) => b[1].eng / b[1].reach - a[1].eng / a[1].reach)[0];
  return `<div class="card"><h3>잘된 콘텐츠 공통점 <small>내 콘텐츠 분석</small></h3>${top ? `<div class="callout good">반응률이 가장 높은 포맷은 <b>${top[0]}</b> (${(top[1].eng / top[1].reach * 100).toFixed(1)}%). 상위 콘텐츠는 <b>질문형·숫자 포함 제목</b>이 많았습니다 <span class="sample">샘플</span></div>` : '데이터 없음'}</div>
  <div class="card"><h3>소재 추천 <small>점수 + 추천 근거</small></h3><div class="grid g2">${recs.map(r => `<div class="card"><b>${esc(r.title)}</b> <span class="tag">${BRANDS[r.brand]}</span><span class="tag">${r.ch}</span>
   <div class="bar" style="margin:8px 0"><span style="width:${r.score}%"></span></div><div class="hint">추천 점수 ${r.score}</div><ul style="margin:6px 0 10px;padding-left:18px">${r.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
   <button class="primary" onclick="toMake('${esc(r.title)}','${r.brand}')">이 소재로 제작하기 →</button></div>`).join('')}</div></div>
  <div class="card"><h3>키워드 추천 <small>검색광고 API 기준 (샘플)</small></h3><div class="tablewrap"><table><tr><th>키워드</th><th>월 검색량</th><th>경쟁도</th><th>문서 수</th><th>검색량 변화</th><th class="l">추천 이유</th></tr>${kws.map(k => `<tr><td class="l"><b>${k.kw}</b></td><td>${n(k.vol)}</td><td>${k.comp}</td><td>${n(k.docs)}</td><td>${delta(k.chg)}</td><td class="l">${k.why}</td></tr>`).join('')}</table></div></div>`;
}
function toMake(topic, brand) { S.tab = 'make'; S.pre = { topic, brand }; render(); }

// ---------- 뷰: 제작 ----------
function viewMake() {
  const pre = S.pre || {}; S.pre = null;
  return `<div class="card"><h3>콘텐츠 초안 만들기 <span class="sample">지금은 샘플 문안 · 다음 단계에서 Claude 연결</span></h3>
  <div class="form">
   <label>브랜드<select id="m-brand">${Object.entries(BRANDS).map(([k, v]) => `<option value="${k}" ${pre.brand === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
   <label>형식<select id="m-fmt"><option>카드뉴스</option><option>릴스</option><option>블로그</option></select></label>
   <label style="grid-column:span 2">주제<input id="m-topic" value="${esc(pre.topic || '')}" placeholder="예: 집콕 10분 놀이"></label>
   <label>키워드 (선택)<input id="m-kw" placeholder="예: 집콕 놀이"></label>
   <button class="primary" onclick="makeDraft()">초안 생성</button></div></div>
  <div class="card"><h3>결과</h3><pre class="out" id="m-out">주제를 입력하고 [초안 생성]을 누르세요.</pre>
  <p><button onclick="navigator.clipboard.writeText($('#m-out').textContent)">복사</button> <span class="hint">블로그는 자동 업로드가 안 되어 복사해서 발행합니다. 자동 업로드는 이후 단계에서 검토합니다.</span></p></div>`;
}
function makeDraft() {
  const t = $('#m-topic').value.trim() || '(주제 입력)', f = $('#m-fmt').value, b = BRANDS[$('#m-brand').value], kw = $('#m-kw').value.trim() || t;
  const o = {
    '카드뉴스': `[${b}] 카드뉴스 · ${t}\n\n1장 (표지) 훅: "${t}, 아직도 모르세요?"\n2장 문제 제기: 이런 고민, 한 번쯤 해보셨죠?\n3장 핵심 ①\n4장 핵심 ②\n5장 핵심 ③\n6장 마무리/CTA: 자세한 내용은 프로필 링크에서 확인\n\n캡션: ${t} 핵심만 모았어요. 저장해두고 필요할 때 꺼내 보세요!\n해시태그: #${kw.replace(/\s/g, '')} #${b}`,
    '릴스': `[${b}] 릴스 · ${t} (30초)\n\n0–3초 훅: "${t}, 이거 하나면 끝!"\n3–10초 문제 상황\n10–25초 해결 방법 3가지 (자막 + 화면 전환)\n25–30초 CTA: "더 보고 싶다면 팔로우, 링크는 프로필에"\n\n캡션: ${t} #${kw.replace(/\s/g, '')}`,
    '블로그': `[${b}] 블로그 · ${t}\n\n제목 후보\n1) ${kw} 이렇게 하면 됩니다 (총정리)\n2) ${kw}, 처음이라면 꼭 읽어보세요\n\n구성\n- 도입: 독자의 고민 공감 (3줄)\n- 본문 1: ${kw}란?\n- 본문 2: 단계별 방법\n- 본문 3: 자주 묻는 질문\n- 마무리: 요약 + 신청/문의 링크(비틀리, UTM 자동 부착)\n\n권장 키워드 배치: 제목 1회, 첫 문단 1회, 소제목 2회`
  }[f];
  $('#m-out').textContent = o;
}

// ---------- 뷰: 플래너 ----------
function viewPlan() {
  const cols = ['idea', 'drafting', 'review', 'scheduled', 'published'];
  const items = myContents();
  return `<div class="card"><h3>발행 상태판 <small>콘텐츠 ID 기준</small></h3><div class="kanban">${cols.map(st => {
    const l = items.filter(c => c.status === st).sort((a, b) => st === 'published' ? a.ago - b.ago : b.ago - a.ago).slice(0, st === 'published' ? 5 : 20);
    return `<div class="col"><h4>${STATUS[st]} (${l.length}${st === 'published' ? '+' : ''})</h4>${l.map(c => `<div class="item"><b>${esc(c.title)}</b><span class="tag">${CHANNELS[c.ch]}</span><span class="tag">${BRANDS[c.brand]}</span><br><span class="hint">${c.id} · ${mmdd(c.date)}</span></div>`).join('') || '<span class="hint">없음</span>'}</div>`;
  }).join('')}</div></div>
  <div class="card"><h3>다가오는 일정</h3><table>${items.filter(c => c.ago < 0).sort((a, b) => b.ago - a.ago).map(c => `<tr><td class="l">${mmdd(c.date)}</td><td class="l"><b>${esc(c.title)}</b></td><td>${CHANNELS[c.ch]}</td><td>${BRANDS[c.brand]}</td><td>${STATUS[c.status]}</td></tr>`).join('')}</table></div>`;
}

// ---------- 공통 ----------
const VIEWS = { perf: viewOps, traffic: viewRank, why: viewWhy, rise: viewRise, rec: viewRec, make: viewMake, plan: viewPlan };
function render() {
  $('#nav').innerHTML = TABS.map(([k, i, l]) => `<a class="${S.tab === k ? 'on' : ''}" onclick="S.tab='${k}';render()">${i} ${l}</a>`).join('');
  $('#title').textContent = TABS.find(t => t[0] === S.tab)[2];
  $('#f-hint').textContent = '';
  $('#view').innerHTML = VIEWS[S.tab]();
}
$('#f-brand').innerHTML = '<option value="ALL">전체</option>' + Object.entries(BRANDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('#f-brand').onchange = e => { S.brand = e.target.value; render(); };
function applyRange() {
  const v = $('#f-days').value, custom = v === '직접';
  $('#f-custom').style.display = custom ? '' : 'none';
  if (!custom) { S.days = PRESET[v]; S.end0 = 0; }
  else { const s = $('#f-start').valueAsDate, e = $('#f-end').valueAsDate; if (s && e && e >= s) { const loc = x => new Date(x.getTime() + x.getTimezoneOffset() * 60000); S.end0 = Math.max(0, idx(loc(e))); S.days = Math.min(360, Math.round((e - s) / 864e5) + 1); } }
  applyCmp();
}
function applyCmp() {
  const custom = $('#f-cmp').value === 'custom';
  $('#f-cmpdate').style.display = custom ? '' : 'none';
  S.cmpMode = custom ? 'custom' : 'auto';
  const v = $('#f-cmpstart').valueAsDate; S.cmpStart = custom && v ? new Date(v.getTime() + v.getTimezoneOffset() * 60000) : null;
  S.more = 10; render();
}
$('#f-days').onchange = applyRange; $('#f-start').onchange = applyRange; $('#f-end').onchange = applyRange;
$('#f-cmp').onchange = applyCmp; $('#f-cmpstart').onchange = applyCmp;
render();
