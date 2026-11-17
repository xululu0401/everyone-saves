/* 一起多存一百 · 计算核心（core.js）
 * 问题：一个人每月多存 100 元，自己就多了 100 元存款；镇上很多户都这么做，你花出去的钱是别人的收入，
 *       别人少收入又少花……钱一轮轮少转，大家的收入跟着缩，最后存下的可能比想的少，甚至更少。
 *       这就是凯恩斯说的「节俭悖论」。这里用最简单的教科书模型把它一轮一轮算给你看。
 * 模型（设计选择，页面「怎么算的」里写明，不是对任何真实城镇的预测）：
 *   - 小镇 n 户，起初每户每月收入 y0，处在稳定状态（每轮收入不变）。
 *   - 每户每多收入 1 元，在镇上多花 c 元（边际消费倾向，花在镇外或存起来的都算漏出去）；
 *     镇上的店和厂每多 1 元收入，多投资 i 元（i = 0 表示投资不跟着收入变）。c + i 必须小于 1。
 *   - 有 k 户决定每月少花 s 元、多存 s 元。花出去的钱就是镇上别人的收入。
 *   - 一轮（页面叫「一手」）= 钱转一手（不是一个月）：第 t 轮全镇收入 Y_t = A − k·s + (c + i)·Y_{t−1}，A 使起初稳定。
 *     第 t 轮的储蓄 = 上一轮收到的钱 − 这一轮花掉的钱。
 *   - 稳定后：全镇收入少 k·s / (1 − c − i)；全镇储蓄变化 = −k·s·i / (1 − c − i)。
 *     i = 0 时全镇储蓄一分没多（悖论的原始版本）；i > 0 时全镇储蓄反而变少。
 * 精确性：闭式与逐轮递推两条路径互相核对；独立 Python Fraction 参考实现对拍（tests/ref.py）。 */
(function (root) {
  'use strict';
  var MAX_N = 1000000, MAX_Y = 1000000, MAX_ROUNDS = 1000, TOL = 0.01, EPS = 1e-9;

  function defaultState() {
    return { place: '一个 1000 户的小镇', n: '1000', y: '8000', c: '75', i: '5', s: '100', k: '1000', t: '1' };
  }

  function half(s) { return String(s == null ? '' : s).replace(/[\uFF01-\uFF5E]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); }).replace(/\u3000/g, ' ').replace(/[,，\s]/g, ''); }
  function num(s) { s = half(s).replace(/。/g, '.'); if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s); return NaN; }
  function isInt(x) { return isFinite(x) && Math.floor(x) === x; }

  function parse(st) {
    var errs = [], P = { place: String(st.place == null ? '' : st.place).trim().slice(0, 30) };
    function need(f, lo, hi, intOnly, msg) {
      var v = num(st[f]);
      if (!isFinite(v)) { errs.push({ field: f, message: msg + '：要填数字' }); return NaN; }
      if (intOnly && !isInt(v)) { errs.push({ field: f, message: msg + '：要填整数' }); return NaN; }
      if (v < lo || v > hi) { errs.push({ field: f, message: msg + '：要在 ' + lo + '–' + hi + ' 之间' }); return NaN; }
      return v;
    }
    P.n = need('n', 2, MAX_N, true, '镇上有几户');
    P.y = need('y', 100, MAX_Y, false, '每户每月收入');
    P.cp = need('c', 0, 99, false, '每多收入 100 元在镇上花掉几元');
    P.ip = need('i', 0, 50, false, '每多收入 100 元镇上多投资几元');
    P.s = need('s', 0, MAX_Y, false, '每户每月多存几元');
    P.k = need('k', 0, MAX_N, true, '几户跟着多存');
    P.t = num(st.t); if (!isInt(P.t) || P.t < 0) P.t = 1;
    if (isFinite(P.cp) && isFinite(P.ip) && P.cp + P.ip > 99 + EPS) {
      errs.push({ field: 'i', message: '花掉的加上投资的（' + fmt(P.cp + P.ip) + '）要小于等于 99：钱转一圈几乎不漏出去，收入会无限放大，算不出稳定的数' });
    }
    if (isFinite(P.k) && isFinite(P.n) && P.k > P.n) errs.push({ field: 'k', message: '跟着多存的户数（' + P.k + '）不能比全镇户数（' + P.n + '）还多' });
    if (!errs.length) {
      P.c = P.cp / 100; P.i = P.ip / 100;
      var gap = P.k * P.s / (1 - P.c - P.i) / P.n;
      if (gap >= P.y - EPS) errs.push({ field: 's', message: '多存得太多：照这个模型，每户收入会缩到 ' + yuan(P.y - gap) + ' 元（不到 0），模型不适用' });
    }
    return { P: P, errors: errs };
  }

  /* 稳定后的结果（闭式） */
  function steady(n, y, c, i, s, k) {
    var L = 1 - c - i, dY = -k * s / L, dy = dY / n;
    return {
      mult: 1 / L,
      dy: dy, y1: y + dy,
      dSaver: k > 0 ? s + (1 - c) * dy : 0,  /* 跟着多存的那户，每月存款变化（没人跟时记 0） */
      dOther: (1 - c) * dy,              /* 没跟的那户 */
      dTotal: k * s + n * (1 - c) * dy,  /* 全镇每月储蓄变化 = −k·s·i/L */
      dTotalClosed: -k * s * i / L,
      dInvest: i * dY
    };
  }
  /* 跟着多存的人，自己存款还能 ≥ f·s 的最多户数比例：s(1 − (1−c)·k/(n·L)) ≥ f·s → k/n ≤ (1−f)·L/(1−c) */
  function shareFor(f, c, i) { return c >= 1 ? 1 : Math.min(1, (1 - f) * (1 - c - i) / (1 - c)); }
  /* 离稳定只差 1% 以内要几轮：(c+i)^t ≤ 1% 的最小 t */
  function roundsTo(r) { if (r <= 0) return 1; var t = 0, g = 1; while (g > TOL + EPS && t < MAX_ROUNDS) { g *= r; t++; } return t; }

  /* 逐轮递推（与闭式独立的第二条路径） */
  function rounds(n, y, c, i, s, k, T) {
    var Y0 = n * y, A = Y0 * (1 - c - i), Yp = Y0, out = [{ t: 0, y: y, dSaver: 0, dOther: 0, dTotal: 0 }];
    for (var t = 1; t <= T; t++) {
      var Y = A - k * s + (c + i) * Yp, d = (Yp - Y0) / n;
      /* 本轮储蓄 = 上一轮收入 − 本轮花掉：跟着存的人多存 s，加上收入变动没花掉的那部分 */
      out.push({ t: t, y: Y / n, dSaver: k > 0 ? s + (1 - c) * d : 0, dOther: (1 - c) * d, dTotal: k * s + (1 - c) * (Yp - Y0) });
      Yp = Y;
    }
    return out;
  }

  function compute(st) {
    var pr = parse(st), P = pr.P, o = { ok: !pr.errors.length, errors: pr.errors, P: P };
    if (!o.ok) return o;
    var n = P.n, y = P.y, c = P.c, i = P.i, s = P.s, k = P.k;
    var S = steady(n, y, c, i, s, k);
    Object.keys(S).forEach(function (x) { o[x] = S[x]; });
    o.r = c + i;
    o.T = roundsTo(o.r);
    o.series = rounds(n, y, c, i, s, k, Math.max(o.T, 12));
    o.first = o.series[1];
    P.t = Math.min(P.t, o.series.length - 1);
    o.at = o.series[P.t];
    /* 对照：只有我一个人、全镇都跟、投资不跟收入变 */
    o.alone = steady(n, y, c, i, s, 1);
    o.all = steady(n, y, c, i, s, n);
    o.noInv = steady(n, y, c, 0, s, k);
    o.breakeven = shareFor(0, c, i);           /* 超过这个比例，跟着存的人自己也没多存 */
    o.halfShare = shareFor(0.5, c, i);         /* 不超过这个比例，跟着存的人还能多存一半以上 */
    o.kHalf = Math.floor(o.halfShare * n + EPS);
    o.kZero = Math.floor(o.breakeven * n + EPS);
    o.share = k / n;
    o.level = (k === 0 || s === 0) ? 'nobody' : (S.dSaver < -0.05 ? 'worse' : (S.dSaver < 0.05 ? 'zero' : (S.dSaver < s / 2 - EPS ? 'shrink' : 'fine')));
    /* 改法（都直接改输入重算） */
    var acts = [];
    if (o.level !== 'nobody') {
      if (k > 1) acts.push({ id: 'actAlone', set: { k: '1' }, text: '只有你一户多存：你每月多存 ' + yuan1(o.alone.dSaver) + ' 元' });
      if (o.kHalf >= 1 && k > o.kHalf) acts.push({ id: 'actHalf', set: { k: String(o.kHalf) }, text: '只有 ' + hh(o.kHalf) + ' 户（' + pct(o.kHalf / n) + '）跟着多存：存的人每户还能多存 ' + yuan1(steady(n, y, c, i, s, o.kHalf).dSaver) + ' 元' });
      if (i > 0) acts.push({ id: 'actNoInv', set: { i: '0' }, text: '如果镇上投资不跟着收入变：全镇储蓄 ' + signed(o.noInv.dTotal) + ' 元，你 ' + signed(o.noInv.dSaver) + ' 元' });
      if (k < n) acts.push({ id: 'actAll', set: { k: String(n) }, text: '全镇 ' + hh(n) + ' 户都跟着多存：你每月存款 ' + signed(o.all.dSaver) + ' 元' });
    }
    o.actions = acts;
    return o;
  }

  function fmt(x) { var v = Math.round(x * 100) / 100; return String(v); }
  function yuan(x) { var v = Math.round(Math.abs(x) < 5e-7 ? 0 : x); return (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('en-US'); }
  function yuan1(x) { var v = Math.abs(x) >= 1000 ? Math.round(x) : Math.round(x * 10) / 10; var a = Math.abs(v), t = (a % 1 ? a.toFixed(1) : String(a)).replace(/^(\d+)/, function (m) { return Number(m).toLocaleString('en-US'); }); return (v < 0 ? '−' : '') + t; }
  function signed(x) { var t = yuan1(x); return t === '0' ? '0' : (t.charAt(0) === '−' ? t : '+' + t); }
  function pct(x) { var v = Math.round(x * 1000) / 10; return (v % 1 ? v.toFixed(1) : String(v)) + '%'; }

  function hh(x) { return Number(x).toLocaleString('en-US'); }
  function who(P) { return P.place || '镇上'; }
  function headline(o) {
    var P = o.P;
    if (o.level === 'nobody') return P.k === 0 ? '没有人多存：收入和存款都不变。' : '每户多存 0 元：收入和存款都不变。';
    var st = '钱转 ' + o.T + ' 手后基本稳定：每户月收入少 ' + yuan1(-o.dy) + ' 元，', who2 = P.k === P.n ? '大家' : hh(P.k) + ' 户';
    if (o.level === 'worse') return who2 + '一起每月多存 ' + yuan1(P.s) + ' 元，' + st + '你反而比原来少存 ' + yuan1(-o.dSaver) + ' 元。';
    if (o.level === 'zero') return who2 + '一起每月多存 ' + yuan1(P.s) + ' 元，' + st + '你一分也没多存下。';
    if (o.level === 'shrink') return who2 + '一起每月多存 ' + yuan1(P.s) + ' 元，' + st + '你只多存了 ' + yuan1(o.dSaver) + ' 元。';
    return (P.k === 1 ? '只有你一户' : hh(P.k) + ' 户') + '每月多存 ' + yuan1(P.s) + ' 元，' + st + '你多存了 ' + yuan1(o.dSaver) + ' 元。';
  }
  function explain(o) {
    var P = o.P;
    if (o.level === 'nobody') return '';
    return '每户每多收入 100 元在镇上花 ' + fmt(P.cp) + ' 元、镇上多投资 ' + fmt(P.ip) + ' 元，所以钱每转一手还剩 ' + fmt(P.cp + P.ip) + '%，少花的 1 元最后让全镇收入少 ' + fmt(o.mult) + ' 元。' +
      hh(P.k) + ' 户每户少花 ' + yuan1(P.s) + ' 元，全镇每月少花 ' + yuan(P.k * P.s) + ' 元，稳定后全镇月收入少 ' + yuan(-o.dy * P.n) + ' 元、每户少 ' + yuan1(-o.dy) + ' 元。' +
      '少花的头一手，你的收入还没受影响，确实多存了 ' + yuan1(o.first.dSaver) + ' 元；之后收入一轮轮缩，没花掉的那部分也跟着少，稳定后你存款变化 ' + signed(o.dSaver) + ' 元，' +
      (P.k < P.n ? '没跟着存的人变化 ' + signed(o.dOther) + ' 元，' : '') + '全镇储蓄变化 ' + signed(o.dTotal) + ' 元。';
  }
  function verdict(o) {
    var P = o.P;
    if (o.level === 'nobody') return '';
    if (P.i === 0) return '投资不跟着收入变时，不管多少户一起存，全镇存下的钱都一分没多：多存的被少收入抵掉了。';
    return '超过 ' + pct(o.breakeven) + ' 的人家（' + hh(o.kZero) + ' 户）一起多存，跟着存的人自己也存不下更多；不超过 ' + pct(o.halfShare) + '（' + hh(o.kHalf) + ' 户），还能多存一半以上。';
  }

  function csvCell(x) { x = String(x); return /[",\n\r]/.test(x) || /^[=+\-@]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }
  function toCSV(o, stamp) {
    if (!o.ok) return '';
    var P = o.P, L = [];
    L.push(['一起多存一百', who(P), '导出 ' + stamp].map(csvCell).join(','));
    L.push(['户数', P.n, '每户月收入', P.y, '在镇上花（每100元）', P.cp, '多投资（每100元）', P.ip, '每户多存', P.s, '跟着多存户数', P.k].map(csvCell).join(','));
    L.push(['稳定后每户月收入', o.y1.toFixed(2), '你的存款变化', o.dSaver.toFixed(2), '没跟的人存款变化', o.dOther.toFixed(2), '全镇储蓄变化', o.dTotal.toFixed(2), '几轮稳定', o.T].map(csvCell).join(','));
    L.push('');
    L.push(['第几手', '每户月收入', '跟着存的人存款变化', '没跟的人存款变化', '全镇储蓄变化'].map(csvCell).join(','));
    o.series.forEach(function (r) { L.push([r.t, r.y.toFixed(2), r.dSaver.toFixed(2), r.dOther.toFixed(2), r.dTotal.toFixed(2)].map(csvCell).join(',')); });
    return L.join('\n') + '\n';
  }
  function mdCell(x) { return String(x).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' '); }
  function toMD(o, stamp) {
    if (!o.ok) return '';
    var P = o.P, L = ['# 一起多存一百：' + mdCell(who(P)), '', '导出时间：' + stamp, ''];
    L.push(hh(P.n) + ' 户，每户月收入 ' + yuan(P.y) + ' 元；每多收入 100 元在镇上花 ' + fmt(P.cp) + ' 元、镇上多投资 ' + fmt(P.ip) + ' 元；' + hh(P.k) + ' 户每月多存 ' + yuan1(P.s) + ' 元。', '');
    L.push('**' + headline(o) + '**', '');
    if (explain(o)) L.push(explain(o), '');
    if (verdict(o)) L.push(verdict(o), '');
    L.push('| 情况 | 你每月存款变化 | 每户月收入变化 | 全镇储蓄变化 |', '|---|---|---|---|');
    [['现在的设定', o], ['只有你一户', o.alone], ['全镇都跟', o.all], ['投资不跟收入变', o.noInv]].forEach(function (r) { L.push('| ' + r[0] + ' | ' + signed(r[1].dSaver) + ' | ' + signed(r[1].dy) + ' | ' + signed(r[1].dTotal) + ' |'); });
    L.push('', '| 第几手 | 每户月收入 | 跟着存的人存款变化 | 全镇储蓄变化 |', '|---|---|---|---|');
    o.series.slice(0, 13).forEach(function (r) { L.push('| ' + r.t + ' | ' + yuan1(r.y) + ' | ' + signed(r.dSaver) + ' | ' + signed(r.dTotal) + ' |'); });
    L.push('', '_教科书里最简单的收入—支出模型：「一手」是钱转一次，不是一个月；没算利率、物价、政府、外地收入。默认小镇和数字是虚构示例，不是对真实经济的预测。_');
    return L.join('\n') + '\n';
  }

  var api = { MAX_N: MAX_N, MAX_ROUNDS: MAX_ROUNDS, defaultState: defaultState, num: num, parse: parse, steady: steady, shareFor: shareFor, roundsTo: roundsTo, rounds: rounds, compute: compute,
    fmt: fmt, hh: hh, yuan: yuan, yuan1: yuan1, signed: signed, pct: pct, headline: headline, explain: explain, verdict: verdict, toCSV: toCSV, toMD: toMD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AppCore = api;
})(typeof window !== 'undefined' ? window : this);
