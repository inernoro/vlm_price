import fs from "node:fs";

const dataUrl = (name) => new URL(`../data/${name}`, import.meta.url);
const catalog = JSON.parse(fs.readFileSync(dataUrl("text-risk-pricing.json"), "utf8"));
const exchange = JSON.parse(fs.readFileSync(dataUrl("exchange-rate.json"), "utf8"));
const livePricing = JSON.parse(fs.readFileSync(dataUrl("live-pricing.json"), "utf8"));
const csvText = fs.readFileSync(dataUrl("text-risk-pricing.csv"), "utf8");
const errors = [];
const tolerance = 0.005;
const close = (actual, expected) => typeof actual === "number" && Math.abs(actual - expected) <= tolerance;
const ageInDays = (date) => (Date.now() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      value = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const headers = rows.shift() ?? [];
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

if (!catalog.verified_at) errors.push("missing verified_at");
if (!Array.isArray(catalog.offers) || catalog.offers.length === 0) errors.push("offers must be non-empty");
if (!(exchange.rate > 0) || !exchange.rate_date || !exchange.source_url) errors.push("exchange rate requires rate, date and source");
if (catalog.currency_assumption.usd_to_cny !== exchange.rate) errors.push("text catalog exchange rate differs from exchange-rate.json");
if (livePricing.workload.usd_cny !== exchange.rate) errors.push("VLM catalog exchange rate differs from exchange-rate.json");
if (livePricing.workload.exchange_rate_date !== exchange.rate_date) errors.push("VLM exchange rate date differs from exchange-rate.json");

const catalogAge = ageInDays(catalog.verified_at);
if (!Number.isFinite(catalogAge)) errors.push("verified_at must be an ISO date");
if (catalogAge > 30) errors.push(`catalog is stale: ${Math.floor(catalogAge)} days since verification`);
if (catalogAge < -1) errors.push("verified_at cannot be in the future");

const allowed = new Set(["public", "public_reference", "public_tiered", "public_region_specific", "dynamic_console", "quote_required"]);
for (const [index, offer] of (catalog.offers || []).entries()) {
  const label = `offers[${index}]`;
  for (const field of ["vendor", "product", "pricing_status", "original_price", "source_url", "source_checked_at"]) {
    if (!offer[field]) errors.push(`${label}: missing ${field}`);
  }
  if (!allowed.has(offer.pricing_status)) errors.push(`${label}: invalid pricing_status`);
  if (!String(offer.source_url || "").startsWith("https://")) errors.push(`${label}: source_url must use https`);
  const sourceAge = ageInDays(offer.source_checked_at);
  const maxAge = ["quote_required", "dynamic_console"].includes(offer.pricing_status) ? 90 : 30;
  if (!Number.isFinite(sourceAge)) errors.push(`${label}: source_checked_at must be an ISO date`);
  else if (sourceAge > maxAge) errors.push(`${label}: source is stale (${Math.floor(sourceAge)} days; max ${maxAge})`);
  else if (sourceAge < -1) errors.push(`${label}: source_checked_at cannot be in the future`);

  const numeric = offer.normalized_cny_per_1000_short_texts;
  const isPublic = offer.pricing_status.startsWith("public");
  if (isPublic && !(typeof numeric === "number" && Number.isFinite(numeric) && numeric >= 0)) {
    errors.push(`${label}: public offer requires a non-negative normalized price`);
  }
  if (!isPublic && numeric !== null) errors.push(`${label}: non-public offer must not invent a normalized price`);
  if (isPublic) {
    const [low, mean, high] = [offer.public_low_cny, offer.public_mean_cny, offer.public_high_cny];
    if (![low, mean, high].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0)) {
      errors.push(`${label}: public offer requires finite low/mean/high values`);
    } else if (!(low <= mean && mean <= high)) errors.push(`${label}: public range must satisfy low <= mean <= high`);
    else if (!(low <= numeric && numeric <= high)) errors.push(`${label}: normalized price must be inside the public range`);
  }
}

const numericOffers = catalog.offers.filter((offer) => typeof offer.normalized_cny_per_1000_short_texts === "number");
const baseValues = numericOffers.map((offer) => offer.normalized_cny_per_1000_short_texts);
const nonzeroLows = numericOffers.flatMap((offer) => [offer.public_low_cny, offer.normalized_cny_per_1000_short_texts]).filter((value) => value > 0);
const expectedSummary = {
  public_numeric_vendor_count: numericOffers.length,
  quote_or_dynamic_vendor_count: catalog.offers.length - numericOffers.length,
  public_base_low_cny: Math.min(...baseValues),
  public_base_nonzero_low_cny: Math.min(...nonzeroLows),
  public_base_mean_cny: baseValues.reduce((sum, value) => sum + value, 0) / baseValues.length,
  public_base_high_cny: Math.max(...baseValues)
};
for (const [field, expected] of Object.entries(expectedSummary)) {
  const actual = catalog.summary[field];
  if (Number.isInteger(expected) ? actual !== expected : !close(actual, expected)) {
    errors.push(`summary ${field}=${actual} does not match computed ${expected}`);
  }
}

const csvRows = parseCsv(csvText);
if (csvRows.length !== catalog.offers.length) errors.push(`CSV row count ${csvRows.length} does not match JSON ${catalog.offers.length}`);
const numericFields = ["normalized_cny_per_1000_short_texts", "public_low_cny", "public_mean_cny", "public_high_cny"];
for (const [index, offer] of catalog.offers.entries()) {
  const row = csvRows[index] ?? {};
  for (const field of ["vendor", "product", "pricing_status", "original_price", "billing_unit", "source_checked_at", "source_url"]) {
    if ((row[field] ?? "") !== String(offer[field] ?? "")) errors.push(`CSV row ${index + 1} differs from JSON field ${field}`);
  }
  for (const field of numericFields) {
    const csvValue = row[field] === "" ? null : Number(row[field]);
    const jsonValue = offer[field] ?? null;
    if (csvValue === null ? jsonValue !== null : !close(csvValue, jsonValue)) errors.push(`CSV row ${index + 1} differs from JSON field ${field}`);
  }
}

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`Catalog valid: ${catalog.offers.length} offers; normalized mean CNY ${expectedSummary.public_base_mean_cny.toFixed(2)}/1000 texts; USD/CNY ${exchange.rate.toFixed(4)} on ${exchange.rate_date}.`);
