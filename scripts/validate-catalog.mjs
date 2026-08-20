import fs from 'node:fs';

const file = new URL('../data/text-risk-pricing.json', import.meta.url);
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));

const errors = [];
if (!catalog.verified_at) errors.push('missing verified_at');
if (!Array.isArray(catalog.offers) || catalog.offers.length === 0) errors.push('offers must be non-empty');

const verifiedAt = new Date(`${catalog.verified_at}T00:00:00Z`);
const ageDays = (Date.now() - verifiedAt.getTime()) / 86_400_000;
if (!Number.isFinite(ageDays)) errors.push('verified_at must be an ISO date');
if (ageDays > 45) errors.push(`catalog is stale: ${Math.floor(ageDays)} days since verification`);
if (ageDays < -1) errors.push('verified_at cannot be in the future');

const allowed = new Set([
  'public',
  'public_tiered',
  'public_region_specific',
  'dynamic_console',
  'quote_required'
]);

for (const [index, offer] of (catalog.offers || []).entries()) {
  const label = `offers[${index}]`;
  for (const field of ['vendor', 'product', 'pricing_status', 'original_price', 'source_url']) {
    if (!offer[field]) errors.push(`${label}: missing ${field}`);
  }
  if (!allowed.has(offer.pricing_status)) errors.push(`${label}: invalid pricing_status`);
  if (!String(offer.source_url || '').startsWith('https://')) errors.push(`${label}: source_url must use https`);
  const numeric = offer.normalized_cny_per_1000_short_texts;
  const isPublic = offer.pricing_status.startsWith('public');
  if (isPublic && !(typeof numeric === 'number' && numeric >= 0)) {
    errors.push(`${label}: public offer requires a non-negative normalized price`);
  }
  if (!isPublic && numeric !== null) {
    errors.push(`${label}: non-public offer must not invent a normalized price`);
  }
}

const numericOffers = catalog.offers.filter((offer) => typeof offer.normalized_cny_per_1000_short_texts === 'number');
const mean = numericOffers.reduce((sum, offer) => sum + offer.normalized_cny_per_1000_short_texts, 0) / numericOffers.length;
if (Math.abs(mean - catalog.summary.public_base_mean_cny) > 0.005) {
  errors.push(`summary mean ${catalog.summary.public_base_mean_cny} does not match computed ${mean.toFixed(2)}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Catalog valid: ${catalog.offers.length} offers; normalized mean CNY ${mean.toFixed(2)}/1000 texts.`);
