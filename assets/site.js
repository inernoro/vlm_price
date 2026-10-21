const formatPrice = (value, digits = 2) => {
  if (value === null || value === undefined) return "询价";
  const fixed = Number(value).toFixed(digits).replace(/\.00$/, "");
  return `¥${fixed}`;
};

const statusClass = (status = "") => {
  if (status.includes("误判")) return "is-risk";
  if (status.includes("正确")) return "is-correct";
  return "";
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const safeHttpUrl = (value) => {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
};

let vlmRows = [];
let vlmFilter = "all";

function renderVlm() {
  const body = document.querySelector("#vlm-table-body");
  const query = document.querySelector("#vlm-search").value.trim().toLowerCase();
  const visible = vlmRows.filter((row) => {
    const matchesSearch = `${row.name} ${row.id} ${row.position}`.toLowerCase().includes(query);
    if (!matchesSearch) return false;
    if (vlmFilter === "tested") return !row.lab_status.includes("待复测");
    if (vlmFilter === "correct") return row.lab_status.includes("正确");
    return true;
  });

  document.querySelector("#vlm-count").textContent = `${visible.length} / ${vlmRows.length} 条结果`;
  if (!visible.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty-row">没有符合条件的模型</td></tr>';
    return;
  }

  const max = Math.max(...vlmRows.map((row) => row.cny_per_1000));
  body.innerHTML = visible.map((row) => `
    <tr>
      <td><span class="model-name">${escapeHtml(row.name)}</span><span class="model-position">${escapeHtml(row.position)}</span></td>
      <td>${row.input_usd_per_million.toFixed(3)} / ${row.output_usd_per_million.toFixed(3)}</td>
      <td class="price-cell"><strong>${formatPrice(row.cny_per_1000)}</strong></td>
      <td><span class="status-pill ${statusClass(row.lab_status)}">${escapeHtml(row.lab_status)}</span></td>
      <td><div class="cost-bar" title="${formatPrice(row.cny_per_1000)}"><i style="width:${Math.max(1, row.cny_per_1000 / max * 100)}%"></i></div></td>
    </tr>
  `).join("");
}

function parseBenchmark(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  const cnyIndex = headers.indexOf("cny_per_1000_at_6_7313");
  const resultIndex = headers.indexOf("result");
  const accepted = new Set(["correct", "correct_on_retry"]);
  const correct = lines.map((line) => line.split(","))
    .filter((row) => accepted.has(row[resultIndex]))
    .map((row) => Number(row[cnyIndex]));
  return {
    count: correct.length,
    low: Math.min(...correct),
    high: Math.max(...correct),
    mean: correct.reduce((sum, value) => sum + value, 0) / correct.length
  };
}

function renderSnapshot(vlm, text, benchmark) {
  const rate = vlm.workload.usd_cny;
  const rateDate = vlm.workload.exchange_rate_date;
  document.querySelector("#fx-rate").textContent = `USD/CNY ${rate.toFixed(4)}`;
  document.querySelector("#fx-date").textContent = rateDate;
  document.querySelector("#fx-source").href = safeHttpUrl(vlm.workload.exchange_rate_source);
  document.querySelector("#verified-date").textContent = `报价 ${text.verified_at}`;

  document.querySelector("#lab-range").textContent = `${formatPrice(benchmark.low)}—${formatPrice(benchmark.high)}`;
  document.querySelector("#lab-range-label").textContent = `${formatPrice(benchmark.low)}—${formatPrice(benchmark.high)}`;
  document.querySelector("#lab-mean").textContent = formatPrice(benchmark.mean);
  document.querySelector("#lab-count").textContent = benchmark.count;
  document.querySelector("#vlm-total").textContent = vlm.rows.length;
  document.querySelector("#vlm-scale-max").textContent = formatPrice(vlm.ceiling.cny_per_1000, 0);
  document.querySelector("#catalog-range-label").textContent = `${formatPrice(vlm.floor.cny_per_1000)}—${formatPrice(vlm.ceiling.cny_per_1000)}`;
  document.querySelector("#vlm-lab-band").style.width = `${benchmark.high / vlm.ceiling.cny_per_1000 * 100}%`;
  document.querySelector("#vlm-ratio").textContent = `${(vlm.ceiling.cny_per_1000 / vlm.floor.cny_per_1000).toFixed(1)}×`;

  const summary = text.summary;
  document.querySelector("#text-range").textContent = `${formatPrice(summary.public_base_low_cny, 0)}—${formatPrice(summary.public_base_high_cny)}`;
  document.querySelector("#text-low").textContent = formatPrice(summary.public_base_low_cny, 0);
  document.querySelector("#text-mean").textContent = formatPrice(summary.public_base_mean_cny);
  document.querySelector("#text-high").textContent = formatPrice(summary.public_base_high_cny);
  document.querySelector("#text-floor").textContent = formatPrice(summary.public_base_nonzero_low_cny);
  document.querySelector("#text-section-mean").textContent = formatPrice(summary.public_base_mean_cny);
  document.querySelector("#public-count").textContent = summary.public_numeric_vendor_count;
  document.querySelector("#quote-count").textContent = summary.quote_or_dynamic_vendor_count;
}

function renderTextRisk(data) {
  const body = document.querySelector("#text-vendor-body");
  body.innerHTML = data.offers.map((offer) => {
    const hasPrice = typeof offer.normalized_cny_per_1000_short_texts === "number";
    const state = offer.pricing_status === "quote_required"
      ? ["quote", "商务询价"]
      : offer.pricing_status === "dynamic_console"
        ? ["dynamic", "控制台核价"]
      : offer.pricing_status === "public_reference"
        ? ["reference", "官方参考"]
        : ["", "公开可复核"];
    const low = offer.public_low_cny ?? offer.normalized_cny_per_1000_short_texts;
    const mean = offer.public_mean_cny ?? offer.normalized_cny_per_1000_short_texts;
    const high = offer.public_high_cny ?? offer.normalized_cny_per_1000_short_texts;
    const range = hasPrice
      ? `<div class="range-value"><span><small>低</small>${formatPrice(low)}</span><span><small>均</small>${formatPrice(mean)}</span><span><small>高</small>${formatPrice(high)}</span></div>`
      : '<span class="model-position">未公开</span>';
    return `
      <tr>
        <td><span class="vendor-name">${escapeHtml(offer.vendor)}</span><span class="vendor-product">${escapeHtml(offer.product)}</span></td>
        <td class="price-cell"><strong>${hasPrice ? formatPrice(offer.normalized_cny_per_1000_short_texts) : "询价"}</strong></td>
        <td>${range}</td>
        <td><span class="vendor-state ${state[0]}">${state[1]}</span></td>
        <td><a class="source-link" href="${safeHttpUrl(offer.source_url)}" target="_blank" rel="noreferrer" aria-label="查看 ${escapeHtml(offer.vendor)} 官方来源">官方来源 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"></path></svg></a></td>
      </tr>
    `;
  }).join("");
}

async function loadData() {
  try {
    const [vlm, text, benchmarkCsv] = await Promise.all([
      fetch("./data/live-pricing.json", { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error("VLM 数据读取失败");
        return response.json();
      }),
      fetch("./data/text-risk-pricing.json", { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error("文本报价读取失败");
        return response.json();
      }),
      fetch("./data/benchmark-results.csv", { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error("实验数据读取失败");
        return response.text();
      })
    ]);
    vlmRows = vlm.rows;
    renderVlm();
    renderTextRisk(text);
    renderSnapshot(vlm, text, parseBenchmark(benchmarkCsv));
  } catch (error) {
    document.querySelector("#vlm-table-body").innerHTML = `<tr><td colspan="5" class="empty-row">${escapeHtml(error.message)}</td></tr>`;
    document.querySelector("#text-vendor-body").innerHTML = `<tr><td colspan="5" class="empty-row">${escapeHtml(error.message)}</td></tr>`;
  }
}

document.querySelector("#vlm-search").addEventListener("input", renderVlm);
document.querySelectorAll("[data-vlm-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    vlmFilter = button.dataset.vlmFilter;
    document.querySelectorAll("[data-vlm-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
    renderVlm();
  });
});

loadData();
