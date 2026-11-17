/* 一起多存一百 · 界面（ui.js）
 * 读 state → AppCore.compute → 把同一次输出画出来。页面自己不做估算。 */
(function () {
  'use strict';
  var A = window.AppCore;
  var KEY = 'everyone-saves:v1';
  var $ = function (id) { return document.getElementById(id); };
  var FIELDS = ['place', 'n', 'y', 'c', 'i', 's', 'k', 't'];
  var LIM = { place: 30, n: 12, y: 12, c: 8, i: 8, s: 12, k: 12, t: 6 };
  var PRESETS = [
    { key: 'base', name: '全镇一起多存（默认）', note: '虚构示例：1000 户的小镇，每户月收入 8000 元；每多收入 100 元在镇上花 75 元，镇上多投资 5 元；家家户户都每月多存 100 元。' },
    { key: 'few', name: '四成人家多存', note: '虚构示例：同一个小镇，只有 400 户每月多存 100 元。', f: function (s) { s.k = '400'; } },
    { key: 'alone', name: '只有我一户', note: '虚构示例：同一个小镇，只有你一户每月多存 100 元。', f: function (s) { s.k = '1'; } },
    { key: 'noinv', name: '投资不跟收入变', note: '虚构示例：同一个小镇，镇上的投资不随生意好坏变化（教科书里节俭悖论最原始的版本）。', f: function (s) { s.i = '0'; } },
    { key: 'city', name: '一座大城', note: '虚构示例：10 万户的城市，每多收入 100 元在本地花 60 元、多投资 10 元；3 万户每月多存 300 元。', f: function (s) { s.place = '一座 10 万户的城市'; s.n = '100000'; s.y = '12000'; s.c = '60'; s.i = '10'; s.s = '300'; s.k = '30000'; } }
  ];
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function presetState(k) { var s = A.defaultState(), p = PRESETS.filter(function (q) { return q.key === k; })[0]; if (p.f) p.f(s); return s; }
  function norm(s) { var d = {}; FIELDS.forEach(function (k) { if (k !== 't') d[k] = String(s[k]); }); return JSON.stringify(d); }
  function presetKey(s) { var j = norm(s); for (var i = 0; i < PRESETS.length; i++) if (norm(presetState(PRESETS[i].key)) === j) return PRESETS[i].key; return null; }

  function str(v, n) { return v == null || typeof v === 'object' ? '' : String(v).slice(0, n); }
  function sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    var d = A.defaultState(), any = false;
    FIELDS.forEach(function (k) { if (k in s) { d[k] = str(s[k], LIM[k]); any = true; } });
    return any ? d : null;
  }
  function load() { try { var t = localStorage.getItem(KEY); if (!t) return null; var j = JSON.parse(t); return sanitize(j && j.state); } catch (e) { return null; } }
  var state = load() || A.defaultState(), out = null, timer = null;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, state: state })); $('saveTag').textContent = '· 已自动存在本机'; } catch (e) { $('saveTag').textContent = '· 这台设备存不了，刷新会丢'; }
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fillAll() { FIELDS.forEach(function (k) { $(k).value = state[k]; }); }

  FIELDS.forEach(function (k) { $(k).addEventListener('input', function () { if (k !== 't') stop(); state[k] = this.value; update(); }); });
  $('presets').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; stop(); state = presetState(b.getAttribute('data-p')); fillAll(); update(); });
  $('acts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || !out || !out.ok) return;
    var a = out.actions.filter(function (x) { return x.id === b.getAttribute('data-act'); })[0]; if (!a) return;
    stop(); Object.keys(a.set).forEach(function (k) { state[k] = a.set[k]; }); fillAll(); update();
  });
  $('grid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cell]'); if (!b || !out || !out.ok) return;
    var j = +b.getAttribute('data-cell'), n = out.P.n;
    var k = Math.max(1, Math.round((j + 1) / 100 * n));
    /* 再点一次已经是边缘的那格 = 退一格 */
    if (k === out.P.k) k = Math.round(j / 100 * n);
    stop(); state.k = String(Math.min(n, k)); fillAll(); update();
  });
  function stop() { if (timer) { clearInterval(timer); timer = null; $('play').textContent = '▶ 一手一手放'; } }
  $('play').addEventListener('click', function () {
    if (timer) { stop(); return; }
    if (!out || !out.ok) return;
    var max = out.series.length - 1;
    state.t = '0'; fillAll(); update();
    $('play').textContent = '❚❚ 停';
    timer = setInterval(function () {
      var t = +state.t + 1;
      if (t > max) { stop(); return; }
      state.t = String(t); $('t').value = state.t; update();
    }, 260);
  });

  function markErrors() {
    document.querySelectorAll('.bad').forEach(function (e) { e.classList.remove('bad'); });
    if (!out.ok) out.errors.forEach(function (er) { var el = $(er.field); if (el) el.classList.add('bad'); });
  }
  function renderPresets() {
    var key = presetKey(state);
    $('presets').innerHTML = PRESETS.map(function (p) { return '<button type="button" class="chip" id="preset_' + p.key + '" data-p="' + p.key + '" aria-pressed="' + (key === p.key) + '">' + esc(p.name) + '</button>'; }).join('');
    var cur = PRESETS.filter(function (p) { return p.key === key; })[0];
    $('presetNote').textContent = cur ? cur.note : '你改过的设定（数字仍然只是你填的假设）。';
  }

  var HOUSE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path class="roof" d="M1 9 L10 2 L19 9 Z"/><rect class="body" x="3.5" y="9" width="13" height="9"/></svg>';
  function renderGrid(o) {
    var on = o.P.k === 0 ? 0 : Math.max(1, Math.round(o.share * 100)), h = '';
    for (var j = 0; j < 100; j++) h += '<button type="button" class="hs' + (j < on ? ' on' : '') + (j === 0 && o.P.k > 0 ? ' me' : '') + '" data-cell="' + j + '" id="cell' + j + '" aria-label="让 ' + (j + 1) + '% 的人家跟着多存">' + HOUSE + '</button>';
    $('grid').innerHTML = h;
    $('gridNote').textContent = '绿色 = 跟着多存的人家：' + A.hh(o.P.k) + ' / ' + A.hh(o.P.n) + ' 户（' + A.pct(o.share) + '）' + (o.P.k > 0 ? '，描边那格是你。' : '。') +
      (o.P.i > 0 && o.level !== 'nobody' ? ' 绿格超过 ' + Math.round(o.breakeven * 100) + ' 格，跟着存的人自己也存不下更多。' : '');
  }

  function lineChart(id, W, H, xs, series, opt) {
    var L = 54, R = 14, T = 22, B = 36, x0 = opt.x0, x1 = opt.x1;
    var all = [0].concat(opt.extra || []); series.forEach(function (s) { s.ys.forEach(function (v) { all.push(v); }); });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all); if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    var pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    var X = function (v) { return L + (W - L - R) * (v - x0) / (x1 - x0 || 1); }, Y = function (v) { return T + (H - T - B) * (hi - v) / (hi - lo); };
    var g = '';
    nice(lo, hi).forEach(function (v) { g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="' + (Math.abs(v) < 1e-9 ? '#9aa39b' : '#e9ece4') + '"/><text x="' + (L - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" fill="#7f8a80" font-size="11" text-anchor="end">' + esc(A.signed(v)) + '</text>'; });
    (opt.ref || []).forEach(function (r) { g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(r.v).toFixed(1) + '" y2="' + Y(r.v).toFixed(1) + '" stroke="#8f9a90" stroke-dasharray="4 3"/><text x="' + (W - R) + '" y="' + (Y(r.v) - 5).toFixed(1) + '" fill="#6d786e" font-size="11" text-anchor="end">' + esc(r.t) + '</text>'; });
    series.forEach(function (s) { g += '<polyline fill="none" stroke="' + s.col + '" stroke-width="2.4" points="' + xs.map(function (x, i) { return X(x).toFixed(1) + ',' + Y(s.ys[i]).toFixed(1); }).join(' ') + '"/>'; });
    (opt.xt || []).forEach(function (t) { g += '<text x="' + X(t.v).toFixed(1) + '" y="' + (H - B + 16) + '" fill="#7f8a80" font-size="11" text-anchor="' + (t.a || 'middle') + '">' + esc(t.t) + '</text>'; });
    if (opt.xl) g += '<text x="' + ((L + W - R) / 2) + '" y="' + (H - 4) + '" fill="#7f8a80" font-size="11" text-anchor="middle">' + esc(opt.xl) + '</text>';
    if (opt.mark) { var mx = X(opt.mark.x), my = Y(opt.mark.y); g += '<line x1="' + mx.toFixed(1) + '" x2="' + mx.toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="#8b4a10" stroke-dasharray="2 3"/><circle cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="5" fill="#8b4a10"/>' +
      (opt.mark.corner ? '<text x="' + (W - R) + '" y="' + (T + 2) + '" fill="#8b4a10" font-size="12.5" font-weight="700" text-anchor="end">● ' + esc(opt.mark.t) + '</text>'
        : '<text x="' + (mx + (mx > W - 150 ? -10 : 10)).toFixed(1) + '" y="' + (my + (my < T + 40 ? 22 : -16)).toFixed(1) + '" fill="#8b4a10" font-size="12.5" font-weight="700" text-anchor="' + (mx > W - 150 ? 'end' : 'start') + '">' + esc(opt.mark.t) + '</text>'); }
    $(id).setAttribute('viewBox', '0 0 ' + W + ' ' + H); $(id).innerHTML = g;
  }
  function nice(lo, hi) {
    var span = hi - lo, step = Math.pow(10, Math.floor(Math.log(span / 4) / Math.LN10)), m = span / 4 / step;
    step *= m > 5 ? 10 : m > 2 ? 5 : m > 1 ? 2 : 1;
    var out = []; for (var v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.abs(v) < step * 1e-6 ? 0 : v);
    return out;
  }
  function boxW(id, def) { var r = $(id).getBoundingClientRect().width; return r > 0 ? Math.max(300, Math.min(def, Math.round(r))) : def; }

  function renderRounds(o) {
    var ser = o.series, xs = ser.map(function (r) { return r.t; }), cur = o.at;
    var W = boxW('chRounds', 520);
    var last = xs.length - 1, step = Math.max(1, Math.ceil(last / (W < 420 ? 5 : 8))), xt = [];
    for (var t = 0; t <= last - step / 2; t += step) xt.push({ v: t, t: String(t), a: t === 0 ? 'start' : 'middle' });
    xt.push({ v: last, t: String(last), a: 'end' });
    lineChart('chRounds', W, 230, xs, [{ ys: ser.map(function (r) { return r.dSaver; }), col: '#2e7d5b' }],
      { x0: 0, x1: xs.length - 1, ref: [{ v: o.P.s, t: '打算多存 ' + A.yuan1(o.P.s) }], extra: [o.P.s], xt: xt, xl: '第几手（钱转一次算一手）', mark: { x: cur.t, y: cur.dSaver, t: A.signed(cur.dSaver) + ' 元' } });
    $('t').max = String(ser.length - 1); $('t').value = String(o.P.t);
    $('tLab').textContent = '第 ' + o.P.t + ' 手 / 共 ' + (ser.length - 1) + ' 手';
    $('now').innerHTML = [['每户月收入', A.yuan1(cur.y)], ['你的存款变化', A.signed(cur.dSaver)], ['全镇储蓄变化', A.signed(cur.dTotal)]].map(function (x) { return '<div><span>' + x[0] + '</span><b class="' + (x[1].length > 9 ? 'lg' : '') + '">' + x[1] + '</b></div>'; }).join('');
    var txt;
    if (cur.t === 0) txt = '第 0 手：还没开始多存，大家照旧。';
    else if (cur.t === 1) txt = '第 1 手：' + (o.P.k === o.P.n ? '大家' : A.hh(o.P.k) + ' 户') + '各少花 ' + A.yuan1(o.P.s) + ' 元，自己的收入还没受影响，所以每户确实多存了 ' + A.yuan1(o.P.s) + ' 元；但镇上别人的收入已经少了。';
    else txt = '第 ' + cur.t + ' 手：上一手收入少了，大家又少花了一点，钱继续少转；你的存款比原来' + (cur.dSaver >= 0 ? '多 ' + A.yuan1(cur.dSaver) : '少 ' + A.yuan1(-cur.dSaver)) + ' 元。' + (cur.t >= o.T ? '离最后的数已经不到 1%。' : '');
    $('nowText').textContent = txt;
  }
  function renderShare(o) {
    var P = o.P, N = 50, xs = [], you = [], tot = [];
    for (var j = 0; j <= N; j++) { var f = j / N, kk = f * P.n, st = A.steady(P.n, P.y, P.c, P.i, P.s, kk); xs.push(f * 100); you.push(kk >= 1 ? st.dSaver : P.s); tot.push(st.dTotal / P.n); }
    var W = boxW('chShare', 460);
    lineChart('chShare', W, 240, xs, [{ ys: you, col: '#2e7d5b' }, { ys: tot, col: '#b23a2b' }],
      { x0: 0, x1: 100, extra: [P.s], xt: [{ v: 0, t: '0%', a: 'start' }, { v: 50, t: '50%' }, { v: 100, t: '100%', a: 'end' }], xl: '跟着多存的人家占多少', mark: { x: o.share * 100, y: o.dSaver, t: '现在：' + A.pct(o.share) + ' 跟着存，你 ' + A.signed(o.dSaver) + ' 元', corner: true } });
    var rows = [['现在的设定', o, true], ['只有你一户', o.alone], ['全镇都跟', o.all], ['投资不跟收入变', o.noInv]];
    $('cmp').innerHTML = '<tr><th>情况</th><th>你的存款</th><th>每户收入</th><th>全镇储蓄</th></tr>' + rows.map(function (r) {
      return '<tr' + (r[2] ? ' class="cur"' : '') + '><td>' + r[0] + '</td><td>' + A.signed(r[1].dSaver) + '</td><td>' + A.signed(r[1].dy) + '</td><td>' + A.signed(r[1].dTotal) + '</td></tr>';
    }).join('');
  }

  function lg(v) { return A.signed(v).length > 9 ? ' lg' : ''; }
  function render() {
    var o = out;
    $('errBox').classList.toggle('hide', o.ok);
    ['okBox', 'townPanel', 'cmpPanel'].forEach(function (id) { $(id).classList.toggle('hide', !o.ok); });
    if (!o.ok) { $('errBox').innerHTML = '先改好标红的地方：<ul>' + o.errors.map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul>'; return; }
    var P = o.P;
    $('tot').innerHTML =
      '<div><span>原本打算每月多存</span><b>' + A.signed(o.level === 'nobody' ? 0 : P.s) + ' 元</b><small>' + (o.level === 'nobody' ? '没有人多存' : '少花的头一手确实存下了') + '</small></div>' +
      '<div class="key"><span>钱转稳定后，你每月实际多存</span><b class="' + (o.dSaver < -0.05 ? 'neg' : '') + lg(o.dSaver) + '">' + A.signed(o.level === 'nobody' ? 0 : o.dSaver) + ' 元</b><small>' + (o.level === 'nobody' ? '' : '每户月收入 ' + A.yuan1(P.y) + ' → ' + A.yuan1(o.y1) + ' 元') + '</small></div>' +
      '<div><span>全镇每月储蓄变化</span><b class="' + (o.dTotal < -0.05 ? 'neg' : '') + lg(o.dTotal) + '">' + A.signed(o.dTotal) + ' 元</b><small>' + (P.i > 0 ? '= 镇上投资的变化' : '投资不变，全镇储蓄也不变') + '</small></div>';
    $('headline').textContent = A.headline(o);
    $('why').textContent = A.explain(o);
    var v = A.verdict(o); $('verdict').classList.toggle('hide', !v); $('verdict').textContent = v;
    $('acts').innerHTML = o.actions.map(function (a) { return '<button type="button" class="act" id="' + a.id + '" data-act="' + a.id + '">→ ' + esc(a.text) + '</button>'; }).join('');
    renderGrid(o); renderRounds(o); renderShare(o);
  }
  var rsz = null; window.addEventListener('resize', function () { clearTimeout(rsz); rsz = setTimeout(function () { if (out && out.ok) { renderRounds(out); renderShare(out); } }, 120); });
  function update() { out = A.compute(state); markErrors(); renderPresets(); render(); save(); }

  function stamp() { var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function tag() { return out.ok ? '你实际' + (out.level === 'nobody' ? '不变' : A.signed(out.dSaver) + '元') : '待改'; }
  $('dlCsv').addEventListener('click', function () { if (out.ok) download('一起多存一百-逐手明细.csv', new Blob(['\ufeff' + A.toCSV(out, stamp())], { type: 'text/csv;charset=utf-8' })); });
  $('dlMd').addEventListener('click', function () { if (out.ok) download('一起多存一百-' + tag() + '.md', new Blob([A.toMD(out, stamp())], { type: 'text/markdown;charset=utf-8' })); });
  $('dlJson').addEventListener('click', function () { download('一起多存一百-备份.json', new Blob([JSON.stringify({ app: '一起多存一百', slug: 'everyone-saves', version: 1, exported_at: stamp(), state: state }, null, 2)], { type: 'application/json' })); });
  $('impJson').addEventListener('click', function () { $('impFile').click(); });
  $('impFile').addEventListener('change', function () { var f = this.files && this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { importText(String(rd.result)); }; rd.readAsText(f); this.value = ''; });
  function importText(t) {
    var s = null;
    try { var j = JSON.parse(t); s = sanitize(j && j.state ? j.state : j); } catch (e) { s = null; }
    if (!s) { $('saveTag').textContent = '· 这个文件读不出来，没改动'; return false; }
    stop(); state = s; fillAll(); update(); return true;
  }
  $('reset').addEventListener('click', function () { stop(); state = A.defaultState(); fillAll(); update(); });

  /* 结果卡 PNG 1080×1350：文字取自同一次 out */
  function drawCard() {
    var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), FF = '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    g.fillStyle = '#f2f4ef'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff'; g.fillRect(50, 50, W - 100, H - 100);
    var L = 110, Rr = W - 110, maxW = Rr - L, y = 150;
    function font(size, bold) { g.font = (bold ? '700 ' : '') + size + 'px ' + FF; }
    function clip(t, w) { t = String(t); if (g.measureText(t).width <= w) return t; while (t.length > 1 && g.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }
    function wrap(t, size, color, bold, lim) {
      font(size, bold); g.fillStyle = color; var cur = '', n = 0;
      var toks = String(t).match(/[−+]?[0-9.,%]+ ?(?:元|户|手)?[）)。，、；：]?|[（(「]?[A-Za-z]+[）)」。，、；：]?|[（(「]?[^\s（(「][）)」。，、；：]?|\s/g) || [];
      for (var i = 0; i < toks.length; i++) { var ch = toks[i]; if (g.measureText(cur + ch).width > maxW && cur) { if (lim && ++n >= lim) { g.fillText(clip(cur + '…', maxW), L, y); y += size * 1.5; return; } g.fillText(cur, L, y); y += size * 1.5; cur = ch.trim() ? ch : ''; } else cur += ch; }
      if (cur) { g.fillText(cur, L, y); y += size * 1.5; }
    }
    font(56, true); g.fillStyle = '#1f2620'; g.fillText('一起多存一百', L, y); y += 56;
    if (!out.ok) { font(44, true); g.fillStyle = '#b23a2b'; g.fillText('还算不了', L, y + 20); y += 90; out.errors.slice(0, 6).forEach(function (e) { wrap('· ' + e.message, 28, '#4e5a50', false, 3); y += 8; }); y += 30; wrap('改好标红的地方，结果会自动重算。', 26, '#7f8a80'); y += 40; wrap('这张卡算的是：小镇里很多人家一起每月多存一点，钱少转一圈、收入跟着缩，最后你自己实际多存了多少（凯恩斯的节俭悖论）。', 26, '#7f8a80'); return cv; }
    var o = out, P = o.P;
    font(26); g.fillStyle = '#7f8a80'; g.fillText(clip((P.place || '镇上') + ' · ' + P.k.toLocaleString('en-US') + ' / ' + P.n.toLocaleString('en-US') + ' 户每月多存 ' + A.yuan1(P.s) + ' 元', maxW), L, y); y += 56;
    wrap(A.headline(o), 38, '#8b4a10', true, 3); y += 14;
    var bw = (maxW - 40) / 3, none = o.level === 'nobody';
    var items = [['打算多存', A.signed(none ? 0 : P.s) + ' 元', '#1f2620'], ['实际多存', A.signed(none ? 0 : o.dSaver) + ' 元', o.dSaver < -0.05 ? '#b23a2b' : '#8b4a10'], ['全镇储蓄', A.signed(o.dTotal) + ' 元', o.dTotal < -0.05 ? '#b23a2b' : '#1f2620']];
    items.forEach(function (it, i) { var x0 = L + i * (bw + 20); g.fillStyle = i === 1 ? '#fff4d8' : '#f7f8f4'; g.fillRect(x0, y, bw, 120); font(22); g.fillStyle = '#7f8a80'; g.fillText(it[0], x0 + 18, y + 40); var fs = 44; font(fs, true); while (fs > 20 && g.measureText(it[1]).width > bw - 30) { fs -= 2; font(fs, true); } g.fillStyle = it[2]; g.fillText(it[1], x0 + 18, y + 98); });
    y += 170;
    /* 逐手曲线（与页面同一份 o.series） */
    var ser = o.series, cy0 = y, ch = 300, vals = ser.map(function (r) { return r.dSaver; }).concat([0, P.s]);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals); if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    var pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    var X = function (t) { return L + 70 + (maxW - 70) * t / (ser.length - 1); }, Y = function (v) { return cy0 + 70 + (ch - 110) * (hi - v) / (hi - lo); };
    font(24, true); g.fillStyle = '#4e5a50'; g.fillText('一手一手传下去，你每月的存款比原来多多少', L, cy0 + 4);
    g.strokeStyle = '#9aa39b'; g.lineWidth = 2; g.beginPath(); g.moveTo(L + 70, Y(0)); g.lineTo(Rr, Y(0)); g.stroke();
    g.setLineDash([8, 6]); g.strokeStyle = '#8f9a90'; g.beginPath(); g.moveTo(L + 70, Y(P.s)); g.lineTo(Rr, Y(P.s)); g.stroke(); g.setLineDash([]);
    font(20); g.fillStyle = '#7f8a80'; g.textAlign = 'right'; g.fillText('0', L + 60, Y(0) + 7); g.fillText(A.signed(P.s), L + 60, Y(P.s) + 7); g.textAlign = 'left';
    g.strokeStyle = '#2e7d5b'; g.lineWidth = 5; g.beginPath(); ser.forEach(function (r, i) { if (i) g.lineTo(X(r.t), Y(r.dSaver)); else g.moveTo(X(r.t), Y(r.dSaver)); }); g.stroke();
    var last = ser[ser.length - 1]; g.fillStyle = '#8b4a10'; g.beginPath(); g.arc(X(last.t), Y(last.dSaver), 9, 0, 7); g.fill();
    font(22, true); g.textAlign = 'right'; g.fillText('● 第 ' + last.t + ' 手：' + A.signed(last.dSaver) + ' 元（最后 ' + A.signed(o.dSaver) + '）', Rr, cy0 + 40); g.textAlign = 'left';
    font(20); g.fillStyle = '#7f8a80'; g.fillText('第 0 手', L + 70, cy0 + ch + 6); g.textAlign = 'right'; g.fillText('第 ' + last.t + ' 手', Rr, cy0 + ch + 6); g.textAlign = 'left';
    y = cy0 + ch + 60;
    var v = A.verdict(o); if (v) { wrap(v, 28, '#235c43', true, 3); y += 10; }
    if (o.actions[0]) wrap('对照：' + o.actions[0].text + '。', 26, '#4e5a50', false, 2);
    y = H - 150;
    wrap('教科书里最简单的收入—支出模型，「一手」是钱转一次，不是一个月；没算利率、物价、政府和外地。默认小镇和数字为虚构示例。', 20, '#7f8a80', false, 2);
    return cv;
  }
  $('dlPng').addEventListener('click', function () { drawCard().toBlob(function (b) { if (b) download('一起多存一百-' + tag() + '-1080x1350.png', b); }, 'image/png'); });

  window.__enUi = { state: function () { return clone(state); }, out: function () { return out; }, importText: importText, drawCard: drawCard, storageKey: KEY };
  fillAll(); update();
})();
