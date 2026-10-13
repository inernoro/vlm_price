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

  if (!visible.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty-row">没有符合条件的模型</td></tr>';
    return;
  }

  const max = Math.max(...vlmRows.map((row) => row.cny_per_1000));
  body.innerHTML = visible.map((row) => `
    <tr>
      <td><span class="model-name">${row.name}</span><span class="model-position">${row.position}</span></td>
      <td>${row.input_usd_per_million.toFixed(3)} / ${row.output_usd_per_million.toFixed(3)}</td>
      <td class="price-cell"><strong>${formatPrice(row.cny_per_1000)}</strong></td>
      <td><span class="status-pill ${statusClass(row.lab_status)}">${row.lab_status}</span></td>
      <td><div class="cost-bar" title="${formatPrice(row.cny_per_1000)}"><i style="width:${Math.max(1, row.cny_per_1000 / max * 100)}%"></i></div></td>
    </tr>
  `).join("");
}

function renderTextRisk(data) {
  const summary = data.summary;
  document.querySelector("#verified-date").textContent = `文本报价核验：${data.verified_at}`;
  document.querySelector("#text-range").textContent = `${formatPrice(summary.public_base_low_cny, 0)}–${formatPrice(summary.public_base_high_cny)}`;
  document.querySelector("#text-mean").textContent = formatPrice(summary.public_base_mean_cny);
  document.querySelector("#text-floor").textContent = formatPrice(summary.public_base_nonzero_low_cny);
  document.querySelector("#public-count").textContent = summary.public_numeric_vendor_count;
  document.querySelector("#quote-count").textContent = summary.quote_or_dynamic_vendor_count;

  const grid = document.querySelector("#text-vendor-grid");
  const max = Math.max(...data.offers.map((offer) => offer.public_high_cny || 0));
  grid.innerHTML = data.offers.map((offer) => {
    const hasPrice = typeof offer.normalized_cny_per_1000_short_texts === "number";
    const state = offer.pricing_status === "quote_required"
      ? ["quote", "商务询价"]
      : offer.pricing_status === "public_reference"
        ? ["reference", "官方参考"]
        : ["", "公开可复核"];
    const range = hasPrice
      ? `${formatPrice(offer.public_low_cny ?? offer.normalized_cny_per_1000_short_texts)}–${formatPrice(offer.public_high_cny ?? offer.normalized_cny_per_1000_short_texts)}`
      : "暂无公开数字";
    const width = hasPrice ? Math.max(2, (offer.public_high_cny || offer.normalized_cny_per_1000_short_texts) / max * 100) : 0;
    return `
      <article class="vendor-card">
        <div class="vendor-top">
          <div><h3 class="vendor-name">${offer.vendor}</h3><p class="vendor-product">${offer.product}</p></div>
          <a class="source-link" href="${offer.source_url}" target="_blank" rel="noreferrer" aria-label="查看 ${offer.vendor} 官方来源">↗</a>
        </div>
        <div class="vendor-price">
          <span>统一基础价</span>
          <strong>${hasPrice ? formatPrice(offer.normalized_cny_per_1000_short_texts) : "询价"}<small>${hasPrice ? " / 1000 条" : ""}</small></strong>
          <div class="range-track"><i style="width:${width}%"></i></div>
          <div class="vendor-meta"><span>${range}</span><span class="vendor-state ${state[0]}">${state[1]}</span></div>
        </div>
      </article>
    `;
  }).join("");
}

async function loadData() {
  try {
    const [vlm, text] = await Promise.all([
      fetch("./data/live-pricing.json").then((response) => {
        if (!response.ok) throw new Error("VLM 数据读取失败");
        return response.json();
      }),
      fetch("./data/text-risk-pricing.json").then((response) => {
        if (!response.ok) throw new Error("文本报价读取失败");
        return response.json();
      })
    ]);
    vlmRows = vlm.rows;
    document.querySelector("#vlm-ratio").textContent = `${(vlm.ceiling.cny_per_1000 / vlm.floor.cny_per_1000).toFixed(1)}×`;
    renderVlm();
    renderTextRisk(text);
  } catch (error) {
    document.querySelector("#vlm-table-body").innerHTML = `<tr><td colspan="5" class="empty-row">${error.message}</td></tr>`;
    document.querySelector("#text-vendor-grid").innerHTML = `<p class="loading-card">${error.message}</p>`;
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
