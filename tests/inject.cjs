'use strict';
/* 注入测试：对 core.js 做一处小改动，看核心测试能不能抓到。跑完自动还原。 */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const F=path.join(__dirname,'../core.js'),src=fs.readFileSync(F,'utf8');
/* 删掉的等价变异：yuan1 里「|v| < 0.05 置 0」——四舍五入到 0.1 后非零值绝对值至少 0.1，这句是死代码，已从 core.js 删除。 */
const M=[
["dSaver: k > 0 ? s + (1 - c) * dy : 0,","dSaver: k > 0 ? s + c * dy : 0,"],
["dSaver: k > 0 ? s + (1 - c) * dy : 0,","dSaver: s + (1 - c) * dy,"],
["dSaver: k > 0 ? s + (1 - c) * d : 0,","dSaver: s + (1 - c) * d,"],
["var L = 1 - c - i, dY = -k * s / L","var L = 1 - c, dY = -k * s / L"],
["dOther: (1 - c) * dy, ","dOther: dy, "],
["dTotal: k * s + n * (1 - c) * dy,","dTotal: k * s + (n - k) * (1 - c) * dy,"],
["return c >= 1 ? 1 : Math.min(1, (1 - f) * (1 - c - i) / (1 - c));","return c >= 1 ? 1 : Math.min(1, (1 - f) * (1 - c) / (1 - c + i));"],
["while (g > TOL + EPS && t < MAX_ROUNDS)","while (g >= TOL && t < MAX_ROUNDS)"],
["if (r <= 0) return 1;","if (r <= 0) return 0;"],
["var Y = A - k * s + (c + i) * Yp, d = (Yp - Y0) / n;","var Y = A - k * s + c * Yp, d = (Yp - Y0) / n;"],
["dTotal: k * s + (1 - c) * (Yp - Y0) });","dTotal: k * s + (1 - c - i) * (Yp - Y0) });"],
["o.kHalf = Math.floor(o.halfShare * n + EPS);","o.kHalf = Math.round(o.halfShare * n);"],
["(S.dSaver < -0.05 ? 'worse'","(S.dSaver < 0 ? 'worse'"],
["(S.dSaver < s / 2 - EPS ? 'shrink'","(S.dSaver <= s / 2 ? 'shrink'"],
["P.cp + P.ip > 99 + EPS","P.cp + P.ip >= 99"],
["P.k > P.n) errs","P.k >= P.n) errs"],
["if (gap >= P.y - EPS)","if (gap > P.y)"],
["P.n = need('n', 2,","P.n = need('n', 1,"],
["if (k > 1) acts.push","acts.push"],
["if (i > 0) acts.push","acts.push"],
["if (k < n) acts.push","acts.push"],
["o.series = rounds(n, y, c, i, s, k, Math.max(o.T, 12));","o.series = rounds(n, y, c, i, s, k, Math.max(o.T, 12) + 1);"],
["P.t = Math.min(P.t, o.series.length - 1);","P.t = Math.min(P.t, o.series.length);"],
["if (!isInt(P.t) || P.t < 0) P.t = 1;","if (!isInt(P.t)) P.t = 1;"],
["return /[\",\\n\\r]/.test(x) || /^[=+\\-@]/.test(x)","return /[\",\\n\\r]/.test(x)"],
["return t === '0' ? '0' :","return"],
["replace(/[,，\\s]/g, '')","replace(/[，\\s]/g, '')"],
["if (P.i === 0) return","if (P.i < 0) return"],
];
let caught=0;const rows=[];
for(const [a,b] of M){
  if(src.indexOf(a)<0){rows.push('✗ 找不到原文：'+a);continue;}
  fs.writeFileSync(F,src.replace(a,b));
  let ok=true;try{execFileSync('node',['--test',path.join(__dirname,'core.test.cjs')],{stdio:'pipe'});}catch(e){ok=false;}
  rows.push((ok?'✗ 没抓到':'✓ 抓到')+'：'+a.slice(0,70)+' → '+b.slice(0,70));if(!ok)caught++;
}
fs.writeFileSync(F,src);
console.log(rows.join('\n'));console.log('合计 '+caught+'/'+M.length);
