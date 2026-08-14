#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const root = new URL("../", import.meta.url);
const configUrl = new URL("data/model-watchlist.json", root);
const outputUrl = new URL("data/live-pricing.json", root);
const readmeUrl = new URL("README.md", root);

const config = JSON.parse(await readFile(configUrl, "utf8"));
const response = await fetch(config.source, {
  headers: { "User-Agent": "vlm-price-board/1.0" }
});

if (!response.ok) {
  throw new Error(`pricing source returned HTTP ${response.status}`);
}

const payload = await response.json();
if (!Array.isArray(payload.data)) {
  throw new Error("pricing source response has no data array");
}

const byId = new Map(payload.data.map((model) => [model.id, model]));
const missing = config.models.filter((entry) => !byId.has(entry.id));
if (missing.length) {
  throw new Error(`watchlist models missing from source: ${missing.map((m) => m.id).join(", ")}`);
}

const workload = config.workload;
const round = (value) => Number(value.toFixed(9));
const rows = config.models.map((entry) => {
  const model = byId.get(entry.id);
  const inputPerToken = Number(model.pricing?.prompt);
  const outputPerToken = Number(model.pricing?.completion);
  if (!Number.isFinite(inputPerToken) || !Number.isFinite(outputPerToken)) {
    throw new Error(`invalid token pricing for ${entry.id}`);
  }

  const usdPer1000 = (
    workload.input_tokens_per_image * inputPerToken +
    workload.output_tokens_per_image * outputPerToken
  ) * workload.images;

  return {
    id: entry.id,
    name: model.name,
    created: model.created,
    input_usd_per_million: round(inputPerToken * 1_000_000),
    output_usd_per_million: round(outputPerToken * 1_000_000),
    usd_per_1000: round(usdPer1000),
    cny_per_1000: round(usdPer1000 * workload.usd_cny),
    lab_status: entry.lab_status,
    position: entry.position,
    input_modalities: model.architecture?.input_modalities ?? []
  };
}).sort((a, b) => a.cny_per_1000 - b.cny_per_1000);

const checkedAt = new Date().toISOString();
const floor = rows[0];
const ceiling = rows.at(-1);
const snapshot = {
  schema_version: 1,
  source: config.source,
  checked_at: checkedAt,
  workload,
  floor: { id: floor.id, cny_per_1000: floor.cny_per_1000 },
  ceiling: { id: ceiling.id, cny_per_1000: ceiling.cny_per_1000 },
  rows
};

await writeFile(outputUrl, `${JSON.stringify(snapshot, null, 2)}\n`);

const fmt = (value, digits = 2) => value.toFixed(digits).replace(/\.00$/, "");
const lines = [
  "## 当前目录预算",
  "",
  `> 自动核验：${checkedAt}；来源：[OpenRouter Models API](${config.source})。`,
  "",
  `统一预算假设：每张 ${workload.input_tokens_per_image} 输入 token、${workload.output_tokens_per_image} 输出 token，共 ${workload.images} 张；$1 = ¥${workload.usd_cny.toFixed(2)}。这是目录预算，不是实验实付。`,
  "",
  "| 指标 | 数值 | 模型 |",
  "|---|---:|---|",
  `| 当前目录下限 | **¥${fmt(floor.cny_per_1000)}/1000 张** | ${floor.name} |`,
  `| 当前目录上限 | **¥${fmt(ceiling.cny_per_1000)}/1000 张** | ${ceiling.name} |`,
  `| 目录价差 | **${fmt(ceiling.cny_per_1000 / floor.cny_per_1000, 1)}×** | 上限 ÷ 下限 |`,
  "",
  "| 模型 | 输入/输出（$/1M token） | 目录预算（¥/1000 张） | 实验状态 | 定位 |",
  "|---|---:|---:|---|---|",
  ...rows.map((row) => `| ${row.name} | ${fmt(row.input_usd_per_million, 3)} / ${fmt(row.output_usd_per_million, 3)} | **${fmt(row.cny_per_1000)}** | ${row.lab_status} | ${row.position} |`),
  "",
  "目录价格最低不等于业务成本最低；`待复测` 模型不参与效果结论。"
];

const start = "<!-- LIVE_PRICING_START -->";
const end = "<!-- LIVE_PRICING_END -->";
const readme = await readFile(readmeUrl, "utf8");
const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
if (!pattern.test(readme)) {
  throw new Error("README live pricing markers not found");
}

await writeFile(readmeUrl, readme.replace(pattern, `${start}\n${lines.join("\n")}\n${end}`));

console.log(`updated ${rows.length} models; floor=${floor.id}; ceiling=${ceiling.id}`);
