/* 一起多存一百 · 核心测试：node --test tests/core.test.cjs
 * 锚点：tests/ref.json（独立 Python Fraction：解线性方程 + 会计恒等式逐手模拟，300 组）、默认场景手算、常识性质。 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const A = require(path.join(__dirname, '..', 'core.js'));
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'ref.json'), 'utf8'));
const S = (o) => Object.assign(A.defaultState(), o || {});
const close = (x, y, tol, msg) => assert.ok(Math.abs(x - y) <= tol, msg + '：' + x + ' vs ' + y);

test('默认场景：手算读数', () => {
  const o = A.compute(A.defaultState());
  assert.ok(o.ok, JSON.stringify(o.errors));
  /* 1000 户 × 8000；c = 0.75、i = 0.05 → 漏出 0.2，乘数 5；1000 户各少花 100 → 全镇少 100,000 × 5 = 500,000，每户 −500 */
  close(o.mult, 5, 1e-9, '乘数'); close(o.dy, -500, 1e-6, '每户收入'); close(o.y1, 7500, 1e-6, '稳定收入');
  /* 跟着存的人：+100 + 0.25 × (−500) = −25；全镇 = 1000 × (−25) = −25,000 = −k·s·i/L = −100000×0.05/0.2 */
  close(o.dSaver, -25, 1e-6, '你的存款'); close(o.dTotal, -25000, 1e-4, '全镇'); close(o.dTotalClosed, -25000, 1e-4, '闭式');
  close(o.dInvest, -25000, 1e-4, '储蓄 = 投资变化');
  /* 0.8^t ≤ 1%：0.8^20 = 0.01153 > 0.01，0.8^21 = 0.00922 → 21 */
  assert.equal(o.T, 21);
  /* 平衡比例 = L/(1−c) = 0.2/0.25 = 80%；一半 = 0.5 × 0.8 = 40% */
  close(o.breakeven, 0.8, 1e-12, '平衡'); close(o.halfShare, 0.4, 1e-12, '一半'); assert.equal(o.kZero, 800); assert.equal(o.kHalf, 400);
  assert.equal(o.level, 'worse');
  assert.equal(A.headline(o), '大家一起每月多存 100 元，钱转 21 手后基本稳定：每户月收入少 500 元，你反而比原来少存 25 元。');
  assert.deepEqual(o.actions.map((x) => x.id), ['actAlone', 'actHalf', 'actNoInv']);
  assert.ok(o.actions[0].text.indexOf('99.9 元') > 0, o.actions[0].text);
  assert.ok(o.actions[1].text.indexOf('400 户（40%）') > 0 && o.actions[1].text.indexOf('50 元') > 0, o.actions[1].text);
  assert.ok(o.actions[2].text.indexOf('全镇储蓄 0 元，你 0 元') > 0, o.actions[2].text);
  /* 逐手：第 1 手 +100、收入 7900；第 2 手 7820、+75；第 3 手 7756、+55 */
  assert.deepEqual(o.series.slice(1, 4).map((r) => [Math.round(r.y * 1e6) / 1e6, Math.round(r.dSaver * 1e6) / 1e6]), [[7900, 100], [7820, 75], [7756, 55]]);
});

test('与独立 Python Fraction 参考实现逐组对拍（300 组）', () => {
  assert.equal(REF.length, 300);
  let worse = 0;
  for (const r of REF) {
    const o = A.compute(S({ n: String(r.n), y: String(r.y), c: String(r.c), i: String(r.i), s: String(r.s), k: String(r.k) }));
    assert.ok(o.ok, JSON.stringify(r) + JSON.stringify(o.errors));
    const tol = (x) => 1e-7 * Math.max(1, Math.abs(x));
    close(o.dy, r.dy, tol(r.dy), 'dy'); close(o.dSaver, r.dSaver, tol(r.dSaver), 'dSaver'); close(o.dOther, r.dOther, tol(r.dOther), 'dOther');
    close(o.dTotal, r.dTotal, tol(r.dTotal) * 10, 'dTotal'); assert.equal(o.T, r.T, 'T ' + JSON.stringify(r));
    const ser = A.rounds(r.n, r.y, r.c / 100, r.i / 100, r.s, r.k, 30);
    r.rounds.forEach((row, j) => { close(ser[j + 1].y, row[0], tol(row[0]), '逐手收入'); close(ser[j + 1].dSaver, row[1], tol(row[1]), '逐手存款'); close(ser[j + 1].dTotal, row[2], tol(row[2]) * 10, '逐手全镇'); });
    if (o.dSaver < 0) worse++;
  }
  assert.ok(worse > 20 && worse < 280, '样本里「反而少存」与「还能多存」都有：' + worse);
});

test('逐手递推收敛到闭式（两条独立路径）', () => {
  for (const [c, i] of [[75, 5], [50, 0], [90, 5], [0, 0], [30, 20]]) {
    const o = A.compute(S({ c: String(c), i: String(i) }));
    const last = A.rounds(1000, 8000, c / 100, i / 100, 100, 1000, 3000).pop();
    close(last.y, o.y1, 1e-6, 'c=' + c + ' 收入'); close(last.dSaver, o.dSaver, 1e-6, '存款'); close(last.dTotal, o.dTotal, 1e-3, '全镇');
    /* 第 T 手离稳定 ≤ 1%，第 T−1 手 > 1% */
    const ser = A.rounds(1000, 8000, c / 100, i / 100, 100, 1000, o.T);
    const gap = (t) => Math.abs(ser[t].y - o.y1) / Math.abs(8000 - o.y1);
    assert.ok(gap(o.T) <= 0.01 + 1e-9, 'T 手内到位');
    if (o.T > 1) assert.ok(gap(o.T - 1) > 0.01, 'T−1 手还没到');
  }
});

test('节俭悖论的三条性质', () => {
  /* i = 0：不管多少户、多存多少，全镇储蓄变化恒为 0 */
  for (const k of [1, 37, 500, 1000]) for (const s of [10, 100, 999]) close(A.compute(S({ i: '0', k: String(k), s: String(s) })).dTotal, 0, 1e-6, 'i=0');
  /* i > 0：全镇储蓄变化 < 0，且户数越多越少（单调） */
  let prev = 1;
  for (let k = 1; k <= 1000; k += 111) { const t = A.compute(S({ k: String(k) })).dTotal; assert.ok(t < 0 && t < prev, 'k=' + k); prev = t; }
  /* 只有一户时自己几乎多存 s；跟着的人存款随 k 线性下降，在 kZero 附近过零 */
  const one = A.compute(S({ k: '1' })); close(one.dSaver, 100 - 0.25 * 0.5, 1e-9, '一户');
  assert.ok(A.compute(S({ k: '800' })).dSaver >= -1e-9 && A.compute(S({ k: '801' })).dSaver < 0, '过零在 800/801');
  assert.ok(A.compute(S({ k: '400' })).dSaver >= 50 - 1e-9 && A.compute(S({ k: '401' })).dSaver < 50, '一半在 400/401');
});

test('会计恒等式：全镇储蓄变化 = 投资变化；收入变化 = 消费变化 + 投资变化', () => {
  for (const r of REF.slice(0, 120)) {
    const o = A.compute(S({ n: String(r.n), y: String(r.y), c: String(r.c), i: String(r.i), s: String(r.s), k: String(r.k) }));
    close(o.dTotal, o.dInvest, 1e-6 * Math.max(1, Math.abs(o.dInvest)), '储蓄=投资');
    const dY = o.dy * r.n, dC = (r.c / 100) * dY - r.k * r.s;
    close(dY, dC + o.dInvest, 1e-6 * Math.max(1, Math.abs(dY)), 'Y=C+I');
  }
});

test('等级与结论句：worse / zero / shrink / fine / nobody', () => {
  assert.equal(A.compute(S({ i: '0' })).level, 'zero');
  assert.equal(A.headline(A.compute(S({ i: '0' }))), '大家一起每月多存 100 元，钱转 17 手后基本稳定：每户月收入少 400 元，你一分也没多存下。');
  assert.equal(A.compute(S({ k: '600' })).level, 'shrink');
  assert.equal(A.compute(S({ k: '400' })).level, 'fine');
  assert.equal(A.compute(S({ k: '1' })).level, 'fine');
  assert.equal(A.headline(A.compute(S({ k: '1' }))), '只有你一户每月多存 100 元，钱转 21 手后基本稳定：每户月收入少 0.5 元，你多存了 99.9 元。');
  const z = A.compute(S({ k: '0' })); assert.equal(z.level, 'nobody'); assert.equal(z.actions.length, 0); assert.equal(A.headline(z), '没有人多存：收入和存款都不变。');
  assert.equal(A.headline(A.compute(S({ s: '0' }))), '每户多存 0 元：收入和存款都不变。');
  /* i = 0 时 verdict 换口径；改法里没有「投资不跟」 */
  const o0 = A.compute(S({ i: '0' }));
  assert.ok(A.verdict(o0).indexOf('一分没多') > 0); assert.ok(!o0.actions.some((a) => a.id === 'actNoInv'));
  /* 不是全镇都跟时给「全镇都跟」按钮 */
  const k5 = A.compute(S({ k: '500' })); assert.ok(k5.actions.some((a) => a.id === 'actAll' && a.set.k === '1000'));
  assert.ok(!A.compute(S({ k: '1' })).actions.some((a) => a.id === 'actAlone'));
});

test('阈值两侧：c + i 恰好 99 可算，99.5 报错；k = n 可、k = n + 1 报错', () => {
  assert.ok(A.compute(S({ c: '94', i: '5', s: '10' })).ok);
  const bad = A.compute(S({ c: '94.5', i: '5' })); assert.ok(!bad.ok); assert.equal(bad.errors[0].field, 'i');
  assert.ok(A.compute(S({ k: '1000' })).ok);
  const kb = A.compute(S({ k: '1001' })); assert.ok(!kb.ok); assert.equal(kb.errors[0].field, 'k');
  /* c + i = 99 时乘数 100、几百手才稳定，roundsTo 不超过上限 */
  const o = A.compute(S({ c: '94', i: '5', s: '10', k: '10' })); close(o.mult, 100, 1e-9, '乘数 100'); assert.equal(o.T, Math.ceil(Math.log(0.01) / Math.log(0.99) - 1e-12));
  assert.ok(o.series.length - 1 === o.T);
});

test('收入缩到 0 以下：报错（边界两侧）', () => {
  /* 缩量 = k·s/L/n；L = 0.2、n = 1000、k = 1000 → s ≥ 1600 时每户收入 ≤ 0 */
  assert.ok(A.compute(S({ s: '1599' })).ok);
  const b = A.compute(S({ s: '1600' })); assert.ok(!b.ok); assert.equal(b.errors[0].field, 's'); assert.ok(b.errors[0].message.indexOf('0 元') > 0, b.errors[0].message);
});

test('非法输入：空、非数字、小数户数、负数、越界，一次列全', () => {
  const o = A.compute(S({ n: '1.5', y: '', c: 'abc', i: '-1', s: '-5', k: 'x' }));
  assert.ok(!o.ok);
  assert.deepEqual(o.errors.map((e) => e.field).sort(), ['c', 'i', 'k', 'n', 's', 'y']);
  assert.ok(!A.compute(S({ n: '1' })).ok, '至少 2 户');
  assert.ok(!A.compute(S({ c: '100' })).ok);
  assert.ok(!A.compute(S({ i: '51' })).ok);
  assert.ok(!A.compute(S({ y: '99' })).ok);
});

test('单位与写法：全角、千分位、空格都认；户数放大 10 倍、比例不变时每户读数不变', () => {
  const a = A.compute(S({ n: '１０００', y: '8,000', s: ' 100 ' }));
  assert.ok(a.ok); close(a.dSaver, -25, 1e-9, '全角');
  const b = A.compute(S({ n: '10000', k: '10000' })); close(b.dy, -500, 1e-6, '规模不变'); close(b.dSaver, -25, 1e-6, '规模不变 2'); close(b.dTotal, -250000, 1e-3, '全镇按户数放大');
  /* 收入只影响水平，不影响变化量 */
  close(A.compute(S({ y: '20000' })).dSaver, -25, 1e-9, '收入水平无关');
  /* s 线性 */
  close(A.compute(S({ s: '200' })).dSaver, -50, 1e-9, 's 线性');
});

test('零漏出边界：c = i = 0 时一手就稳定、收入少的正好是少花的钱', () => {
  const o = A.compute(S({ c: '0', i: '0' }));
  assert.equal(o.T, 1); close(o.mult, 1, 0, '乘数 1'); close(o.dy, -100, 1e-9, '每户少 100'); close(o.dSaver, 0, 1e-9, '没多存');
  assert.equal(A.roundsTo(0), 1); assert.equal(A.roundsTo(0.5), 7); /* 0.5^7 = 0.0078 */ assert.equal(A.roundsTo(0.1), 2); /* 0.1^2 = 0.01 正好到 */
});

test('格式：千分位、负号、正号、百分比、舍入', () => {
  assert.equal(A.yuan(-500000), '−500,000'); assert.equal(A.yuan(0.0000001), '0'); assert.equal(A.yuan1(99.875), '99.9');
  assert.equal(A.yuan1(-0.04), '0'); assert.equal(A.signed(-25), '−25'); assert.equal(A.signed(100), '+100'); assert.equal(A.signed(0.01), '0');
  assert.equal(A.pct(0.4), '40%'); assert.equal(A.pct(1 / 3), '33.3%'); assert.equal(A.yuan1(1234.5), '1,235'); assert.equal(A.yuan1(999.94), '999.9'); assert.equal(A.signed(-49393.8), '−49,394');
  assert.ok(A.verdict(A.compute(S({ n: '100000', k: '100000' }))).indexOf('（80,000 户）') > 0);
});

test('导出：CSV 防注入、带全部逐手；MD 含结论与对照表', () => {
  const o = A.compute(S({ place: '=HYPERLINK("x")' }));
  const csv = A.toCSV(o, '2000-01-01 00:00');
  assert.ok(csv.indexOf('"=HYPERLINK(""x"")"') >= 0, csv.slice(0, 80));
  const lines = csv.trim().split('\n'); assert.equal(lines.length, 5 + o.series.length);
  assert.ok(lines[2].indexOf('-25.00') > 0);
  const md = A.toMD(o, 'X');
  assert.ok(md.indexOf('**大家一起每月多存 100 元') >= 0); assert.ok(md.indexOf('| 只有你一户 | +99.9 |') >= 0); assert.ok(md.indexOf('| 投资不跟收入变 | 0 | −400 | 0 |') >= 0);
  assert.equal(A.toCSV(A.compute(S({ n: 'x' })), 'X'), ''); assert.equal(A.toMD(A.compute(S({ n: 'x' })), 'X'), '');
  /* 竖线与换行不破坏 MD 表 */
  assert.ok(A.toMD(A.compute(S({ place: 'a|b\nc' })), 'X').indexOf('a\\|b c') > 0);
});

test('当前看第几手：越界夹回、非法回 1', () => {
  assert.equal(A.compute(S({ t: '5' })).at.t, 5);
  assert.equal(A.compute(S({ t: '9999' })).at.t, A.compute(S()).series.length - 1);
  assert.equal(A.compute(S({ t: 'x' })).at.t, 1);
  assert.equal(A.compute(S({ t: '0' })).at.t, 0);
});

test('补测（注入测试没抓到的几处）', () => {
  /* kHalf 向下取整：7 户时一半线 0.4×7 = 2.8 → 2 户（3 户时存的人只剩 46.4 元，不到一半） */
  const o7 = A.compute(S({ n: '7', k: '7' })); assert.equal(o7.kHalf, 2); assert.ok(A.compute(S({ n: '7', k: '3' })).dSaver < 50);
  /* 存款变化显示为 0 时算「一分没多存」而不是「反而少存」：s = 0.1、全镇都跟 → −0.025 */
  const tiny = A.compute(S({ s: '0.1' })); close(tiny.dSaver, -0.025, 1e-9, 'tiny'); assert.equal(tiny.level, 'zero');
  assert.equal(A.compute(S({ s: '0.4' })).level, 'worse'); /* −0.1 */
  /* 至少 2 户 */
  assert.ok(!A.compute(S({ n: '1', k: '1' })).ok); assert.ok(A.compute(S({ n: '2', k: '1' })).ok);
  /* 第几手为负数回到 1 */
  assert.equal(A.compute(S({ t: '-3' })).at.t, 1);
  /* 没有人跟着存：逐手里「跟着存的人」那一列也是 0，不显示成 +s */
  const z = A.compute(S({ k: '0' })); assert.equal(z.dSaver, 0); assert.ok(z.series.every((r) => r.dSaver === 0 && r.dTotal === 0));
  /* CSV 防公式注入：不带引号也要包 */
  assert.ok(A.toCSV(A.compute(S({ place: '=1+1' })), 'X').indexOf('"=1+1"') >= 0);
  assert.ok(A.toCSV(A.compute(S({ place: '@SUM' })), 'X').indexOf('"@SUM"') >= 0);
});
