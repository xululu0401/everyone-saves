/* 封面 cover.svg（1200×1200），读数来自 core.js 同一次 compute；再用浏览器截成 cover.png。 */
const fs = require('node:fs');
const A = require('./core.js');
const o = A.compute(A.defaultState());
if (!o.ok || Math.round(o.dSaver) !== -25 || o.T !== 21) throw new Error('默认场景不对');
const F = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
let houses = '';
for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) { const x = 130 + c * 96, y = 380 + r * 70; houses += `<path d="M${x} ${y + 26} L${x + 34} ${y} L${x + 68} ${y + 26} Z" fill="#2e7d5b"/><rect x="${x + 10}" y="${y + 26}" width="48" height="32" fill="#a9d3bd"/>`; }
const ser = o.series, lo = Math.min(...ser.map((r) => r.dSaver)), hi = 100;
const X = (t) => 150 + 900 * t / (ser.length - 1), Y = (v) => 820 + 230 * (hi - v) / (hi - lo);
const pts = ser.map((r) => X(r.t).toFixed(1) + ',' + Y(r.dSaver).toFixed(1)).join(' ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#f2f4ef"/>
  <rect x="60" y="60" width="1080" height="1080" rx="18" fill="#ffffff"/>
  <text x="130" y="215" font-family="${F}" font-size="120" font-weight="800" fill="#1f2620">一起多存一百</text>
  <text x="130" y="290" font-family="${F}" font-size="40" fill="#4e5a50">大家都多存，你最后存下多少</text>
  ${houses}
  <line x1="150" x2="1050" y1="${Y(0)}" y2="${Y(0)}" stroke="#9aa39b" stroke-width="2"/>
  <line x1="150" x2="1050" y1="${Y(100)}" y2="${Y(100)}" stroke="#8f9a90" stroke-width="2" stroke-dasharray="10 8"/>
  <text x="140" y="${Y(100) + 10}" font-family="${F}" font-size="28" fill="#7f8a80" text-anchor="end">+100</text>
  <text x="140" y="${Y(0) + 10}" font-family="${F}" font-size="28" fill="#7f8a80" text-anchor="end">0</text>
  <polyline points="${pts}" fill="none" stroke="#2e7d5b" stroke-width="7"/>
  <circle cx="${X(ser.length - 1)}" cy="${Y(ser[ser.length - 1].dSaver)}" r="12" fill="#8b4a10"/>
  <text x="1050" y="${Y(100) + 70}" font-family="${F}" font-size="52" font-weight="800" fill="#b23a2b" text-anchor="end">最后 ${A.signed(o.dSaver)} 元</text>
  <text x="130" y="1100" font-family="${F}" font-size="26" fill="#7f8a80">凯恩斯的节俭悖论 · 教科书最简模型 · 数字为虚构示例</text>
</svg>`;
fs.writeFileSync('cover.svg', svg);
fs.writeFileSync('/tmp/cover94.html', '<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body>' + svg + '</body></html>');
console.log('cover.svg', svg.length);
