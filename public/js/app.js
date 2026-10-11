const TABS = [
  ['perf', '📊', '성과'], ['why', '🔍', '분석 (왜?)'], ['rise', '🚀', '급상승'],
  ['rec', '💡', '추천'], ['make', '✍️', '제작'], ['plan', '🗓️', '플래너']
];
const S = { tab: 'perf', brand: 'ALL', days: 30 };
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
  const from = period === 'cur' ? 0 : S.days, to = period === 'cur' ? S.days - 1 : S.days * 2 - 1;
  const t = { reach: 0, views: 0, eng: 0, clicks: 0, gain: 0 };
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
  return period === 'cur' ? c.ago < S.days : (c.ago >= S.days && c.ago < S.days * 2);
}
const myContents = () => CONTENTS.filter(c => brands().includes(c.brand));

// ---------- 차트 ----------
function spark(vals, color) {
  const w = 120, h = 30, mx = Math.max(...vals), mn = Math.min(...vals);
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - (v - mn) / ((mx - mn) || 1) * (h - 4) - 2).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="${color}" stroke-width="2" points="${pts}"/></svg>`;
}
function lineChart(series) {                   // series: [{name,color,vals}]
  const w = 640, h = 190, p = 28, all = series.flatMap(s => s.vals), mx = Math.max(...all) * 1.08, len = series[0].vals.length;
  const X = i => p + i / (len - 1) * (w - p - 8), Y = v => h - 22 - v / mx * (h - 34);
  const grid = [0, .5, 1].map(f => `<line x1="${p}" x2="${w - 8}" y1="${Y(mx * f)}" y2="${Y(mx * f)}" stroke="var(--line)"/><text x="0" y="${Y(mx * f) + 4}" font-size="10" fill="var(--sub)">${n(mx * f / 1000)}k</text>`).join('');
  const lines = series.map(s => `<polyline fill="none" stroke="${s.color}" stroke-width="2" points="${s.vals.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}"/>`).join('');
  const legend = series.map(s => `<span><span class="dot" style="background:${s.color}"></span>${s.name}</span>`).join(' &nbsp; ');
  return `<div class="hint" style="margin-bottom:4px">${legend}</div><svg viewBox="0 0 ${w} ${h}" width="100%">${grid}${lines}</svg>`;
}
function dailySeries(chs, key, days) {         // 오래된 → 최근 (이동평균 3일)
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    let t = 0; brands().forEach(b => chs.forEach(c => { t += DAILY[b][c][i][key]; })); out.push(t);
  }
  return out.map((_, i, a) => { const s = a.slice(Math.max(0, i - 2), i + 1); return s.reduce((x, y) => x + y, 0) / s.length; });
}

// ---------- 뷰: 성과 ----------
function viewPerf() {
  const kp = [['reach', '도달'], ['views', '조회'], ['eng', '반응 (좋아요·댓글·공유·저장)'], ['gain', '팔로워 증가'], ['clicks', '비틀리 클릭']];
  const cur = agg(ALLCH, 'cur'), prev = agg(ALLCH, 'prev');
  const kpis = kp.map(([k, l]) => `<div class="card kpi"><div class="lbl">${l}</div><div class="val">${n(cur[k])}</div>${delta(chg(cur[k], prev[k]))}<div>${spark(dailySeries(ALLCH, k, S.days), 'var(--brand)')}</div></div>`).join('');

  const rows = ALLCH.map(c => {
    const a = agg([c], 'cur'), p = agg([c], 'prev');
    return `<tr><td class="l"><span class="dot" style="background:${CH_COLOR[c]}"></span>${CHANNELS[c]}</td><td>${n(a.reach)} ${delta(chg(a.reach, p.reach))}</td><td>${n(a.views)}</td><td>${n(a.eng)} ${delta(chg(a.eng, p.eng))}</td><td>${(a.eng / a.reach * 100).toFixed(1)}%</td><td>+${n(a.gain)} ${delta(chg(a.gain, p.gain))}</td><td>${n(a.clicks)} ${delta(chg(a.clicks, p.clicks))}</td></tr>`;
  }).join('');

  const list = myContents().filter(c => inPeriod(c, 'cur')).sort((a, b) => b.reach - a.reach);
  const crow = list.slice(0, 10).map(c => `<tr><td class="l"><b>${esc(c.title)}</b><br><span class="tag">${c.id}</span><span class="tag">${CHANNELS[c.ch]}</span><span class="tag">${c.format}</span></td><td>${mmdd(c.date)}</td>
    <td><div class="flow">${n(c.views)} <i>→</i> ${n(c.eng)} <i>→</i> ${n(c.clicks)}</div></td><td>${(c.eng / c.reach * 100).toFixed(1)}%</td><td>${(c.clicks / c.views * 100).toFixed(2)}%</td></tr>`).join('');

  return `<div class="grid g5">${kpis}</div>
  <div class="card" style="margin-top:12px"><h3>도달 추이 <small>채널별 · 3일 이동평균</small></h3>${lineChart(ALLCH.map(c => ({ name: CHANNELS[c], color: CH_COLOR[c], vals: dailySeries([c], 'reach', S.days) })))}</div>
  <div class="card"><h3>채널별 성과 <small>직전 ${S.days}일 대비</small></h3><div class="tablewrap"><table><tr><th>채널</th><th>도달</th><th>조회</th><th>반응</th><th>반응률</th><th>팔로워</th><th>비틀리 클릭</th></tr>${rows}</table></div></div>
  <div class="card"><h3>콘텐츠별 성과 <small>조회 → 반응 → 클릭 한 줄 · 상위 10건 / 전체 ${list.length}건</small></h3><div class="tablewrap"><table><tr><th>콘텐츠</th><th>발행</th><th>조회 → 반응 → 클릭</th><th>반응률</th><th>클릭률</th></tr>${crow || '<tr><td colspan=5>기간 내 발행 콘텐츠 없음</td></tr>'}</table></div></div>`;
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
const VIEWS = { perf: viewPerf, why: viewWhy, rise: viewRise, rec: viewRec, make: viewMake, plan: viewPlan };
function render() {
  $('#nav').innerHTML = TABS.map(([k, i, l]) => `<a class="${S.tab === k ? 'on' : ''}" onclick="S.tab='${k}';render()">${i} ${l}</a>`).join('');
  $('#title').textContent = TABS.find(t => t[0] === S.tab)[2];
  $('#f-hint').textContent = ['perf', 'why'].includes(S.tab) ? '직전 같은 길이 기간과 비교' : '';
  $('#view').innerHTML = VIEWS[S.tab]();
}
$('#f-brand').innerHTML = '<option value="ALL">전체</option>' + Object.entries(BRANDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('#f-brand').onchange = e => { S.brand = e.target.value; render(); };
$('#f-days').onchange = e => { S.days = +e.target.value; render(); };
render();
