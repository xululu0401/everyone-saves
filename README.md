# 一起多存一百

凯恩斯的节俭悖论，一手一手算给你看：小镇里很多人家一起每月多存一百，钱少转一圈、收入跟着缩，最后你自己到底多存了多少。

- 体验：https://xululu0401.github.io/everyone-saves/
- 计算：`core.js`（收入—支出模型：闭式稳定解 + 逐手递推两条路径）
- 测试：`node --test tests/core.test.cjs`；独立参考实现 `python3 tests/ref.py` 生成 `tests/ref.json`（300 组）；注入测试 `node tests/inject.cjs`
- 假设：教科书最简模型，没算利率、物价、政府、外地。默认小镇和数字为虚构示例，不是对真实经济的预测，也不是理财建议。
