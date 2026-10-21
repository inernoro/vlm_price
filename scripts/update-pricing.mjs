#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const configUrl = new URL("data/model-watchlist.json", root);
const exchangeRateUrl = new URL("data/exchange-rate.json", root);
const outputUrl = new URL("data/live-pricing.json", root);
const textRiskUrl = new URL("data/text-risk-pricing.json", root);
const textRiskCsvUrl = new URL("data/text-risk-pricing.csv", root);
const readmeUrl = new URL("README.md", root);
const chinaMoneyApi = "https://www.chinamoney.com.cn/ags/ms/cm-u-bk-ccpr/CcprHisNew";

const today = new Date().toISOString().slice(0, 10);
const round = (value, digits = 9) => Number(value.toFixed(digits));
const fmt = (value, digits = 2) => value.toFixed(digits).replace(/\.00$/, "");
const csvEscape = (value) => {
  if (value === null || value === undefined) return "";
  const string = String(value);
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
};

async function fetchExchangeRate(previous) {
  const response = await fetch(chinaMoneyApi, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: previous.source_url,
      "User-Agent": "vlm-price-board/1.0"
    },
    body: JSON.stringify({ pageNum: 1, pageSize: 3 })
  });
  if (!response.ok) throw new Error(`exchange-rate source returned HTTP ${response.status}`);
  const payload = await response.json();
  const usdIndex = payload.data?.head?.indexOf("USD/CNY") ?? -1;
  const latest = payload.records?.[0];
  const rate = Number(latest?.values?.[usdIndex]);
  if (usdIndex < 0 || !latest?.date || !Number.isFinite(rate) || rate < 4 || rate > 10) {
    throw new Error("exchange-rate source returned an invalid USD/CNY record");
  }
  return { ...previous, rate, rate_date: latest.date, checked_at: today };
}

function revalueTextRisk(catalog, exchangeRate) {
  const offers = catalog.offers.map((offer) => {
    if (typeof offer.usd_base_per_1000_short_texts !== "number") return offer;
    const convert = (field) => round(offer[field] * exchangeRate.rate, 6);
    return {
      ...offer,
      normalized_cny_per_1000_short_texts: convert("usd_base_per_1000_short_texts"),
      public_low_cny: convert("usd_low_per_1000_short_texts"),
      public_mean_cny: convert("usd_mean_per_1000_short_texts"),
      public_high_cny: convert("usd_high_per_1000_short_texts")
    };
  });
  const numeric = offers.filter((offer) => typeof offer.normalized_cny_per_1000_short_texts === "number");
  const nonzeroLows = numeric.flatMap((offer) => [offer.public_low_cny, offer.normalized_cny_per_1000_short_texts])
    .filter((value) => typeof value === "number" && value > 0);
  const baseValues = numeric.map((offer) => offer.normalized_cny_per_1000_short_texts);
  return {
    ...catalog,
    currency_assumption: {
      ...catalog.currency_assumption,
      usd_to_cny: exchangeRate.rate,
      rate_date: exchangeRate.rate_date,
      source_url: exchangeRate.source_url
    },
    summary: {
      public_numeric_vendor_count: numeric.length,
      quote_or_dynamic_vendor_count: offers.length - numeric.length,
      public_base_low_cny: round(Math.min(...baseValues), 2),
      public_base_nonzero_low_cny: round(Math.min(...nonzeroLows), 2),
      public_base_mean_cny: round(baseValues.reduce((sum, value) => sum + value, 0) / baseValues.length, 2),
      public_base_high_cny: round(Math.max(...baseValues), 2)
    },
    offers
  };
}

function textRiskCsv(catalog) {
  const fields = [
    "vendor", "product", "pricing_status", "original_price",
    "normalized_cny_per_1000_short_texts", "public_low_cny", "public_mean_cny",
    "public_high_cny", "billing_unit", "source_checked_at", "source_url"
  ];
  const rows = catalog.offers.map((offer) => fields.map((field) => csvEscape(offer[field])).join(","));
  return `${fields.join(",")}\n${rows.join("\n")}\n`;
}

const config = JSON.parse(await readFile(configUrl, "utf8"));
const previousExchangeRate = JSON.parse(await readFile(exchangeRateUrl, "utf8"));
const previousTextRisk = JSON.parse(await readFile(textRiskUrl, "utf8"));
const [exchangeRate, response] = await Promise.all([
  fetchExchangeRate(previousExchangeRate),
  fetch(config.source, { headers: { "User-Agent": "vlm-price-board/1.0" } })
]);
if (!response.ok) throw new Error(`pricing source returned HTTP ${response.status}`);

const payload = await response.json();
if (!Array.isArray(payload.data)) throw new Error("pricing source response has no data array");
const byId = new Map(payload.data.map((model) => [model.id, model]));
const missing = config.models.filter((entry) => !byId.has(entry.id));
if (missing.length) throw new Error(`watchlist models missing from source: ${missing.map((model) => model.id).join(", ")}`);

const workload = {
  ...config.workload,
  usd_cny: exchangeRate.rate,
  exchange_rate_date: exchangeRate.rate_date,
  exchange_rate_source: exchangeRate.source_url
};
const rows = config.models.map((entry) => {
  const model = byId.get(entry.id);
  const modalities = model.architecture?.input_modalities ?? [];
  if (!modalities.includes("image")) throw new Error(`watchlist model no longer supports image input: ${entry.id}`);
  const rawInput = model.pricing?.prompt;
  const rawOutput = model.pricing?.completion;
  if (rawInput === null || rawInput === undefined || rawInput === "" || rawOutput === null || rawOutput === undefined || rawOutput === "") {
    throw new Error(`missing token pricing for ${entry.id}`);
  }
  const inputPerToken = Number(rawInput);
  const outputPerToken = Number(rawOutput);
  if (!Number.isFinite(inputPerToken) || !Number.isFinite(outputPerToken) || inputPerToken < 0 || outputPerToken < 0) {
    throw new Error(`invalid token pricing for ${entry.id}`);
  }
  const usdPer1000 = (workload.input_tokens_per_image * inputPerToken + workload.output_tokens_per_image * outputPerToken) * workload.images;
  if (!(usdPer1000 > 0)) throw new Error(`non-positive workload price for ${entry.id}`);
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
    input_modalities: modalities
  };
}).sort((left, right) => left.cny_per_1000 - right.cny_per_1000);

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
const textRisk = revalueTextRisk(previousTextRisk, exchangeRate);

const lines = [
  "## 当前目录预算",
  "",
  `> 自动核验：${checkedAt}；来源：[OpenRouter Models API](${config.source})。`,
  "",
  `统一预算假设：每张 ${workload.input_tokens_per_image} 输入 token、${workload.output_tokens_per_image} 输出 token，共 ${workload.images} 张；$1 = ¥${workload.usd_cny.toFixed(4)}（[${exchangeRate.source_name}](${exchangeRate.source_url}) ${exchangeRate.rate_date} 中间价）。这是目录预算，不是实验实付。`,
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
if (!pattern.test(readme)) throw new Error("README live pricing markers not found");

await Promise.all([
  writeFile(exchangeRateUrl, `${JSON.stringify(exchangeRate, null, 2)}\n`),
  writeFile(outputUrl, `${JSON.stringify(snapshot, null, 2)}\n`),
  writeFile(textRiskUrl, `${JSON.stringify(textRisk, null, 2)}\n`),
  writeFile(textRiskCsvUrl, textRiskCsv(textRisk)),
  writeFile(readmeUrl, readme.replace(pattern, `${start}\n${lines.join("\n")}\n${end}`))
]);

console.log(`updated ${rows.length} models and USD/CNY ${exchangeRate.rate} (${exchangeRate.rate_date}); floor=${floor.id}; ceiling=${ceiling.id}`);
