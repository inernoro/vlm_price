# VLM Price：图片识别模型真实报价与 OpenRouter 实测

把难以理解的“每百万 token 单价”，转换成产品、采购和研发都能直接使用的口径：

> **识别 1000 张 1024×1024、约 1MB、各含单个物品的图片，大约多少钱？**

本项目对 16 个视觉语言模型执行统一图片识别请求，覆盖阿里云、火山引擎、智谱、阶跃星辰、MiniMax、MoonshotAI、OpenAI、Google、Anthropic、Amazon、Meta 与 Mistral 等产品。所有模型使用同一张图、同一字段要求，并记录答案、token、实际账单、供应商、延迟和重试。

数据快照与实测日期：**2026-08-14**。

![统一测试图：红色陶瓷杯](assets/benchmark-mug-1024.png)

## 一句话结论

- 正确结果的模型费约为 **¥0.79～¥45.88/1000 张**。
- 最低成功价是 Qwen3.7 Flash，但需要放宽输出上限后重试，且耗时 19.84 秒。
- 简单物品识别的综合首选是 Qwen3 VL 32B：约 **¥0.91/1000 张、4.95 秒/次**。
- GPT-5.4 Nano 是稳定、快速的备选：约 **¥2.09/1000 张、3.38 秒/次**。
- 火山引擎 Seed 2.1 Turbo 识别正确：约 **¥8.06/1000 张、10.11 秒/次**；更适合已有方舟技术栈或需要额外推理能力的任务。
- Mistral Small 4 把陶瓷杯高置信度误判为塑料桶，说明低价和高自报置信度都不能代替业务评测。

人民币按固定预算汇率 `$1 = ¥7.20` 换算。

## 给客户的报价口径

实测裸成本不能直接当销售价。本项目同时给出平均法与最高法，并为比测试提示词更复杂的请求预留 token：每张 1024×1024 图片按“本次实测输入 + 500 个文本 token、最多 600 个计费输出 token”预算，每张最多 2 次尝试。

| 口径 | 裸模型预算/1000 张 | 安全成本/1000 张 | 建议未税报价/1000 张 | 适用条件 |
|---|---:|---:|---:|---|
| 实测平均成本 | ¥9.68 | — | — | 15 个正确结果的成功请求算术平均，仅用于复盘 |
| 实测最高成本 | ¥45.88 | — | — | 本次最高成功请求，来自 Kimi K3 |
| 平均成本法 | ¥25.99 | ¥65.82 | **¥100** | 15 个正确模型的模型池和调用占比固定、按月汇总结算 |
| 最高成本法 | ¥108.13 | ¥273.78 | **¥400** | 客户可触发清单内任一模型；默认推荐 |

计算规则：

```text
安全成本 = 复杂提示词裸预算 × 2 次尝试 × 1.055 支付成本 × 1.20 价格/路由缓冲
理论售价 = 安全成本 / (1 - 30% 目标毛利率)
建议报价 = 理论售价向上取整
```

平均成本法的理论售价是 ¥94.03，向上报价 ¥100；最高成本法的理论售价是 ¥391.12，向上报价 ¥400。若不限制模型、提示词、分辨率、输出 token 或重试次数，应按实际 token 另行计费，不能承诺固定单价。以上为未税模型服务价，不含人工审核、定制开发、存储和专线费用。

## 完整结果

| 模型 | 结果 | 有效/尝试 | 美元/1000 张 | 人民币/1000 张 | 人民币/1 万张 | 延迟 | 推荐度 |
|---|---|---:|---:|---:|---:|---:|---:|
| Qwen3.7 Flash | 重试正确 | 1/2 | $0.109570 | ¥0.79 | ¥7.89 | 19.84s | ★★★★☆ |
| Qwen3 VL 32B Instruct | 正确 | 1/1 | $0.126256 | ¥0.91 | ¥9.09 | 4.95s | ★★★★★ |
| Amazon Nova Lite | 正确 | 1/1 | $0.167100 | ¥1.20 | ¥12.03 | 11.99s | ★★★★☆ |
| Mistral Small 4 | **误判** | 1/1 | $0.239550 | ¥1.72 | ¥17.25 | 4.92s | ★★☆☆☆ |
| GPT-5.4 Nano | 正确 | 1/1 | $0.290250 | ¥2.09 | ¥20.90 | 3.38s | ★★★★★ |
| MiniMax M3 | 正确 | 1/1 | $0.308580 | ¥2.22 | ¥22.22 | 4.81s | ★★★★☆ |
| Step 3.7 Flash | 正确 | 1/1 | $0.346450 | ¥2.49 | ¥24.94 | 5.70s | ★★★★☆ |
| Gemini 3.5 Flash Lite | 正确 | 1/1 | $0.420000 | ¥3.02 | ¥30.24 | 6.95s | ★★★★☆ |
| GLM-4.6V | 正确 | 1/1 | $0.528500 | ¥3.81 | ¥38.05 | 8.53s | ★★★★☆ |
| Llama 4 Maverick | 正确 | 1/1 | $0.707990 | ¥5.10 | ¥50.98 | 3.76s | ★★★☆☆ |
| GPT-5.4 Mini | 正确 | 1/1 | $1.083000 | ¥7.80 | ¥77.98 | 4.12s | ★★★★☆ |
| Seed 2.1 Turbo | 正确 | 1/1 | $1.119500 | ¥8.06 | ¥80.60 | 10.11s | ★★★★☆ |
| Claude Haiku 4.5 | 正确 | 1/1 | $1.682000 | ¥12.11 | ¥121.10 | 7.71s | ★★★☆☆ |
| GLM-5V Turbo | 重试正确 | 1/2 | $2.242800 | ¥16.15 | ¥161.48 | 24.98s | ★★★☆☆ |
| Claude Sonnet 4.6 | 正确 | 1/1 | $4.656000 | ¥33.52 | ¥335.23 | 4.20s | ★★★☆☆ |
| Kimi K3 | 正确 | 1/1 | $6.372600 | ¥45.88 | ¥458.83 | 13.25s | ★★★☆☆ |

> 这是单张标准商品图的接入与计费冒烟测试，不是通用视觉排行榜。生产选型必须使用带人工真值的业务图片集复测。

## 为什么“1MB 图片”不是计费单位

VLM 通常不会按上传文件的 MB 数线性计费。图片会按照模型各自的缩放、切片或视觉 token 规则转换为输入 token。因此：

- 同为 1024×1024，1MB PNG 与 200KB JPEG 的模型费通常接近；
- 降低压缩体积主要节省传输带宽，不一定减少视觉 token；
- 真正影响费用的是模型、分辨率、视觉 token、输出长度、内部推理 token 和路由供应商；
- 最可靠的成本依据是响应中的 `usage.cost`，而不是只根据目录 token 单价猜测。

以 Qwen3 系列为例，官方图像 token 估算约为：

```text
图像 token ≈ 缩放后高度 × 缩放后宽度 / (32 × 32) + 2
```

1024×1024 理论视觉部分约为 1026 token；本项目 Qwen 实际输入为 1070～1074 token，包含图片和短文本提示，与公式基本吻合。

## 使用热度

OpenRouter 不公开每个模型的独立用户人数，因此项目采用公开 30 日 token 总量作为热度代理。它不等于用户数；未进入每日 Top 50 也不代表无人使用。

数据范围：2026-07-15 至 2026-08-13。

| 模型 | 30 日 OpenRouter token |
|---|---:|
| Step 3.7 Flash | 5.987T |
| Kimi K3 | 5.287T |
| Gemini 3.5 Flash Lite | 572.7B |
| GPT-5.4 Nano | 488.6B |
| GPT-5.4 Mini | 463.0B |
| Qwen3.7 Flash | 202.3B |
| 其余模型 | 未进入或未出现在公开 Top 50 数据 |

引用口径：Source: OpenRouter (openrouter.ai/rankings), as of 2026-08-14T08:03:05.065Z.

## 火山引擎 Seed 的位置

Seed 2.1 Turbo 本次返回正确的 `马克杯 / 红色 / 陶瓷 / 1`：

```text
输入：1384 token
输出：171 token，其中 145 reasoning token
折算费用：$1.1195 = ¥8.0604/1000 张
延迟：10.11 秒
```

它在简单分类上不如 Qwen3 VL 32B 便宜，但如果系统已经使用火山方舟、需要工具调用或更复杂的联合理解，统一平台和工程链路可能比单次模型费更重要。火山方舟按输入/输出 token 计费，图片会转换为输入 token；具体直连单价应以方舟控制台为准，本项目表格记录的是 OpenRouter 实付。

## 成本公式

```text
每 1000 张美元 =（输入 token × 输入美元单价/token
                 + 输出 token × 输出美元单价/token
                 + 按图或按请求附加费）× 1000

每 1000 张人民币 = 每 1000 张美元 × 7.20
批量预算 = 每 1000 张人民币 × 图片数量 / 1000
```

示例，Qwen3 VL 32B：

```text
1070 × $0.104 / 1,000,000
+ 36 × $0.416 / 1,000,000
= $0.126256/1000 张
= ¥0.9090432/1000 张
```

## 推荐生产路由

```mermaid
flowchart LR
    A["图片预检"] --> B["Qwen3 VL 32B：短 JSON 分类"]
    B -->|"Schema 与业务规则通过"| C["直接入库"]
    B -->|"无效 JSON、低置信或规则冲突"| D["GPT-5.4 Nano / Gemini 3.5 Flash Lite 重试"]
    D -->|"复杂文档、GUI 或多步推理"| E["GLM-4.6V / Seed 2.1 / GPT-5.4 Mini 二审"]
    E -->|"仍无法判断"| F["人工复核"]
```

固定类别且有训练样本时，传统分类/检测模型通常比 VLM 更稳定、更容易校准。票据和表格建议采用 OCR/版面分析 → VLM 校验 → 规则引擎，而不是让旗舰 VLM 从头输出全部文字。

## 项目结构

```text
.
├── README.md
├── SECURITY.md
├── assets/
│   └── benchmark-mug-1024.png
├── data/
│   ├── benchmark-results.csv
│   ├── customer-quote-scenarios.csv
│   ├── openrouter-model-pricing-snapshot.json
│   └── openrouter-usage-snapshot.json
└── docs/
    ├── 01-完整报价表.md
    ├── 02-交叉验算.md
    ├── 03-测试方法与原始结果.md
    ├── 04-选型与上线建议.md
    └── 05-来源与口径.md
```

## 数据与复核

- [`data/benchmark-results.csv`](data/benchmark-results.csv)：16 个模型的统一结果。
- [`data/customer-quote-scenarios.csv`](data/customer-quote-scenarios.csv)：平均法与最高法的对客报价复算参数。
- [`data/openrouter-model-pricing-snapshot.json`](data/openrouter-model-pricing-snapshot.json)：所测模型的当日目录价格快照。
- [`data/openrouter-usage-snapshot.json`](data/openrouter-usage-snapshot.json)：公开排行榜原始数据子集。
- [`docs/01-完整报价表.md`](docs/01-完整报价表.md)：完整报价、效果、延迟与推荐度。
- [`docs/02-交叉验算.md`](docs/02-交叉验算.md)：逐模型 token × 单价复算。
- [`docs/03-测试方法与原始结果.md`](docs/03-测试方法与原始结果.md)：提示词、参数、答案、失败和重试。

## 官方来源

- [OpenRouter Models API](https://openrouter.ai/api/v1/models)
- [OpenRouter Usage Accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting)
- [OpenRouter 排行榜数据 API](https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily)
- [阿里云百炼视觉理解](https://help.aliyun.com/zh/model-studio/vision-model)
- [火山方舟](https://www.volcengine.com/docs/82379/?lang=zh)
- [智谱 GLM-5V Turbo](https://docs.bigmodel.cn/cn/guide/models/vlm/glm-5v-turbo)
- [Kimi API 概览](https://www.kimi.com/help/kimi-api/api-overview)
- [阶跃星辰视觉理解](https://platform.stepfun.com/docs/zh/guides/models/vision)
- [MiniMax 图片理解](https://platform.minimaxi.com/docs/token-plan/mcp-guide)

## 安全与局限

- 仓库不包含任何真实 API key 或 Authorization header；复现实验应从服务端环境变量读取密钥。
- 当前准确性样本只有一张图，适合验证接入与成本，不适合宣布通用模型胜负。
- 延迟取单次请求，会受到路由、排队和冷启动影响。
- 价格、模型版本和供应商可能变化；JSON 快照只代表 2026-08-14。
- `confidence` 是模型自报值，不是校准概率。
- 上线前应使用 200～1000 张业务真值图片评测准确率、关键类别召回率、JSON 合法率、P50/P95 延迟、失败率和重试后总价。

## License

当前仓库尚未指定开源许可证。在添加许可证之前，默认保留所有权利；数据与第三方产品名称仍受其各自条款约束。
