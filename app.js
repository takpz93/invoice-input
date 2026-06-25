/* global CONFIG, state */

const STORAGE_PREFIX = "invoice-extras-";

let CONFIG = null;
let state = {
  shootDays: [],
  extras: [],
  manualVideos: [],
  meta: { gasYen: 164, fuelKmPerL: 21, note: "" },
};

async function init() {
  const res = await fetch("data/config.json");
  CONFIG = await res.json();
  bindGlobal();
  const ym = document.getElementById("year-month").value;
  await loadMonth(ym);
}

function bindGlobal() {
  document.getElementById("year-month").addEventListener("change", (e) => loadMonth(e.target.value));
  document.getElementById("btn-load").addEventListener("click", () => loadMonth(document.getElementById("year-month").value, { forceFile: true }));
  document.getElementById("btn-export").addEventListener("click", exportJSON);
  document.getElementById("btn-export-bottom")?.addEventListener("click", exportJSON);
  document.getElementById("btn-add-extra-bottom")?.addEventListener("click", () => {
    addExtraRow();
    document.getElementById("panel-extra")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("import-file").addEventListener("change", importJSON);
  document.getElementById("btn-add-shoot").addEventListener("click", () => addShootRow());
  document.getElementById("btn-add-extra").addEventListener("click", () => addExtraRow());
  document.getElementById("btn-add-manual").addEventListener("click", () => addManualRow());
  document.getElementById("gas-yen").addEventListener("input", onSettingsChange);
  document.getElementById("fuel-km").addEventListener("input", onSettingsChange);
  document.getElementById("meta-note").addEventListener("input", onSettingsChange);
}

function ymToFile(ym) {
  return `data/extras-${ym}.json`;
}

async function loadMonth(ym, { forceFile = false } = {}) {
  let serverData = null;
  try {
    const res = await fetch(`${ymToFile(ym)}?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) serverData = await res.json();
  } catch (_) { /* noop */ }

  if (!forceFile) {
    const localRaw = localStorage.getItem(STORAGE_PREFIX + ym);
    if (localRaw && serverData) {
      const localData = JSON.parse(localRaw);
      const localTs = Date.parse(localData._meta?.updatedAt || 0) || 0;
      const serverTs = Date.parse(serverData._meta?.updatedAt || 0) || 0;
      if (localTs > serverTs) {
        applyData(localData);
        setStatus("ローカル保存から読込（サーバーより新しい）");
        return;
      }
    } else if (localRaw && !serverData) {
      applyData(JSON.parse(localRaw));
      setStatus("ローカル保存から読込");
      return;
    }
  }

  if (serverData) {
    applyData(serverData);
    localStorage.setItem(STORAGE_PREFIX + ym, JSON.stringify(serverData));
    setStatus(forceFile ? "サーバーから読込" : "最新データを読込");
    return;
  }
  applyData(emptyData(ym));
  setStatus("新規");
}

function emptyData(ym) {
  return {
    _meta: { yearMonth: ym, updatedAt: new Date().toISOString(), gasYen: CONFIG.defaults.gasYen, fuelKmPerL: CONFIG.defaults.fuelKmPerL, note: "" },
    shootDays: [],
    manualVideos: [],
    extras: [],
  };
}

function applyData(data) {
  state.shootDays = data.shootDays || [];
  state.extras = data.extras || [];
  state.manualVideos = data.manualVideos || [];
  state.meta = {
    gasYen: data._meta?.gasYen ?? CONFIG.defaults.gasYen,
    fuelKmPerL: data._meta?.fuelKmPerL ?? CONFIG.defaults.fuelKmPerL,
    note: data._meta?.note ?? "",
  };
  document.getElementById("gas-yen").value = state.meta.gasYen;
  document.getElementById("fuel-km").value = state.meta.fuelKmPerL;
  document.getElementById("meta-note").value = state.meta.note;
  renderAll();
}

function collectData() {
  const ym = document.getElementById("year-month").value;
  return {
    _meta: {
      yearMonth: ym,
      updatedAt: new Date().toISOString(),
      gasYen: Number(document.getElementById("gas-yen").value) || 164,
      fuelKmPerL: Number(document.getElementById("fuel-km").value) || 21,
      note: document.getElementById("meta-note").value.trim(),
    },
    shootDays: readShootTable(),
    extras: readExtraTable(),
    manualVideos: readManualTable(),
  };
}

function persist() {
  const data = collectData();
  localStorage.setItem(STORAGE_PREFIX + data._meta.yearMonth, JSON.stringify(data));
  setStatus("保存済み", true);
  renderSummary(data);
}

function onSettingsChange() {
  persist();
}

function setStatus(text, saved = false) {
  const el = document.getElementById("save-status");
  el.textContent = text;
  el.classList.toggle("saved", saved);
}

function clientOptions(selected = "") {
  return CONFIG.clients.map((c) =>
    `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${c.invoiceName.replace("　様", "")}</option>`
  ).join("");
}

function lineTypeOptions(selected = "") {
  return CONFIG.extraLineTypes.map((t) =>
    `<option value="${t.id}" ${t.id === selected ? "selected" : ""}>${t.category} — ${t.label}</option>`
  ).join("");
}

function manualTypeOptions(selected = "") {
  return CONFIG.manualVideoTypes.map((t) =>
    `<option value="${t.id}" ${t.id === selected ? "selected" : ""}>${t.category}</option>`
  ).join("");
}

// ---- Shoot days ----

function renderShootTable() {
  const body = document.getElementById("shoot-body");
  body.innerHTML = "";
  state.shootDays.forEach((row, i) => addShootRow(row, i));
  if (!state.shootDays.length) addShootRow();
}

function addShootRow(data = {}, index = null) {
  const tpl = document.getElementById("tpl-shoot-row");
  const tr = tpl.content.firstElementChild.cloneNode(true);
  const sel = tr.querySelector('[data-field="clientId"]');
  sel.innerHTML = `<option value="">選択</option>` + clientOptions(data.clientId);
  tr.querySelector('[data-field="date"]').value = data.date || "";
  tr.querySelector('[data-field="hours"]').value = data.hours ?? "";
  tr.querySelector('[data-field="note"]').value = data.note || "";
  tr.querySelector(".btn-del").addEventListener("click", () => { tr.remove(); persist(); });
  tr.querySelectorAll("input,select").forEach((el) => el.addEventListener("change", persist));
  document.getElementById("shoot-body").appendChild(tr);
}

function readShootTable() {
  return [...document.querySelectorAll("#shoot-body tr")].map((tr) => ({
    date: tr.querySelector('[data-field="date"]').value.trim(),
    clientId: tr.querySelector('[data-field="clientId"]').value,
    hours: tr.querySelector('[data-field="hours"]').value ? Number(tr.querySelector('[data-field="hours"]').value) : null,
    note: tr.querySelector('[data-field="note"]').value.trim(),
  })).filter((r) => r.date && r.clientId);
}

// ---- Extras ----

function tripMultiplier(row) {
  if (row.tripType === "roundtrip") return 2;
  return 1;
}

function migrateTripRow(row, lt) {
  if (!lt?.tripMode || row.tripType) return row;
  const note = row.note || "";
  const m = note.match(/片道\s*([\d.]+)\s*km/i);
  if (m && row.distanceKm != null) {
    return { ...row, distanceKm: parseFloat(m[1]), tripType: "roundtrip" };
  }
  return { ...row, tripType: "oneway" };
}

function buildTripSelect(row, lt) {
  const r = migrateTripRow(row, lt);
  const mode = r.tripType || "roundtrip";
  return `
    <div class="tax-mode-row">
      <label class="tax-mode-label">往復</label>
      <select data-sub="tripType">
        <option value="oneway" ${mode === "oneway" ? "selected" : ""}>片道</option>
        <option value="roundtrip" ${mode === "roundtrip" ? "selected" : ""}>往復</option>
      </select>
    </div>`;
}

function toTaxExcl(row) {
  if (row.amount != null && row.taxMode) {
    return row.taxMode === "incl" ? Math.round(row.amount / 1.1) : Math.round(row.amount);
  }
  if (row.amountIncl != null) return Math.round(row.amountIncl / 1.1);
  if (row.amountExcl != null) return Math.round(row.amountExcl);
  return null;
}

function normalizeExtraRow(row, lt) {
  if (row.amount != null || row.taxMode) return row;
  if (row.amountIncl != null) return { ...row, taxMode: "incl", amount: row.amountIncl };
  if (row.amountExcl != null) return { ...row, taxMode: "excl", amount: row.amountExcl };
  if (lt?.defaultAmount != null && lt.input === "amount") {
    return { ...row, taxMode: lt.defaultTaxMode || "excl", amount: lt.defaultAmount };
  }
  return { ...row, taxMode: lt?.defaultTaxMode || "excl" };
}

function tripTypeLabel(tripType) {
  return tripType === "roundtrip" ? "（往復）" : "（片道）";
}

function calcGasExcl(distanceKm, tripType, gasYen, fuelKm) {
  const km = distanceKm * tripMultiplier({ tripType });
  return Math.floor(Math.round((km / fuelKm) * gasYen) / 1.1);
}

function calcCarDriveBreakdown(row, gasYen, fuelKm) {
  const lt = CONFIG.extraLineTypes.find((t) => t.id === row.lineType);
  if (!lt || lt.input !== "carDrive") return { lines: [], total: null };
  const r = migrateTripRow(normalizeExtraRow(row, lt), lt);
  const lines = [];
  if (r.highway) {
    if (r.amount != null) {
      const etc = toTaxExcl({ ...r, amount: r.amount });
      if (etc != null) lines.push({ label: "ETC", amount: etc });
    }
    if (r.distanceKm != null) {
      const mult = tripMultiplier(r);
      const km = r.distanceKm * mult;
      const trip = tripTypeLabel(r.tripType);
      lines.push({ label: `ガソリン${trip}`, amount: calcGasExcl(r.distanceKm, r.tripType, gasYen, fuelKm), km, trip });
    }
  }
  const total = lines.length ? lines.reduce((s, l) => s + l.amount, 0) : null;
  return { lines, total };
}

function calcExtraAmount(row, gasYen, fuelKm) {
  const lt = CONFIG.extraLineTypes.find((t) => t.id === row.lineType);
  if (!lt) return null;
  if (lt.input === "carDrive") return calcCarDriveBreakdown(row, gasYen, fuelKm).total;
  const r = migrateTripRow(normalizeExtraRow(row, lt), lt);
  const mult = lt.tripMode ? tripMultiplier(r) : 1;
  if (lt.input === "amount") {
    if (r.amount == null) return null;
    return toTaxExcl({ ...r, amount: r.amount * mult });
  }
  if (lt.input === "distanceKm" && r.distanceKm != null) {
    const mult = tripMultiplier(r);
    const km = r.distanceKm * mult;
    return Math.floor(Math.round((km / fuelKm) * gasYen) / 1.1);
  }
  if (lt.input === "custom") {
    const amt = toTaxExcl(r);
    return amt;
  }
  if (lt.input === "postDate" && lt.defaultAmount) return lt.defaultAmount;
  return null;
}

function buildAmountInput(row, lt) {
  const r = normalizeExtraRow(row, lt);
  const mode = r.taxMode || lt.defaultTaxMode || "excl";
  const val = r.amount ?? "";
  const trip = lt.tripMode ? buildTripSelect(row, lt) : "";
  const tripHint = lt.tripMode ? '<span class="mini-hint tax-hint">片道の料金を入力。往復なら×2</span>' : "";
  return `
    ${trip}
    <div class="tax-mode-row">
      <label class="tax-mode-label">税区分</label>
      <select data-sub="taxMode">
        <option value="incl" ${mode === "incl" ? "selected" : ""}>税込</option>
        <option value="excl" ${mode === "excl" ? "selected" : ""}>税抜</option>
      </select>
    </div>
    <input type="number" data-sub="amount" placeholder="${mode === "incl" ? "税込金額（片道）" : "税抜金額（片道）"}" min="0" inputmode="numeric" value="${val}">
    <span class="mini-hint tax-hint">${mode === "incl" ? "税込 → 税抜に自動変換（÷1.1）" : "税抜のまま請求書に反映"}</span>
    ${tripHint}`;
}

function buildCarDriveInput(row, lt) {
  const r = migrateTripRow(normalizeExtraRow(row, lt), lt);
  const trip = buildTripSelect(r, lt);
  const mode = r.taxMode || lt.defaultTaxMode || "incl";
  const highway = row.highway !== false;
  const dist = r.distanceKm ?? "";
  const etcVal = r.amount ?? "";
  return `
    ${trip}
    <input type="number" data-sub="distanceKm" placeholder="片道 km" min="0" step="0.1" inputmode="decimal" value="${dist}">
    <label class="check-row">
      <input type="checkbox" data-sub="highway" ${highway ? "checked" : ""}>
      <span>高速利用（ETC＋ガソリン代を自動計上）</span>
    </label>
    <div class="highway-fields" data-sub="highwayFields" ${highway ? "" : "hidden"}>
      <div class="tax-mode-row">
        <label class="tax-mode-label">ETC税区分</label>
        <select data-sub="taxMode">
          <option value="incl" ${mode === "incl" ? "selected" : ""}>税込</option>
          <option value="excl" ${mode === "excl" ? "selected" : ""}>税抜</option>
        </select>
      </div>
      <input type="number" data-sub="amount" placeholder="${mode === "incl" ? "ETC料金（税込）" : "ETC料金（税抜）"}" min="0" inputmode="numeric" value="${etcVal}">
      <span class="mini-hint">ETCは領収の実額。距離は片道km＋往復でガソリン代を自動計算（請求書に別行追加）</span>
    </div>`;
}

function buildExtraInputCell(lt, row) {
  const wrap = document.createElement("div");
  wrap.className = "extra-input-wrap";
  if (lt.input === "amount") {
    wrap.innerHTML = buildAmountInput(row, lt);
    const taxSel = wrap.querySelector('[data-sub="taxMode"]');
    const amtInp = wrap.querySelector('[data-sub="amount"]');
    const hint = wrap.querySelector(".tax-hint");
    taxSel.addEventListener("change", () => {
      const incl = taxSel.value === "incl";
      amtInp.placeholder = incl ? "税込金額" : "税抜金額";
      hint.textContent = incl ? "税込 → 税抜に自動変換（÷1.1）" : "税抜のまま請求書に反映";
    });
  } else if (lt.input === "carDrive") {
    wrap.innerHTML = buildCarDriveInput(row, lt);
    const hwCheck = wrap.querySelector('[data-sub="highway"]');
    const hwFields = wrap.querySelector('[data-sub="highwayFields"]');
    hwCheck.addEventListener("change", () => {
      hwFields.hidden = !hwCheck.checked;
    });
  } else if (lt.input === "distanceKm") {
    const r = migrateTripRow(row, lt);
    const trip = buildTripSelect(r, lt);
    wrap.innerHTML = `${trip}
      <input type="number" data-sub="distanceKm" placeholder="片道 km" min="0" step="0.1" inputmode="decimal" value="${r.distanceKm ?? row.distanceKm ?? ""}">
      <span class="mini-hint">${lt.hint || "片道km → 往復なら×2して税抜ガソリン代を計算"}</span>`;
  } else if (lt.input === "postDate") {
    wrap.innerHTML = `<input type="text" data-sub="postDate" placeholder="M/D" inputmode="numeric" value="${row.postDate || ""}"><span class="mini-hint">${lt.hint || ""}</span>`;
  } else if (lt.input === "custom") {
    const r = normalizeExtraRow(row, lt);
    wrap.innerHTML = `
      <input type="text" data-sub="customCategory" placeholder="カテゴリ" value="${row.customCategory || ""}">
      <input type="text" data-sub="customLabel" placeholder="明細" value="${row.customLabel || ""}">
      <div class="tax-mode-row">
        <label class="tax-mode-label">税区分</label>
        <select data-sub="taxMode">
          <option value="incl" ${r.taxMode === "incl" ? "selected" : ""}>税込</option>
          <option value="excl" ${r.taxMode === "excl" ? "selected" : ""}>税抜</option>
        </select>
      </div>
      <input type="number" data-sub="amount" placeholder="金額" min="0" inputmode="numeric" value="${r.amount ?? ""}">`;
  }
  return wrap;
}

function renderExtraTable() {
  const body = document.getElementById("extra-body");
  body.innerHTML = "";
  state.extras.forEach((row) => addExtraRow(row));
  if (!state.extras.length) addExtraRow();
}

function addExtraRow(data = {}) {
  const tpl = document.getElementById("tpl-extra-row");
  const tr = tpl.content.firstElementChild.cloneNode(true);
  const clientSel = tr.querySelector('[data-field="clientId"]');
  clientSel.innerHTML = `<option value="">選択</option>` + clientOptions(data.clientId);
  const typeSel = tr.querySelector('[data-field="lineType"]');
  typeSel.innerHTML = lineTypeOptions(data.lineType || "car_drive");

  const inputCell = tr.querySelector('[data-field="input"]');
  const amountCell = tr.querySelector('[data-field="amountExcl"]');

  function refreshInput() {
    const lt = CONFIG.extraLineTypes.find((t) => t.id === typeSel.value);
    inputCell.innerHTML = "";
    if (lt) inputCell.appendChild(buildExtraInputCell(lt, data));
    updateAmount();
    inputCell.querySelectorAll("input, select").forEach((el) => el.addEventListener("input", () => { updateAmount(); persist(); }));
    inputCell.querySelectorAll("select").forEach((el) => el.addEventListener("change", () => { updateAmount(); persist(); }));
  }

  function updateAmount() {
    const row = readExtraRow(tr);
    const gasYen = Number(document.getElementById("gas-yen").value) || 164;
    const fuelKm = Number(document.getElementById("fuel-km").value) || 21;
    const lt = CONFIG.extraLineTypes.find((t) => t.id === row.lineType);
    if (lt?.input === "carDrive") {
      const bd = calcCarDriveBreakdown(row, gasYen, fuelKm);
      if (bd.lines.length) {
        amountCell.innerHTML = bd.lines.map((l) => {
          const km = l.km != null ? ` <span class="km-tag">${l.km}km</span>` : "";
          return `<div class="amt-line"><span class="amt-label">${l.label}${km}</span><span>¥${l.amount.toLocaleString()}</span></div>`;
        }).join("") + `<div class="amt-total">計 ¥${bd.total.toLocaleString()}</div>`;
      } else {
        amountCell.textContent = "—";
      }
      return;
    }
    if (lt?.input === "distanceKm" && row.distanceKm != null) {
      const r = migrateTripRow(row, lt);
      const km = r.distanceKm * tripMultiplier(r);
      const amt = calcExtraAmount(row, gasYen, fuelKm);
      amountCell.innerHTML = amt != null
        ? `<div class="amt-line"><span class="amt-label">ガソリン${tripTypeLabel(r.tripType)} ${km}km</span><span>¥${amt.toLocaleString()}</span></div>`
        : "—";
      return;
    }
    amountCell.innerHTML = "";
    const amt = calcExtraAmount(row, gasYen, fuelKm);
    amountCell.textContent = amt != null ? `¥${amt.toLocaleString()}` : "—";
  }

  typeSel.addEventListener("change", () => { refreshInput(); persist(); });
  tr.querySelector('[data-field="shootDate"]').value = data.shootDate || "";
  const noteInp = tr.querySelector('[data-field="note"]');
  noteInp.value = data.note || "";
  noteInp.placeholder = "経路";
  noteInp.closest("td")?.setAttribute("data-label", "経路");
  tr.querySelector(".btn-del").addEventListener("click", () => { tr.remove(); persist(); });
  tr.querySelectorAll('[data-field="shootDate"], [data-field="note"], [data-field="clientId"]').forEach((el) => {
    el.addEventListener("change", persist);
    el.addEventListener("input", persist);
  });

  refreshInput();
  document.getElementById("extra-body").appendChild(tr);
}

function readExtraRow(tr) {
  const lineType = tr.querySelector('[data-field="lineType"]').value;
  const lt = CONFIG.extraLineTypes.find((t) => t.id === lineType);
  const row = {
    clientId: tr.querySelector('[data-field="clientId"]').value,
    lineType,
    shootDate: tr.querySelector('[data-field="shootDate"]').value.trim(),
    note: tr.querySelector('[data-field="note"]').value.trim(),
  };
  const inputCell = tr.querySelector('[data-field="input"]');
  if (lt?.tripMode) {
    row.tripType = inputCell.querySelector('[data-sub="tripType"]')?.value || "roundtrip";
  }
  if (lt?.input === "carDrive") {
    const v = inputCell.querySelector('[data-sub="distanceKm"]')?.value;
    row.distanceKm = v ? Number(v) : null;
    row.highway = inputCell.querySelector('[data-sub="highway"]')?.checked ?? false;
    row.taxMode = inputCell.querySelector('[data-sub="taxMode"]')?.value || lt.defaultTaxMode || "incl";
    const av = inputCell.querySelector('[data-sub="amount"]')?.value;
    row.amount = av !== "" && av != null ? Number(av) : null;
  } else if (lt?.input === "amount" || lt?.input === "custom") {
    row.taxMode = inputCell.querySelector('[data-sub="taxMode"]')?.value || lt.defaultTaxMode || "excl";
    const v = inputCell.querySelector('[data-sub="amount"]')?.value;
    row.amount = v !== "" && v != null ? Number(v) : null;
  } else if (lt?.input === "distanceKm") {
    const v = inputCell.querySelector('[data-sub="distanceKm"]')?.value;
    row.distanceKm = v ? Number(v) : null;
  } else if (lt?.input === "postDate") {
    row.postDate = inputCell.querySelector('[data-sub="postDate"]')?.value.trim() || "";
  }
  if (lt?.input === "custom") {
    row.customCategory = inputCell.querySelector('[data-sub="customCategory"]')?.value.trim() || "";
    row.customLabel = inputCell.querySelector('[data-sub="customLabel"]')?.value.trim() || "";
  }
  return row;
}

function readExtraTable() {
  return [...document.querySelectorAll("#extra-body tr")]
    .map(readExtraRow)
    .filter((r) => r.clientId && r.lineType);
}

// ---- Manual videos ----

function renderManualTable() {
  const body = document.getElementById("manual-body");
  body.innerHTML = "";
  state.manualVideos.forEach((row) => addManualRow(row));
  if (!state.manualVideos.length) addManualRow();
}

function addManualRow(data = {}) {
  const tpl = document.getElementById("tpl-manual-row");
  const tr = tpl.content.firstElementChild.cloneNode(true);
  tr.querySelector('[data-field="clientId"]').innerHTML = `<option value="">選択</option>` + clientOptions(data.clientId);
  const typeSel = tr.querySelector('[data-field="type"]');
  typeSel.innerHTML = manualTypeOptions(data.type || "main");
  tr.querySelector('[data-field="postDate"]').value = data.postDate || "";
  const priceCell = tr.querySelector('[data-field="price"]');

  function updatePrice() {
    const mt = CONFIG.manualVideoTypes.find((t) => t.id === typeSel.value);
    priceCell.textContent = mt ? `¥${mt.price.toLocaleString()}` : "—";
  }
  typeSel.addEventListener("change", () => { updatePrice(); persist(); });
  updatePrice();

  tr.querySelector(".btn-del").addEventListener("click", () => { tr.remove(); persist(); });
  tr.querySelectorAll("input,select").forEach((el) => el.addEventListener("change", persist));
  document.getElementById("manual-body").appendChild(tr);
}

function readManualTable() {
  return [...document.querySelectorAll("#manual-body tr")].map((tr) => ({
    clientId: tr.querySelector('[data-field="clientId"]').value,
    type: tr.querySelector('[data-field="type"]').value,
    postDate: tr.querySelector('[data-field="postDate"]').value.trim(),
  })).filter((r) => r.clientId && r.postDate);
}

// ---- Summary ----

function renderSummary(data = collectData()) {
  const gasYen = data._meta.gasYen;
  const fuelKm = data._meta.fuelKmPerL;
  const byClient = {};

  for (const ex of data.extras) {
    const amt = calcExtraAmount(ex, gasYen, fuelKm);
    if (amt == null) continue;
    const c = CONFIG.clients.find((x) => x.id === ex.clientId);
    const name = c?.invoiceName.replace("　様", "") || ex.clientId;
    byClient[name] = (byClient[name] || 0) + amt;
  }
  for (const mv of data.manualVideos) {
    const mt = CONFIG.manualVideoTypes.find((t) => t.id === mv.type);
    if (!mt) continue;
    const c = CONFIG.clients.find((x) => x.id === mv.clientId);
    const name = c?.invoiceName.replace("　様", "") || mv.clientId;
    byClient[name] = (byClient[name] || 0) + mt.price;
  }

  let html = "<table><thead><tr><th>クライアント</th><th>追加分（税抜）</th></tr></thead><tbody>";
  let total = 0;
  for (const [name, amt] of Object.entries(byClient).sort()) {
    html += `<tr><td>${name}</td><td>¥${amt.toLocaleString()}</td></tr>`;
    total += amt;
  }
  html += `<tr class="total"><td>合計（この画面分のみ）</td><td>¥${total.toLocaleString()}</td></tr></tbody></table>`;
  html += `<p class="hint" style="margin-top:8px">動画本数は RSS 取得分と合算されます。請求書生成: <code>python scripts/build_invoice.py ${data._meta.yearMonth}</code></p>`;
  document.getElementById("summary-content").innerHTML = html;
}

function renderAll() {
  renderShootTable();
  renderExtraTable();
  renderManualTable();
  renderSummary(collectData());
}

// ---- Import / Export ----

function exportJSON() {
  const data = collectData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `extras-${data._meta.yearMonth}.json`;
  a.click();
  setStatus("エクスポート済み — data/ に配置してください", true);
}

function importJSON(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data._meta?.yearMonth) document.getElementById("year-month").value = data._meta.yearMonth;
      applyData(data);
      persist();
      setStatus("インポート済み", true);
    } catch (err) {
      alert("JSONの読み込みに失敗しました: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

init();
