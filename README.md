# AI Price Board

> 面向业务决策的 AI 服务公开价格仓库：统一单位、保留原始计费规则、记录核验时间和证据。

[![Price refresh](https://github.com/inernoro/vlm_price/actions/workflows/update-pricing.yml/badge.svg)](https://github.com/inernoro/vlm_price/actions/workflows/update-pricing.yml)
[![Catalog validation](https://github.com/inernoro/vlm_price/actions/workflows/validate-catalog.yml/badge.svg)](https://github.com/inernoro/vlm_price/actions/workflows/validate-catalog.yml)
![Catalog](https://img.shields.io/badge/分类-VLM%20%7C%20文本风险识别-2563eb)
![Data](https://img.shields.io/badge/数据-可复核-15803d)

本项目回答三个业务问题：**最低多少钱、正常会浮动到哪里、数字如何证明**。公开价与实验实付分开；无稳定公开价格的服务标记为“询价”，不采用过期资料补数。

## 价格分类

| 分类 | 统一比较单位 | 当前范围 | 状态 | 入口 |
|---|---|---:|---|---|
| VLM 单图识别 | 1000 张 1024×1024 单图 | 实验室 ¥0.79～¥45.88 | 目录价每日更新 | [完整报价](docs/01-完整报价表.md) |
| 文本内容风险识别 | 1000 条、每条不超过 100 Unicode 字符 | 公开基础价 ¥0～¥3.60 | 2026-08-20 官方来源核验 | [厂商报价](docs/06-文本内容风险识别报价.md) |

### 文本风险识别摘要

| 指标 | 价格（人民币/1000 条） | 说明 |
|---|---:|---|
| 公开基础价下限 | **¥0.00** | OpenAI `omni-moderation-latest`；官方标注免费 |
| 非零公开价下限 | **¥0.90** | 百度智能云最大公开资源包折算价 |
| 公开基础价样本均值 | **¥1.54** | 7 个有可复算公开基础价的厂商；询价项与阶段性免费额度不参与 |
| 公开基础价上限 | **¥3.60** | Google Cloud Text Moderation，付费第一档 |

统一试算按 1000 条短文本、每条不超过 100 Unicode 字符、每条单独请求，美元按 `$1 = ¥7.20`。均值用于判断公开目录价量级，不代表效果排名或合同成交价；详细公式、套餐上下限和功能叠加项见[文本内容风险识别报价](docs/06-文本内容风险识别报价.md)。静态报价超过 45 天未复核时，仓库校验会失败并提示更新。

## VLM 管理摘要

| 结论 | 数值 | 口径 |
|---|---:|---|
| 实验室成功成本下限 | **¥0.79/1000 张** | Qwen3.7 Flash；成功请求实付，首次请求失败成本另列 |
| 实验室成功成本均值 | **¥9.68/1000 张** | 15 个识别正确模型的算术平均 |
| 实验室成功成本上限 | **¥45.88/1000 张** | Kimi K3；成功请求实付 |
| 实验室价差 | **58.2×** | 上限 ÷ 下限 |

结论仅适用于本项目的 1024×1024、约 1MB、单物品、短 JSON 任务。复杂 OCR、长输出、多图和多轮推理不在该区间内。

<!-- LIVE_PRICING_START -->
## 当前目录预算

> 自动核验：2026-08-14T09:47:57.346Z；来源：[OpenRouter Models API](https://openrouter.ai/api/v1/models)。

统一预算假设：每张 1500 输入 token、200 输出 token，共 1000 张；$1 = ¥7.20。这是目录预算，不是实验实付。

| 指标 | 数值 | 模型 |
|---|---:|---|
| 当前目录下限 | **¥0.51/1000 张** | Qwen: Qwen3.7 Flash |
| 当前目录上限 | **¥90/1000 张** | Claude Opus 5 |
| 目录价差 | **176.1×** | 上限 ÷ 下限 |

| 模型 | 输入/输出（$/1M token） | 目录预算（¥/1000 张） | 实验状态 | 定位 |
|---|---:|---:|---|---|
| Qwen: Qwen3.7 Flash | 0.030 / 0.130 | **0.51** | 已实测·重试正确 | 价格下沿 |
| ByteDance Seed: Seed-2.0-Mini | 0.100 / 0.400 | **1.66** | 待复测 | 低价候选 |
| OpenAI: GPT-5.6 Luna | 0.100 / 0.600 | **1.94** | 待复测 | OpenAI 低成本档 |
| Mistral: Mistral Small 4 | 0.150 / 0.600 | **2.48** | 已实测·误判 | 风险对照 |
| StepFun: Step 3.7 Flash | 0.200 / 1.150 | **3.82** | 已实测·正确 | 通用候选 |
| MiniMax: MiniMax M3 | 0.300 / 1.200 | **4.97** | 已实测·正确 | 通用候选 |
| Qwen: Qwen3.7 Plus | 0.320 / 1.280 | **5.30** | 待复测 | 通用候选 |
| Meta: Muse Glimmer 30B | 0.350 / 1.500 | **5.94** | 待复测 | 通用候选 |
| Google: Gemini 3.7 Flash | 0.375 / 1.875 | **6.75** | 待复测 | 当前候选 |
| Google: Gemini 3.5 Flash Lite | 0.300 / 2.500 | **6.84** | 已实测·正确 | 历史对照 |
| ByteDance Seed: Seed 2.1 Turbo | 0.500 / 2.500 | **9** | 已实测·正确 | 当前候选 |
| Z.ai: GLM 5V Turbo | 1.200 / 4.000 | **18.72** | 已实测·重试正确 | 视觉推理候选 |
| OpenAI: GPT-5.6 Terra | 1.000 / 6.000 | **19.44** | 待复测 | OpenAI 平衡档 |
| Anthropic: Claude Sonnet 5 | 2.000 / 10.000 | **36** | 待复测 | 高能力档 |
| MoonshotAI: Kimi K3 | 3.000 / 15.000 | **54** | 已实测·正确 | 高能力档 |
| Claude Opus 5 | 5.000 / 25.000 | **90** | 待复测 | 价格上沿 |

目录价格最低不等于业务成本最低；`待复测` 模型不参与效果结论。
<!-- LIVE_PRICING_END -->

## 当前变化

- `openai/gpt-5.6-luna` 已替代 GPT-5.4 Nano，作为 OpenAI 当前低成本档候选；支持图片输入，但尚未完成本项目同图实测。
- GPT-5.4 Nano 只保留在 2026-08-14 的历史实验记录中，不再作为当前推荐。
- Seed 2.1 Turbo 保留为当前候选；一次杯子识别正确不能证明它是最有价值的模型。
- 当前目录表与实验室结果严格分离：前者是统一 token 假设下的预算，后者来自 API `usage.cost`。

GPT-5.6 Luna 的型号定位和图片输入能力以 [OpenAI 官方模型页](https://developers.openai.com/api/docs/models/gpt-5.6-luna) 为准；聚合渠道价格以每日抓取结果为准。

## 实验室证据

统一测试图：

![红色陶瓷杯](assets/benchmark-mug-1024.png)

| 项目 | 值 |
|---|---|
| 文件 | `assets/benchmark-mug-1024.png` |
| 尺寸 | 1024×1024 PNG |
| 大小 | 1,025,019 bytes |
| SHA-256 | `572de61e9bc5a18078a7cb230c5009005b05370c2db711d1cbcecc9422e36ef0` |
| 输出 | `object / color / material / count / confidence` 短 JSON |
| 汇率 | $1 = ¥7.20（固定预算汇率） |
| 测试日期 | 2026-08-14 |

实验结果摘要：15 个模型识别正确，Mistral Small 4 以 0.98 自报置信度误判为塑料桶；Qwen3.7 Flash 与 GLM-5V Turbo 需要重试才返回可见答案。完整答案、token、延迟和失败记录见 [`docs/03-测试方法与原始结果.md`](docs/03-测试方法与原始结果.md)。

## 数字如何复核

```text
目录预算/1000 张
= (假设输入 token × 输入单价 + 假设输出 token × 输出单价) × 1000

实验实付/1000 张
= API 响应 usage.cost × 1000
```

复核链路：

1. 每日从 OpenRouter 公共 Models API 读取当前模型与渠道价格。
2. 固定模型清单和统一 token 假设，生成可比较的目录预算。
3. 实验表只使用响应中的 `usage.cost`，不从总账倒推。
4. 原图、CSV、价格快照、公式和失败请求分别保存。
5. 自动任务有异常时直接失败，不静默保留“最新”标签。

## 业务使用边界

- **底价**：只用于判断成本量级，不代表该模型通过业务准确率要求。
- **浮动价**：由视觉 token、输出长度、内部推理、路由供应商和重试共同决定。
- **效果**：单图实验只能排除明显问题；上线前至少使用 200～1000 张人工真值图片复测。
- **热度**：OpenRouter 不公开模型独立用户人数；公开 token 量只能作为使用热度代理。
- **直连价格**：火山方舟、阿里云百炼等直连接口可能与 OpenRouter 不同，应分别留存账单。

## 自动更新

```text
OpenRouter Models API
        ↓ 每日 / 手动触发
scripts/update-pricing.mjs
        ↓
README 实时报价区 + data/live-pricing.json
```

本地刷新：

```bash
node scripts/update-pricing.mjs
```

GitHub Actions 每日执行，也支持 `workflow_dispatch` 手动刷新。监控模型和统一工作量定义在 [`data/model-watchlist.json`](data/model-watchlist.json)。

## 文件索引

| 文件 | 用途 |
|---|---|
| [`docs/01-完整报价表.md`](docs/01-完整报价表.md) | 当前目录预算与实验室实付清单 |
| [`docs/02-交叉验算.md`](docs/02-交叉验算.md) | 公式、逐模型复算与浮动来源 |
| [`docs/03-测试方法与原始结果.md`](docs/03-测试方法与原始结果.md) | 原始答案、token、延迟、失败与重试 |
| [`data/live-pricing.json`](data/live-pricing.json) | 自动生成的当前目录报价 |
| [`data/benchmark-results.csv`](data/benchmark-results.csv) | 2026-08-14 实验结果 |
| [`data/openrouter-model-pricing-snapshot.json`](data/openrouter-model-pricing-snapshot.json) | 实验日目录快照 |
| [`data/openrouter-usage-snapshot.json`](data/openrouter-usage-snapshot.json) | 30 日 token 热度证据 |
| [`docs/06-文本内容风险识别报价.md`](docs/06-文本内容风险识别报价.md) | 文本审核厂商价格、统一试算和采购边界 |
| [`data/text-risk-pricing.json`](data/text-risk-pricing.json) | 文本风险识别机器可读价格快照 |
| [`data/text-risk-pricing.csv`](data/text-risk-pricing.csv) | 文本风险识别业务表格 |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | 新分类、价格更新和证据要求 |

## 数据声明

- 目录价会变化，以页面的“核验时间”为准。
- 目录预算不是实验实付；“待复测”模型不参与效果排名。
- 仓库不包含 API key、Authorization header 或账户身份信息。
- 原始测试只有一张图，不构成通用模型排行榜。

## License

价格与模型名称归各服务商所有；项目中的整理、脚本与实验记录按仓库许可证使用。
