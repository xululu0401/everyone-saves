#!/usr/bin/env python3
"""一起多存一百 · 独立参考实现（Python Fraction 精确有理数）。
   不抄 core.js 的闭式：直接解线性方程组求稳定状态（逐户收入、消费、投资做会计恒等式），
   再逐轮按「本轮花的钱 = 上一轮收入决定」模拟。输出 tests/ref.json（300 组）。"""
from fractions import Fraction as F
import json, random, pathlib

def solve(n, y, cp, ip, s, k, T):
    c, i = F(cp, 100), F(ip, 100)
    Y0 = F(n) * y
    # 起初稳定：Y0 = C0_total + c*Y0 + I0 + i*Y0 → 自主支出 A = Y0*(1-c-i)
    A = Y0 * (1 - c - i)
    # 稳定后：Y = A - k*s + (c+i)*Y  → 不用公式化简，用一元线性方程 a*Y = b 直接解
    a = 1 - (c + i); b = A - k * s
    Y = b / a
    yh = Y / n
    dy = yh - y
    # 跟着多存的户：存款 = 收入 − 消费，消费 = 起初消费 + c*dy − s
    cons0 = y * c  # 只需差值，起初消费的常数部分在差里抵掉
    save_saver = (y + dy) - (cons0 + c * dy - s) - (y - cons0) if k > 0 else F(0)  # 没有人跟着存时记 0
    save_other = (y + dy) - (cons0 + c * dy) - (y - cons0)
    total = k * save_saver + (n - k) * save_other
    invest = i * (Y - Y0)
    assert total == invest, '储蓄≠投资变化'
    # 逐轮
    Yp = Y0; rows = []
    for t in range(1, T + 1):
        # 会计：本轮全镇消费 C_t 按上一轮收入定；本轮投资 I_t 同理；本轮收入 = C_t + I_t
        C0 = c * Y0 + (A - (Y0 * i)) * 0  # 只要差值：用「起初消费 + c·收入差 − k·s」
        Ct_minus_C0 = c * (Yp - Y0) - k * s
        It_minus_I0 = i * (Yp - Y0)
        Yt = Y0 + Ct_minus_C0 + It_minus_I0
        # 储蓄 = 上一轮收到的 − 这一轮花掉的；全镇储蓄变化 = (Yp − Y0) − (C_t − C0)
        tot = (Yp - Y0) - Ct_minus_C0
        # 跟着多存的那户：收入差 (Yp−Y0)/n，消费差 c·收入差 − s
        dpp = (Yp - Y0) / n
        saver = dpp - (c * dpp - s)
        assert tot == k * saver + (n - k) * (dpp - c * dpp)
        rows.append([float(Yt / n), float(saver if k > 0 else 0), float(tot)])
        Yp = Yt
    # 离稳定 1% 以内的轮数：|Y_t − Y*| ≤ 1% |Y0 − Y*|
    r = c + i; g = F(1); t = 0
    while g > F(1, 100) and t < 1000:
        g *= r; t += 1
    if r == 0: t = 1
    return dict(n=n, y=float(y), c=cp, i=ip, s=float(s), k=k, dy=float(dy), dSaver=float(save_saver), dOther=float(save_other),
                dTotal=float(total), T=t, rounds=rows)

def main():
    random.seed(20261117)
    out = [solve(1000, F(8000), 75, 5, F(100), 1000, 30)]
    while len(out) < 300:
        n = random.choice([2, 3, 10, 50, 100, 1000, 25000])
        cp = random.randint(0, 95); ip = random.randint(0, min(50, 99 - cp))
        k = random.randint(0, n); y = F(random.choice([1000, 3000, 8000, 20000]))
        s = F(random.choice([0, 10, 50, 100, 300]))
        L = 1 - F(cp + ip, 100)
        if k * s / L / n >= y: continue
        out.append(solve(n, y, cp, ip, s, k, 30))
    p = pathlib.Path(__file__).with_name('ref.json')
    p.write_text(json.dumps(out, ensure_ascii=False))
    d = out[0]
    print('300 组；默认：每户收入变化 %.4f、跟着存的人 %.4f、全镇 %.4f、%d 轮' % (d['dy'], d['dSaver'], d['dTotal'], d['T']))
    worse = sum(1 for x in out if x['dSaver'] < 0); print('跟着存的人反而少存的组数', worse)

main()
