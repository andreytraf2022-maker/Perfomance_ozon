const $ = (id) => document.getElementById(id);

const MONTHS = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

const DEFAULT_STATUSES = ["Активна", "Запланирована", "Приостановлена"];
const CAMP_KEYS = ["active", "planned", "paused", "inactive", "done", "other"];
const CHECK_FIELDS = ["artic", "code", "nom", "manager", "sku", "campaign"];
const COLS_KEY = "ozon-ads-table-cols";
const METRIC_COLS = [
  { id: "budget", label: "Бюджет РК, ₽", kind: "money" },
  { id: "gmv", label: "Всего заказано, ₽", kind: "money" },
  { id: "sales", label: "Заказано по рек., ₽", kind: "money" },
  { id: "expense", label: "Расход, ₽", kind: "money" },
  { id: "drr", label: "ДРР по рекл., %", kind: "pct" },
  { id: "general_drr", label: "ДРР общий, %", kind: "pct" },
  { id: "views", label: "Показы", kind: "int" },
  { id: "clicks", label: "Клики", kind: "int" },
  { id: "cpc", label: "CPC", kind: "money" },
  { id: "ctr", label: "CTR", kind: "pct" },
  { id: "to_cart", label: "Добавлено в корзину", kind: "int" },
  { id: "model_orders", label: "Модельные заказы", kind: "int" },
  { id: "model_sales", label: "Модельные продажи, ₽", kind: "money" },
  { id: "date_added", label: "Дата добавления товара", kind: "date" },
];
const STATUS_DOTS = [
  { key: "active", tone: "on", title: "Активна" },
  { key: "paused", tone: "pause", title: "Приостановлена" },
  { key: "inactive", tone: "off", title: "Неактивна" },
  { key: "planned", tone: "other", title: "Запланирована" },
  { key: "done", tone: "other", title: "Завершена" },
  { key: "other", tone: "other", title: "Без статуса" },
];
const CAMP_ORDER = [
  ["active", "pill--on", "Активна"],
  ["planned", "pill--na", "Запланирована"],
  ["paused", "pill--pause", "Приостановлена"],
  ["inactive", "pill--off", "Неактивна"],
  ["done", "pill--off", "Завершена"],
  ["other", "pill--na", "Нет статуса"],
];
const GROUP_FIELDS = ["g1", "g2", "g3"];
const TOTAL_CHART_ID = "total";
const CHART_COLORS = ["#005bff", "#16a34a", "#f59e0b", "#7c3aed", "#dc2626", "#0891b2", "#db2777", "#0f766e"];
const CHART_METRICS = METRIC_COLS.filter((c) => c.kind !== "date");
const CHART_METRICS_KEY = "ozon-ads-chart-metrics";
const CHART_COMBO = new Set(["gmv", "sales", "expense", "model_sales"]);
const CHART_DASH = { gmv: "", sales: "6 4", expense: "2 4", model_sales: "8 3 2 3" };
const CHART_ADD = ["sales", "expense", "views", "clicks", "to_cart", "model_orders", "model_sales", "budget", "gmv"];

const CHECK_LABELS = {
  artic: { empty: "Артикул", chip: "Артикул" },
  code: { empty: "Код", chip: "Код" },
  nom: { empty: "Наименование 1С", chip: "Наименование 1С" },
  manager: { empty: "Все", chip: "Менеджер OZON" },
  sku: { empty: "SKU", chip: "SKU" },
  campaign: { empty: "ID кампании", chip: "ID кампании" },
};

const GROUP_LABELS = {
  g1: { empty: "Все", chip: "Группа 1 ур." },
  g2: { empty: "Все", chip: "Группа 2 ур." },
  g3: { empty: "Все", chip: "Группа 3 ур." },
};

const emptyLists = () => ({
  artic: [],
  code: [],
  nom: [],
  manager: [],
  sku: [],
  campaign: [],
});

function isChartCombo(id) {
  return CHART_COMBO.has(id);
}

function knownChartMetricIds(ids) {
  const allow = new Set(CHART_METRICS.map((c) => c.id));
  return [...new Set((ids || []).filter((id) => allow.has(id)))];
}

function normalizeChartMetrics(ids) {
  const uniq = knownChartMetricIds(ids);
  if (!uniq.length) return ["expense"];
  if (uniq.length === 1) return uniq;
  if (uniq.every(isChartCombo)) return uniq;
  return [uniq[0]];
}

function loadChartMetrics() {
  try {
    const raw = JSON.parse(localStorage.getItem(CHART_METRICS_KEY) || "null");
    if (typeof raw === "string") return normalizeChartMetrics([raw]);
    if (Array.isArray(raw)) return normalizeChartMetrics(raw);
    if (raw && typeof raw === "object") {
      return normalizeChartMetrics(CHART_METRICS.filter((c) => raw[c.id]).map((c) => c.id));
    }
  } catch {
    /* keep default */
  }
  return ["expense"];
}

function loadCols() {
  const all = Object.fromEntries(METRIC_COLS.map((c) => [c.id, true]));
  try {
    const raw = JSON.parse(localStorage.getItem(COLS_KEY) || "null");
    if (raw && typeof raw === "object") {
      for (const c of METRIC_COLS) {
        if (typeof raw[c.id] === "boolean") all[c.id] = raw[c.id];
      }
    }
  } catch {
    /* keep defaults */
  }
  return all;
}

const state = {
  minDate: null,
  maxDate: null,
  from: null,
  to: null,
  draftFrom: null,
  draftTo: null,
  view: null,
  hover: null,
  lists: emptyLists(),
  applied: {
    statuses: [...DEFAULT_STATUSES],
    g1: [],
    g2: [],
    g3: [],
    lists: emptyLists(),
  },
  opts: { g1: [], g2: [], g3: [] },
  draftGroups: { g1: [], g2: [], g3: [] },
  data: null,
  search: "",
  page: 1,
  pageSize: 50,
  cols: loadCols(),
  sort: { id: "expense", dir: "desc" },
  chartGrain: "week",
  chartExpanded: false,
  chartOn: new Set([TOTAL_CHART_ID]),
  chartData: null,
  chartMetrics: loadChartMetrics(),
};

const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const money = (v) => {
  if (v === null || v === undefined) return "—";
  return Math.round(Number(v)).toLocaleString("ru-RU");
};

const int = (v) => Number(v || 0).toLocaleString("ru-RU");
const pct = (v) => (v === null || v === undefined ? "—" : `${Number(v).toFixed(1)}%`);

const cloneChecks = (list) => (list || []).map((x) => ({ v: x.v, on: x.on }));

const selectedFrom = (list) => (list || []).filter((x) => x.on).map((x) => x.v);

let hscrollLock = false;

function syncHScroll() {
  const sc = $("tableScroll");
  const bar = $("hscroll");
  const inner = $("hscrollInner");
  if (!sc || !bar || !inner) return;
  const r = sc.getBoundingClientRect();
  bar.style.left = `${Math.round(r.left)}px`;
  bar.style.width = `${Math.max(0, Math.round(r.width))}px`;
  inner.style.width = `${Math.max(sc.scrollWidth, r.width)}px`;
  if (!hscrollLock) bar.scrollLeft = sc.scrollLeft;
}

function visibleCols() {
  return METRIC_COLS.filter((c) => state.cols[c.id]);
}

function fmtMetric(col, row) {
  const v = row[col.id];
  if (col.kind === "date") {
    if (!v) return "—";
    return fmt(String(v).slice(0, 10));
  }
  if (col.kind === "money") return money(v);
  if (col.kind === "pct") return pct(v);
  return int(v);
}

const metrics = (row) =>
  visibleCols()
    .map((col) => `<div class="metric${col.kind === "pct" ? " pct" : ""}">${fmtMetric(col, row)}</div>`)
    .join("");

function renderMetricHead() {
  const wrap = $("headRow");
  wrap.querySelectorAll(".col-m").forEach((el) => el.remove());
  for (const col of visibleCols()) {
    const d = document.createElement("div");
    const on = state.sort.id === col.id;
    d.className = `col-m${on ? " is-sorted" : ""}`;
    d.innerHTML = `<button type="button" class="sort-btn" data-sort="${esc(col.id)}" title="Сортировать: сначала большее">
      <span>${esc(col.label)}</span>
      <span class="sort-ico" aria-hidden="true">${on ? (state.sort.dir === "desc" ? "▼" : "▲") : "▼"}</span>
    </button>`;
    wrap.appendChild(d);
  }
  $("tableWrap").style.setProperty("--mc", String(visibleCols().length));
  syncHScroll();
}

function saveCols() {
  localStorage.setItem(COLS_KEY, JSON.stringify(state.cols));
}

function renderColsItems() {
  $("colsItems").innerHTML = METRIC_COLS.map(
    (c) => `
    <label>
      <input type="checkbox" data-col="${c.id}" ${state.cols[c.id] ? "checked" : ""}>
      <span>${esc(c.label)}</span>
    </label>`
  ).join("");
}

function shortStrategy(raw) {
  const t = String(raw || "").trim();
  if (!t) return "";
  const low = t.toLowerCase();
  if (low.includes("автостратег")) return "авто.";
  if (low.includes("средняя стоимость клика")) return "Ср. ст. клика";
  return t;
}

function shortPlacement(raw) {
  const t = String(raw || "").trim();
  if (!t) return "";
  if (t === "Поиск") return "Поиск";
  if (t.toLowerCase().includes("рекомендац")) return "Поиск и рек.";
  return t;
}

function statusDots(p) {
  const bits = STATUS_DOTS.map((spec) => {
    const n = (p.campaigns[spec.key] || []).length;
    if (!n) return "";
    return `<span class="dot dot--${spec.tone}" title="${esc(spec.title)}: ${n}">${n}</span>`;
  }).filter(Boolean);
  return bits.length ? `<span class="status-dots">${bits.join("")}</span>` : "";
}

function parseYmd(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmt(s) {
  if (!s) return "—";
  const d = parseYmd(s);
  return d.toLocaleDateString("ru-RU");
}

function clampIso(s) {
  if (state.minDate && s < state.minDate) return state.minDate;
  if (state.maxDate && s > state.maxDate) return state.maxDate;
  return s;
}

function todayIso() {
  return iso(new Date());
}

function addDaysIso(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

function parseList(text) {
  const seen = new Set();
  const out = [];
  for (const part of String(text).split(/[\n,;\t]+/)) {
    const v = part.trim().replace(/^["']+|["']+$/g, "");
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function calOpen() {
  return !$("cal").hidden;
}

function activeFromTo() {
  if (calOpen()) return { from: state.draftFrom, to: state.draftTo };
  return { from: state.from, to: state.to };
}

function updateRangeBtn() {
  const a = state.from ? parseYmd(state.from) : null;
  const b = state.to ? parseYmd(state.to) : a;
  let label = "—";
  if (a && b) {
    if (iso(a) === iso(b)) {
      label = `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]}`;
    } else if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      label = `${a.getDate()} - ${b.getDate()} ${MONTHS_SHORT[a.getMonth()]}`;
    } else {
      label = `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} - ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`;
    }
  }
  $("rangeLabel").textContent = label;
}

function rangeEnds() {
  const { from: fromS, to: toS } = activeFromTo();
  const from = fromS ? parseYmd(fromS) : null;
  let to = toS ? parseYmd(toS) : null;
  if (from && !to && state.hover) to = parseYmd(state.hover);
  return { from, to };
}

function fillMonth(box, year, month) {
  box.innerHTML = "";
  const first = new Date(year, month, 1);
  const startIdx = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const min = state.minDate ? parseYmd(state.minDate) : null;
  const max = state.maxDate ? parseYmd(state.maxDate) : null;
  const { from, to } = rangeEnds();
  const { from: fromS, to: toS } = activeFromTo();
  for (let i = 0; i < startIdx; i += 1) {
    box.appendChild(document.createElement("span"));
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, month, day);
    const id = iso(d);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cal__day";
    btn.textContent = String(day);
    if (d.getDay() === 0 || d.getDay() === 6) btn.classList.add("weekend");
    if ((min && d < min) || (max && d > max)) btn.disabled = true;
    if (from && to && d >= from && d <= to) btn.classList.add("in-range");
    if (fromS === id) btn.classList.add("start");
    if ((toS || fromS) === id && (toS === id || !toS)) btn.classList.add("end");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      pickDay(id);
    });
    box.appendChild(btn);
  }
}

function renderCal() {
  const view = state.view;
  const right = new Date(view.getFullYear(), view.getMonth() + 1, 1);
  $("calTitleLeft").textContent = `${MONTHS[view.getMonth()]} ${view.getFullYear()}`;
  $("calTitleRight").textContent = `${MONTHS[right.getMonth()]} ${right.getFullYear()}`;
  fillMonth($("calDaysLeft"), view.getFullYear(), view.getMonth());
  fillMonth($("calDaysRight"), right.getFullYear(), right.getMonth());
}

function pickDay(id) {
  if (!state.draftFrom || state.draftTo) {
    state.draftFrom = id;
    state.draftTo = null;
    state.hover = null;
  } else if (id === state.draftFrom) {
    state.draftTo = id;
    state.hover = null;
  } else if (id < state.draftFrom) {
    state.draftTo = state.draftFrom;
    state.draftFrom = id;
    state.hover = null;
  } else {
    state.draftTo = id;
    state.hover = null;
  }
  renderCal();
}

function rangeForPreset(kind) {
  const today = clampIso(todayIso());
  let from = today;
  let to = today;
  if (kind === "yesterday") {
    from = to = clampIso(addDaysIso(todayIso(), -1));
  } else if (kind === "week") {
    const d = parseYmd(today);
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    from = clampIso(iso(mon));
    to = today;
  } else if (kind === "7d") {
    from = clampIso(addDaysIso(today, -6));
    to = today;
  } else if (kind === "month") {
    const d = parseYmd(today);
    from = clampIso(iso(new Date(d.getFullYear(), d.getMonth(), 1)));
    to = today;
  } else if (kind === "prev-month") {
    const d = parseYmd(today);
    const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const end = new Date(d.getFullYear(), d.getMonth(), 0);
    from = clampIso(iso(start));
    to = clampIso(iso(end));
  }
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

function applyPreset(kind) {
  const { from, to } = rangeForPreset(kind);
  state.draftFrom = from;
  state.draftTo = to;
  state.hover = null;
  state.view = new Date(parseYmd(to).getFullYear(), parseYmd(to).getMonth() - 1, 1);
  renderCal();
}

function restoreStatusChecks() {
  document.querySelectorAll("#statusPop input[data-st]").forEach((el) => {
    el.checked = state.applied.statuses.includes(el.dataset.st);
  });
}

function closeCheckPops() {
  for (const field of [...CHECK_FIELDS, ...GROUP_FIELDS]) {
    $(`${field}Pop`).hidden = true;
    $(`${field}Wrap`).classList.remove("open");
  }
}

function closeColsPop() {
  $("colsPop").hidden = true;
  $("colsWrap").classList.remove("open");
}

function closeChartMetricsPop() {}

function closeStatusPop() {
  $("statusPop").hidden = true;
  $("statusWrap").classList.remove("open");
  restoreStatusChecks();
}

function closeCal() {
  $("cal").hidden = true;
  $("rangeWrap").classList.remove("open");
  state.hover = null;
  state.draftFrom = state.from;
  state.draftTo = state.to;
}

function closePageSize() {
  $("pageSizePop").hidden = true;
  $("pageSizeWrap").classList.remove("open");
}

function discardDrafts() {
  CHECK_FIELDS.forEach((field) => {
    state.lists[field] = cloneChecks(state.applied.lists[field]);
    const paste = $(`${field}Paste`);
    if (paste) paste.value = "";
  });
  GROUP_FIELDS.forEach((field) => {
    state.draftGroups[field] = [...state.applied[field]];
  });
  restoreStatusChecks();
}

function closeAllPops() {
  discardDrafts();
  closeCal();
  closeStatusPop();
  closeCheckPops();
  closeColsPop();
  closeChartMetricsPop();
  closePageSize();
}

function openCal() {
  closeAllPops();
  state.draftFrom = state.from;
  state.draftTo = state.to;
  $("cal").hidden = false;
  $("rangeWrap").classList.add("open");
  const end = parseYmd(state.to || state.from || state.maxDate);
  state.view = new Date(end.getFullYear(), end.getMonth() - 1, 1);
  renderCal();
}

function commitCal() {
  state.from = state.draftFrom;
  state.to = state.draftTo || state.draftFrom;
  updateRangeBtn();
  closeCal();
}

function renderCheckItems(field) {
  const box = $(`${field}Items`);
  const list = state.lists[field];
  if (!list.length) {
    box.innerHTML = `<div class="check-pop__empty">Вставьте список выше</div>`;
    return;
  }
  box.innerHTML = list
    .map(
      (x, i) => `
      <label>
        <input type="checkbox" data-i="${i}" ${x.on ? "checked" : ""}>
        <span title="${esc(x.v)}">${esc(x.v)}</span>
      </label>`
    )
    .join("");
}

function renderGroupItems(field) {
  const box = $(`${field}Items`);
  const opts = state.opts[field];
  const selected = new Set(state.draftGroups[field]);
  if (!opts.length) {
    box.innerHTML = `<div class="check-pop__empty">Нет значений</div>`;
    return;
  }
  box.innerHTML = opts
    .map(
      (v) => `
      <label>
        <input type="checkbox" data-val="${esc(v)}" ${selected.has(v) ? "checked" : ""}>
        <span title="${esc(v)}">${esc(v)}</span>
      </label>`
    )
    .join("");
}

function addCheckItems(field, values) {
  const list = state.lists[field];
  const index = new Map(list.map((x, i) => [x.v.toLowerCase(), i]));
  for (const v of values) {
    const key = v.toLowerCase();
    if (index.has(key)) {
      list[index.get(key)].on = true;
    } else {
      list.push({ v, on: true });
      index.set(key, list.length - 1);
    }
  }
  renderCheckItems(field);
}

function updateGroupEnabled() {
  $("g2Btn").disabled = state.applied.g1.length === 0;
  $("g3Btn").disabled = state.applied.g2.length === 0;
}

function updateChipStates() {
  $("rangeBtn").classList.add("is-on");
  for (const field of CHECK_FIELDS) {
    const n = selectedFrom(state.applied.lists[field]).length;
    const cfg = CHECK_LABELS[field];
    $(`${field}Label`).textContent = n ? `${cfg.chip}: ${n}` : cfg.empty;
    $(`${field}Btn`).classList.toggle("is-on", n > 0);
  }
  for (const field of GROUP_FIELDS) {
    const n = state.applied[field].length;
    const cfg = GROUP_LABELS[field];
    $(`${field}Label`).textContent = n ? `${cfg.chip}: ${n}` : cfg.empty;
    $(`${field}Btn`).classList.toggle("is-on", n > 0);
  }
  const n = state.applied.statuses.length;
  $("statusLabel").textContent = `Статус: ${n}`;
  $("statusBtn").classList.toggle("is-on", n > 0);
  updateGroupEnabled();
}

function qsList(name, values) {
  return values.map((v) => `${name}=${encodeURIComponent(v)}`).join("&");
}

async function refreshGroup2() {
  if (!state.applied.g1.length) {
    state.opts.g2 = [];
    state.opts.g3 = [];
    state.applied.g2 = [];
    state.applied.g3 = [];
    state.draftGroups.g2 = [];
    state.draftGroups.g3 = [];
    return;
  }
  const vals = await (await fetch(`/api/groups?${qsList("g", state.applied.g1)}`)).json();
  state.opts.g2 = vals;
  state.applied.g2 = state.applied.g2.filter((v) => vals.includes(v));
  state.draftGroups.g2 = [...state.applied.g2];
  await refreshGroup3();
}

async function refreshGroup3() {
  if (!state.applied.g1.length || !state.applied.g2.length) {
    state.opts.g3 = [];
    state.applied.g3 = [];
    state.draftGroups.g3 = [];
    return;
  }
  const vals = await (
    await fetch(`/api/groups?${qsList("g", state.applied.g1)}&${qsList("g1", state.applied.g2)}`)
  ).json();
  state.opts.g3 = vals;
  state.applied.g3 = state.applied.g3.filter((v) => vals.includes(v));
  state.draftGroups.g3 = [...state.applied.g3];
}

function openCheckPop(field) {
  closeAllPops();
  state.lists[field] = cloneChecks(state.applied.lists[field]);
  renderCheckItems(field);
  $(`${field}Pop`).hidden = false;
  $(`${field}Wrap`).classList.add("open");
}

function openGroupPop(field) {
  if ($(`${field}Btn`).disabled) return;
  closeAllPops();
  state.draftGroups[field] = [...state.applied[field]];
  renderGroupItems(field);
  $(`${field}Pop`).hidden = false;
  $(`${field}Wrap`).classList.add("open");
}

function openStatusPop() {
  closeAllPops();
  restoreStatusChecks();
  $("statusPop").hidden = false;
  $("statusWrap").classList.add("open");
}

async function commitPop(kind) {
  if (kind === "status") {
    state.applied.statuses = [...document.querySelectorAll("#statusPop input[data-st]:checked")].map(
      (el) => el.dataset.st
    );
  } else if (GROUP_FIELDS.includes(kind)) {
    state.applied[kind] = [...state.draftGroups[kind]];
    if (kind === "g1") await refreshGroup2();
    if (kind === "g2") await refreshGroup3();
  } else if (CHECK_FIELDS.includes(kind)) {
    state.applied.lists[kind] = cloneChecks(state.lists[kind]);
  }
  updateChipStates();
  closeCal();
  closeStatusPop();
  closeCheckPops();
  closeColsPop();
  closePageSize();
}

function setManagers(names) {
  const prev = new Map(state.applied.lists.manager.map((x) => [x.v.toLowerCase(), x.on]));
  const seen = new Set();
  const items = [];
  for (const v of ["Без менеджера", ...(names || [])]) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ v, on: Boolean(prev.get(key)) });
  }
  state.applied.lists.manager = items;
  state.lists.manager = cloneChecks(items);
}

function campChartId(sku, campaignId) {
  return `camp:${sku}:${campaignId}`;
}

function eyeBtn(id) {
  const on = state.chartOn.has(id);
  return `<button type="button" class="eye-btn${on ? " is-on" : ""}" data-chart-id="${esc(id)}" title="${on ? "Убрать с графика" : "Показать на графике"}" aria-pressed="${on ? "true" : "false"}" aria-label="На графике">
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M2.4 12s3.4-7 9.6-7 9.6 7 9.6 7-3.4 7-9.6 7-9.6-7-9.6-7Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="12" cy="12" r="2.7" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"/>
    </svg>
  </button>`;
}

function mondayIso(s) {
  const d = parseYmd(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

function fmtShort(s) {
  if (!s) return "";
  const d = parseYmd(s);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ratioNum(a, b) {
  const den = Number(b) || 0;
  if (!den) return 0;
  return (Number(a) || 0) / den * 100;
}

function unitNum(a, b) {
  const den = Number(b) || 0;
  if (!den) return 0;
  return (Number(a) || 0) / den;
}

function metricFromAcc(acc, metricId) {
  if (metricId === "drr") return ratioNum(acc.expense, acc.sales);
  if (metricId === "general_drr") return ratioNum(acc.expense, acc.gmv);
  if (metricId === "ctr") return ratioNum(acc.clicks, acc.views);
  if (metricId === "cpc") return unitNum(acc.expense, acc.clicks);
  return Number(acc[metricId]) || 0;
}

function blankAcc() {
  return Object.fromEntries(CHART_ADD.map((k) => [k, 0]));
}

function addAcc(dst, src) {
  for (const k of CHART_ADD) dst[k] += Number(src[k]) || 0;
}

function bucketMetric(points, metricId, grain) {
  if (!points || !points.length) return [];
  if (grain !== "week") {
    return points.map((p) => ({
      date: p.date,
      value: metricFromAcc(p, metricId),
      label: fmtShort(p.date),
    }));
  }
  const map = new Map();
  for (const p of points) {
    const key = mondayIso(p.date);
    const acc = map.get(key) || blankAcc();
    addAcc(acc, p);
    map.set(key, acc);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, acc]) => ({
      date,
      value: metricFromAcc(acc, metricId),
      label: fmtShort(date),
    }));
}

function niceMax(v) {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function trimNum(v) {
  const s = v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
  return s.replace(".", ",");
}

function fmtAxis(v, kind) {
  if (kind === "pct") return `${trimNum(v)}%`;
  if (v >= 1_000_000) return `${trimNum(v / 1_000_000)} млн`;
  if (v >= 1000) return `${trimNum(v / 1000)} K`;
  return String(Math.round(v));
}

function fmtChartVal(col, v) {
  if (v === null || v === undefined) return "—";
  if (col.kind === "pct") return pct(v);
  if (col.kind === "money") return `${money(v)} ₽`;
  return int(v);
}

function deltaPct(curr, prev) {
  const a = Number(curr);
  const b = Number(prev);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (b === 0) return a === 0 ? 0 : null;
  return ((a - b) / Math.abs(b)) * 100;
}

function fmtDeltaHtml(pct) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) {
    return `<span class="chart-tip__delta is-na">—</span>`;
  }
  const rounded = Math.round(pct * 10) / 10;
  const cls = rounded > 0 ? "is-up" : rounded < 0 ? "is-down" : "is-flat";
  const sign = rounded > 0 ? "+" : "";
  const text = `${sign}${rounded.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
  return `<span class="chart-tip__delta ${cls}">${text}</span>`;
}

function fmtLongDate(s) {
  if (!s) return "";
  const d = parseYmd(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtAxisDate(s) {
  if (!s) return "";
  const d = parseYmd(s);
  const wd = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][d.getDay()];
  return `${d.getDate()}, ${wd}`;
}

function selectedChartMetrics() {
  const ids = normalizeChartMetrics(state.chartMetrics);
  if (ids.join() !== state.chartMetrics.join()) state.chartMetrics = ids;
  return ids
    .map((id) => CHART_METRICS.find((c) => c.id === id))
    .filter(Boolean);
}

function shortMetricLabel(col) {
  return (col?.label || "").replace(/, ₽$/, "").replace(/, %$/, "");
}

function metricLineColor(id) {
  const i = CHART_METRICS.findIndex((c) => c.id === id);
  return CHART_COLORS[(i < 0 ? 0 : i) % CHART_COLORS.length];
}

function saveChartMetrics() {
  localStorage.setItem(CHART_METRICS_KEY, JSON.stringify(state.chartMetrics));
}

function applyChartMetric(id, wantOn) {
  const cur = [...state.chartMetrics];
  if (wantOn) {
    if (cur.includes(id)) return;
    if (!isChartCombo(id) || (cur.length && !cur.every(isChartCombo))) {
      state.chartMetrics = [id];
      return;
    }
    state.chartMetrics = [...cur, id];
    return;
  }
  if (cur.length <= 1 || !cur.includes(id)) return;
  state.chartMetrics = cur.filter((x) => x !== id);
}

function renderChartMetricsItems() {
  const box = $("chartMetricsItems");
  if (!box) return;
  const on = new Set(state.chartMetrics);
  box.innerHTML = CHART_METRICS.map(
    (c) => `
    <label>
      <input type="checkbox" data-chart-metric="${c.id}" ${on.has(c.id) ? "checked" : ""}>
      <span>${esc(c.label)}</span>
    </label>`
  ).join("");
}

function visibleChartSeries() {
  const metrics = selectedChartMetrics();
  if (!metrics.length) return [];
  const entities = (state.chartData?.series || []).filter((s) => state.chartOn.has(s.id));
  const splitExpense = metrics.some((m) => m.id === "expense") && metrics.some((m) => m.id !== "expense");
  const colorByMetric = metrics.length > 1 && entities.length <= 1;
  const out = [];
  entities.forEach((ent, i) => {
    const entityColor = CHART_COLORS[i % CHART_COLORS.length];
    metrics.forEach((metric) => {
      out.push({
        entityId: ent.id,
        name: ent.name,
        metric,
        axis: splitExpense && metric.id === "expense" ? 1 : 0,
        dash: metrics.length > 1 && !colorByMetric ? CHART_DASH[metric.id] || "6 4" : "",
        color: colorByMetric ? metricLineColor(metric.id) : entityColor,
        points: bucketMetric(ent.points, metric.id, state.chartGrain).map((p) => ({
          ...p,
          label: fmtAxisDate(p.date),
        })),
      });
    });
  });
  return out;
}

function legendTitle(s, metrics, entities) {
  if (metrics.length <= 1) return s.name;
  if (entities <= 1) return shortMetricLabel(s.metric);
  return `${s.name} · ${shortMetricLabel(s.metric)}`;
}

function tipTitle(s, metrics, entities) {
  if (metrics.length <= 1) {
    return entities <= 1 ? shortMetricLabel(s.metric) : s.name;
  }
  if (entities <= 1) return shortMetricLabel(s.metric);
  return `${s.name} · ${shortMetricLabel(s.metric)}`;
}

function renderChart() {
  const card = $("chartCard");
  const svgBox = $("chartSvg");
  const legend = $("chartLegend");
  const empty = $("chartEmpty");
  const yLabel = $("chartYLabel");
  const yLabelR = $("chartYLabelRight");
  const tip = $("chartTip");
  if (!card || !svgBox) return;
  if (!state.chartData) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  card.classList.toggle("is-wide", state.chartExpanded);
  $("chartExpand").textContent = state.chartExpanded ? "Свернуть график" : "Развернуть график";
  document.querySelectorAll("#chartGrain [data-grain]").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.grain === state.chartGrain);
  });

  const metrics = selectedChartMetrics();
  const series = visibleChartSeries();
  const entityCount = new Set(series.map((s) => s.entityId)).size;
  const splitExpense = metrics.some((m) => m.id === "expense") && metrics.some((m) => m.id !== "expense");
  const leftMetrics = splitExpense ? metrics.filter((m) => m.id !== "expense") : metrics;
  const leftKind = (leftMetrics[0] || metrics[0] || { kind: "money" }).kind;
  const rightKind = "money";
  if (yLabel) {
    yLabel.textContent =
      leftMetrics.length === 1 ? leftMetrics[0].label : leftMetrics.length ? "₽" : metrics[0]?.label || "Расход, ₽";
  }
  if (yLabelR) {
    yLabelR.hidden = !splitExpense;
    yLabelR.textContent = splitExpense ? "Расход, ₽" : "";
  }
  if (!series.length || series.every((s) => !s.points.length)) {
    svgBox.innerHTML = "";
    legend.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  legend.innerHTML = series
    .map(
      (s) => `<span class="chart-legend__item" style="color:${s.color}">
        <span class="chart-legend__dot${s.dash ? " is-dash" : ""}"></span>${esc(legendTitle(s, metrics, entityCount))}
      </span>`
    )
    .join("");

  const labels = series[0].points.map((p) => p.label);
  const dates = series[0].points.map((p) => p.date);
  const n = labels.length;
  const dayMode = state.chartGrain === "day";
  const leftVals = series.filter((s) => s.axis !== 1).flatMap((s) => s.points.map((p) => p.value));
  const rightVals = series.filter((s) => s.axis === 1).flatMap((s) => s.points.map((p) => p.value));
  const maxL = niceMax(Math.max(0, ...(leftVals.length ? leftVals : [0])));
  const maxR = niceMax(Math.max(0, ...(rightVals.length ? rightVals : [0])));
  const boxW = Math.max(svgBox.clientWidth || 480, 280);
  const h = svgBox.clientHeight || 260;
  const pad = { l: 44, r: splitExpense ? 48 : 12, t: 22, b: dayMode ? 36 : 28 };
  const minInner = dayMode ? Math.max(n * 28, 80) : 80;
  const w = Math.max(boxW, pad.l + minInner + pad.r);
  const innerW = Math.max(1, w - pad.l - pad.r);
  const innerH = Math.max(1, h - pad.t - pad.b);
  const xAt = (i) => pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAtAxis = (v, max) => pad.t + innerH - (v / max) * innerH;
  const yAt = (s, v) => yAtAxis(v, s.axis === 1 ? maxR : maxL);

  let grid = "";
  for (let i = 0; i <= 3; i += 1) {
    const vL = (maxL * (3 - i)) / 3;
    const y = yAtAxis(vL, maxL);
    grid += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}" stroke="#eef2f6" stroke-width="1"/>`;
    grid += `<text x="${pad.l - 6}" y="${y + 3}" text-anchor="end" fill="#98a2b3" font-size="11">${esc(fmtAxis(vL, leftKind))}</text>`;
    if (splitExpense) {
      const vR = (maxR * (3 - i)) / 3;
      grid += `<text x="${w - pad.r + 6}" y="${y + 3}" text-anchor="start" fill="#98a2b3" font-size="11">${esc(fmtAxis(vR, rightKind))}</text>`;
    }
  }
  let xLabels = "";
  labels.forEach((lab, i) => {
    if (!dayMode) {
      const step = Math.max(1, Math.ceil(n / 8));
      if (i % step !== 0 && i !== n - 1) return;
    }
    xLabels += `<text x="${xAt(i)}" y="${h - 8}" text-anchor="middle" fill="#98a2b3" font-size="11">${esc(lab)}</text>`;
  });
  const lines = series
    .map((s) => {
      const d = s.points.map((p, i) => `${i ? "L" : "M"}${xAt(i)} ${yAt(s, p.value)}`).join(" ");
      const dash = s.dash ? ` stroke-dasharray="${s.dash}"` : "";
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${dash}/>`;
    })
    .join("");
  svgBox.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
    ${grid}${lines}${xLabels}
    <g id="chartCrosshair" display="none">
      <line id="chartVLine" stroke="#c5d0e0" stroke-width="1"/>
      <g id="chartDots"></g>
    </g>
  </svg>`;

  const hover = (ev) => {
    const svg = svgBox.querySelector("svg");
    if (!svg || n <= 0) return;
    const rect = svg.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * (w / rect.width);
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < n; i += 1) {
      const dx = Math.abs(xAt(i) - x);
      if (dx < best) {
        best = dx;
        idx = i;
      }
    }
    const cx = xAt(idx);
    const vLine = svg.querySelector("#chartVLine");
    const dots = svg.querySelector("#chartDots");
    const g = svg.querySelector("#chartCrosshair");
    g.setAttribute("display", "block");
    vLine.setAttribute("x1", String(cx));
    vLine.setAttribute("x2", String(cx));
    vLine.setAttribute("y1", String(pad.t));
    vLine.setAttribute("y2", String(pad.t + innerH));
    dots.innerHTML = series
      .map((s) => {
        const cy = yAt(s, s.points[idx]?.value || 0);
        return `<circle cx="${cx}" cy="${cy}" r="5" fill="#fff" stroke="${s.color}" stroke-width="2"/>`;
      })
      .join("");
    const valueRows = series
      .map((s) => {
        const curr = s.points[idx]?.value;
        const prev = idx > 0 ? s.points[idx - 1]?.value : null;
        const val = fmtChartVal(s.metric, curr);
        return `<div class="chart-tip__row">
          <span>${esc(tipTitle(s, metrics, entityCount))}</span>
          <b>${val}</b>
          ${fmtDeltaHtml(deltaPct(curr, prev))}
        </div>`;
      })
      .join("");
    tip.hidden = false;
    tip.innerHTML = `<div class="chart-tip__date">${esc(fmtLongDate(dates[idx]))}</div>${valueRows}`;
    const box = svgBox.getBoundingClientRect();
    const left = Math.min(box.width - 280, Math.max(8, ev.clientX - box.left + 14));
    tip.style.left = `${left}px`;
    tip.style.top = `28px`;
  };
  svgBox.onmousemove = hover;
  svgBox.onmouseleave = () => {
    tip.hidden = true;
    const g = svgBox.querySelector("#chartCrosshair");
    if (g) g.setAttribute("display", "none");
  };
}

function toggleChartId(id) {
  if (state.chartOn.has(id)) state.chartOn.delete(id);
  else state.chartOn.add(id);
  render();
  renderChart();
}

function requestBody() {
  return {
    from: state.from,
    to: state.to || state.from,
    g: state.applied.g1,
    g1: state.applied.g2,
    g2: state.applied.g3,
    manager: selectedFrom(state.applied.lists.manager),
    artic: selectedFrom(state.applied.lists.artic),
    code: selectedFrom(state.applied.lists.code),
    nom: selectedFrom(state.applied.lists.nom),
    sku: selectedFrom(state.applied.lists.sku),
    campaign_id: selectedFrom(state.applied.lists.campaign),
    statuses: state.applied.statuses,
  };
}

function campCount(items) {
  return items.reduce((n, p) => n + CAMP_KEYS.reduce((m, k) => m + (p.campaigns[k] || []).length, 0), 0);
}

function sortValue(row, col) {
  const v = row?.[col.id];
  if (v === null || v === undefined || v === "") return null;
  if (col.kind === "date") return String(v).slice(0, 10);
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cmpSort(a, b, dir) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a === b) return 0;
  if (dir === "desc") return a < b ? 1 : -1;
  return a < b ? -1 : 1;
}

function sortRows(rows) {
  const col = METRIC_COLS.find((c) => c.id === state.sort.id);
  if (!col) return rows;
  return [...rows].sort((a, b) => cmpSort(sortValue(a, col), sortValue(b, col), state.sort.dir));
}

function filteredItems() {
  const items = state.data?.items || [];
  const q = state.search.trim().toLowerCase();
  const filtered = q
    ? items.filter((p) => {
        const camps = CAMP_KEYS.flatMap((k) => p.campaigns[k] || []);
        const blob = [
          p.name,
          p.artic,
          p.code,
          p.sku,
          ...camps.map((c) => c.name),
          ...camps.map((c) => c.id),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      })
    : items;
  return sortRows(filtered);
}

function campRow(c, pillClassName, pillText, sku) {
  const meta = [
    `<span class="pill ${pillClassName}">${esc(pillText)}</span>`,
    c.id
      ? `<a class="camp-id ext-link" href="https://seller.ozon.ru/app/advertisement/product/cpc/${encodeURIComponent(c.id)}" target="_blank" rel="noopener noreferrer">${esc(c.id)}</a>`
      : "",
    shortStrategy(c.strategy) ? `<span>${esc(shortStrategy(c.strategy))}</span>` : "",
    shortPlacement(c.placement) ? `<span>${esc(shortPlacement(c.placement))}</span>` : "",
  ].filter(Boolean);
  return `
    <div class="camp-row">
      <div class="camp-text">
        ${eyeBtn(campChartId(sku, c.id))}
        <div class="camp-text__body">
          <div class="camp-name" title="${esc(c.name)}">${esc(c.name)}</div>
          <div class="camp-meta">${meta.join('<span class="camp-sep" aria-hidden="true">|</span>')}</div>
        </div>
      </div>
      ${metrics(c)}
    </div>`;
}

function campsHtml(p) {
  const rows = [];
  for (const [key, cls, text] of CAMP_ORDER) {
    const camps = sortRows(p.campaigns[key] || []);
    for (const c of camps) {
      rows.push(campRow(c, cls, text, p.sku));
    }
  }
  return rows.join("") || `<div class="empty">Кампаний нет</div>`;
}

function pageWindow(cur, total) {
  if (total <= 7) return [...Array(total)].map((_, i) => i + 1);
  const pages = new Set([1, total, cur - 1, cur, cur + 1]);
  if (cur <= 3) [2, 3, 4].forEach((n) => pages.add(n));
  if (cur >= total - 2) [total - 3, total - 2, total - 1].forEach((n) => pages.add(n));
  return [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
}

function renderPager(filtered) {
  const pager = $("pager");
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / state.pageSize) || 1);
  if (state.page > pages) state.page = pages;
  const from = total ? (state.page - 1) * state.pageSize + 1 : 0;
  const to = Math.min(state.page * state.pageSize, total);
  $("pageSizeBtn").textContent = String(state.pageSize);
  $("pageInfo").textContent = `${int(from)}–${int(to)} из ${int(total)} товаров · ${int(campCount(filtered))} кампаний`;

  const nums = pageWindow(state.page, pages);
  let html = `<button type="button" class="pager__nav" data-page="${state.page - 1}" ${state.page <= 1 ? "disabled" : ""}>‹</button>`;
  let prev = 0;
  for (const n of nums) {
    if (prev && n - prev > 1) html += `<span class="pager__gap">…</span>`;
    html += `<button type="button" class="pager__num${n === state.page ? " is-on" : ""}" data-page="${n}">${n}</button>`;
    prev = n;
  }
  html += `<button type="button" class="pager__nav" data-page="${state.page + 1}" ${state.page >= pages ? "disabled" : ""}>›</button>`;
  $("pageButtons").innerHTML = html;
  pager.hidden = false;
  syncHScroll();
}

function render() {
  const data = state.data;
  const hint = $("hint");
  if (!data) return;

  hint.hidden = true;
  renderMetricHead();
  $("total").innerHTML = `
    <div class="prod">${eyeBtn(TOTAL_CHART_ID)}<div class="prod__name">Итого</div></div>
    ${metrics(data.totals)}
  `;

  const filtered = filteredItems();
  const list = $("list");
  if (!filtered.length) {
    list.innerHTML = `<div class="empty">Нет строк за выбранный период и фильтры</div>`;
    renderPager(filtered);
    bindChartEyes();
    return;
  }

  const start = (state.page - 1) * state.pageSize;
  const pageItems = filtered.slice(start, start + state.pageSize);

  list.innerHTML = pageItems
    .map((p) => {
      const bits = [];
      if (p.artic) bits.push(`<span>${esc(p.artic)}</span>`);
      if (p.code) bits.push(`<span>${esc(p.code)}</span>`);
      if (p.sku) {
        bits.push(
          `<a class="sku-link ext-link" href="https://www.ozon.ru/product/${encodeURIComponent(p.sku)}" target="_blank" rel="noopener noreferrer">${esc(p.sku)}</a>`
        );
      }
      const img = p.photo
        ? `<img class="thumb" src="${esc(p.photo)}" alt="">`
        : `<div class="thumb thumb--empty">SKU</div>`;
      return `
        <div class="prod-row">
          <div class="prod">
            <button type="button" class="chev" aria-label="Показать кампании">
              <svg viewBox="0 0 16 16" width="14" height="14">
                <path d="M6 3.2 11.2 8 6 12.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            ${eyeBtn(p.sku)}
            ${img}
            <div class="prod__text">
              <div class="prod__name" title="${esc(p.name)}">${esc(p.name)}</div>
              <div class="prod__meta"><span class="prod__ids">${bits.join('<span class="camp-sep" aria-hidden="true">|</span>')}${statusDots(p)}</span></div>
            </div>
          </div>
          ${metrics(p)}
        </div>
        <div class="camps">${campsHtml(p)}</div>
      `;
    })
    .join("");

  list.querySelectorAll(".chev").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      btn.closest(".prod-row").classList.toggle("open");
    });
  });
  bindChartEyes();
  renderPager(filtered);
  syncHScroll();
}

function bindChartEyes() {
  document.querySelectorAll("[data-chart-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleChartId(btn.dataset.chartId);
    });
  });
}

async function loadMeta() {
  const meta = await (await fetch("/api/meta")).json();
  state.minDate = meta.min_date;
  state.maxDate = meta.max_date;
  if (meta.demo && meta.min_date && meta.max_date) {
    state.from = meta.min_date;
    state.to = meta.max_date;
  } else {
    state.from = meta.max_date;
    state.to = meta.max_date;
  }
  state.draftFrom = state.from;
  state.draftTo = state.to;
  state.view = new Date(parseYmd(meta.max_date).getFullYear(), parseYmd(meta.max_date).getMonth() - 1, 1);
  updateRangeBtn();
  state.opts.g1 = meta.groups1 || [];
  setManagers(meta.managers || []);
  updateChipStates();
  const banner = $("demoBanner");
  if (banner) banner.hidden = !meta.demo;
  return meta;
}

async function loadProducts() {
  const body = requestBody();

  $("hint").hidden = false;
  $("hint").textContent = "Загрузка…";
  $("apply").disabled = true;
  $("spinner").hidden = false;
  try {
    const [prodRes, chartRes] = await Promise.all([
      fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      fetch("/api/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    ]);
    if (!prodRes.ok) throw new Error(await prodRes.text());
    if (!chartRes.ok) throw new Error(await chartRes.text());
    state.data = await prodRes.json();
    state.chartData = await chartRes.json();
    state.chartOn = new Set([TOTAL_CHART_ID]);
    state.page = 1;
    renderChartMetricsItems();
    render();
    renderChart();
  } catch (err) {
    $("hint").hidden = false;
    $("hint").textContent = `Ошибка: ${err.message}`;
    $("list").innerHTML = "";
    $("total").innerHTML = "";
    $("pager").hidden = true;
    $("chartCard").hidden = true;
  } finally {
    $("apply").disabled = false;
    $("spinner").hidden = true;
  }
}

function resetFilters() {
  state.applied.statuses = [...DEFAULT_STATUSES];
  state.applied.g1 = [];
  state.applied.g2 = [];
  state.applied.g3 = [];
  state.opts.g2 = [];
  state.opts.g3 = [];
  state.draftGroups = { g1: [], g2: [], g3: [] };
  const managers = state.applied.lists.manager.map((x) => x.v);
  state.applied.lists = emptyLists();
  state.lists = emptyLists();
  setManagers(managers);
  CHECK_FIELDS.forEach((field) => {
    const paste = $(`${field}Paste`);
    if (paste) paste.value = "";
  });
  $("tableSearch").value = "";
  state.search = "";
  state.page = 1;
  restoreStatusChecks();
  updateChipStates();
  loadMeta().then(loadProducts);
}

$("apply").addEventListener("click", loadProducts);
$("reset").addEventListener("click", resetFilters);
$("chartExpand").addEventListener("click", () => {
  state.chartExpanded = !state.chartExpanded;
  renderChart();
});
$("chartGrain").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-grain]");
  if (!btn) return;
  state.chartGrain = btn.dataset.grain;
  renderChart();
});

$("rangeBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  if (e.target.closest("#rangeClear")) {
    state.from = state.maxDate;
    state.to = state.maxDate;
    state.draftFrom = state.from;
    state.draftTo = state.to;
    updateRangeBtn();
    closeCal();
    return;
  }
  if ($("cal").hidden) openCal();
  else closeCal();
});
$("calPrev").addEventListener("click", (e) => {
  e.stopPropagation();
  state.view = new Date(state.view.getFullYear(), state.view.getMonth() - 1, 1);
  renderCal();
});
$("calNext").addEventListener("click", (e) => {
  e.stopPropagation();
  state.view = new Date(state.view.getFullYear(), state.view.getMonth() + 1, 1);
  renderCal();
});
$("cal").addEventListener("click", (e) => e.stopPropagation());
$("calApply").addEventListener("click", (e) => {
  e.stopPropagation();
  commitCal();
});
document.querySelectorAll("[data-preset]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    applyPreset(btn.dataset.preset);
  });
});

CHECK_FIELDS.forEach((field) => {
  $(`${field}Btn`).addEventListener("click", (e) => {
    e.stopPropagation();
    if (!$(`${field}Pop`).hidden) {
      closeAllPops();
      return;
    }
    openCheckPop(field);
  });
  $(`${field}Pop`).addEventListener("click", (e) => e.stopPropagation());
  $(`${field}Items`).addEventListener("change", (e) => {
    const t = e.target;
    if (!t.matches("input[type=checkbox]")) return;
    const i = Number(t.dataset.i);
    if (!Number.isInteger(i) || !state.lists[field][i]) return;
    state.lists[field][i].on = t.checked;
  });
  $(`${field}Paste`).addEventListener("paste", (e) => {
    const text = (e.clipboardData || window.clipboardData).getData("text");
    const vals = parseList(text);
    if (!vals.length) return;
    e.preventDefault();
    addCheckItems(field, vals);
    e.target.value = "";
  });
});

GROUP_FIELDS.forEach((field) => {
  $(`${field}Btn`).addEventListener("click", (e) => {
    e.stopPropagation();
    if ($(`${field}Btn`).disabled) return;
    if (!$(`${field}Pop`).hidden) {
      closeAllPops();
      return;
    }
    openGroupPop(field);
  });
  $(`${field}Pop`).addEventListener("click", (e) => e.stopPropagation());
  $(`${field}Items`).addEventListener("change", (e) => {
    const t = e.target;
    if (!t.matches("input[type=checkbox]")) return;
    const v = t.dataset.val;
    const set = new Set(state.draftGroups[field]);
    if (t.checked) set.add(v);
    else set.delete(v);
    state.draftGroups[field] = state.opts[field].filter((x) => set.has(x));
  });
});

document.querySelectorAll("[data-add]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const field = btn.dataset.add;
    addCheckItems(field, parseList($(`${field}Paste`).value));
    $(`${field}Paste`).value = "";
  });
});
document.querySelectorAll("[data-all]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const field = btn.dataset.all;
    state.lists[field].forEach((x) => {
      x.on = true;
    });
    renderCheckItems(field);
  });
});
document.querySelectorAll("[data-none]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const field = btn.dataset.none;
    state.lists[field].forEach((x) => {
      x.on = false;
    });
    renderCheckItems(field);
  });
});
document.querySelectorAll("[data-commit]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    commitPop(btn.dataset.commit);
  });
});

$("statusBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  if (!$("statusPop").hidden) {
    closeAllPops();
    return;
  }
  openStatusPop();
});
$("statusPop").addEventListener("click", (e) => e.stopPropagation());

$("colsBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  if (!$("colsPop").hidden) {
    closeAllPops();
    return;
  }
  closeAllPops();
  renderColsItems();
  $("colsPop").hidden = false;
  $("colsWrap").classList.add("open");
});
$("colsPop").addEventListener("click", (e) => e.stopPropagation());
$("colsItems").addEventListener("change", (e) => {
  const t = e.target;
  if (!t.matches("input[data-col]")) return;
  state.cols[t.dataset.col] = t.checked;
  saveCols();
  if (state.data) render();
  else renderMetricHead();
});

$("chartMetricsItems").addEventListener("change", (e) => {
  const t = e.target;
  if (!t.matches("input[data-chart-metric]")) return;
  applyChartMetric(t.dataset.chartMetric, t.checked);
  saveChartMetrics();
  renderChartMetricsItems();
  renderChart();
});

$("headRow").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-sort]");
  if (!btn) return;
  e.stopPropagation();
  const id = btn.dataset.sort;
  if (state.sort.id === id) state.sort.dir = state.sort.dir === "desc" ? "asc" : "desc";
  else {
    state.sort.id = id;
    state.sort.dir = "desc";
  }
  state.page = 1;
  render();
});

$("tableSearch").addEventListener("input", () => {
  state.search = $("tableSearch").value;
  state.page = 1;
  render();
});

$("pageSizeBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  const pop = $("pageSizePop");
  const open = pop.hidden;
  closeAllPops();
  if (open) {
    pop.hidden = false;
    $("pageSizeWrap").classList.add("open");
  }
});
$("pageSizePop").addEventListener("click", (e) => e.stopPropagation());
$("pageSizePop").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-size]");
  if (!btn) return;
  state.pageSize = Number(btn.dataset.size);
  state.page = 1;
  closePageSize();
  render();
});
$("pageButtons").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-page]");
  if (!btn || btn.disabled) return;
  const page = Number(btn.dataset.page);
  const total = filteredItems().length;
  const pages = Math.max(1, Math.ceil(total / state.pageSize) || 1);
  if (page < 1 || page > pages) return;
  state.page = page;
  render();
});

document.addEventListener("click", closeAllPops);
window.addEventListener("resize", () => {
  syncHScroll();
  renderChart();
});

function filenameFromDisposition(header, fallback) {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : fallback;
}

function syncExportDates() {
  const fromEl = $("exportFrom");
  const toEl = $("exportTo");
  if (!fromEl || !toEl) return;
  fromEl.min = state.minDate || "";
  fromEl.max = state.maxDate || "";
  toEl.min = state.minDate || "";
  toEl.max = state.maxDate || "";
  fromEl.value = state.exportFrom || state.from || state.maxDate || "";
  toEl.value = state.exportTo || state.to || state.maxDate || "";
}

function openExportDlg() {
  closeAllPops();
  state.exportFrom = state.from || state.maxDate;
  state.exportTo = state.to || state.maxDate;
  syncExportDates();
  const err = $("exportDlgErr");
  if (err) {
    err.hidden = true;
    err.textContent = "";
  }
  $("exportDlg").hidden = false;
}

function closeExportDlg() {
  $("exportDlg").hidden = true;
}

async function downloadExport() {
  const fromEl = $("exportFrom");
  const toEl = $("exportTo");
  const err = $("exportDlgErr");
  const go = $("exportDlgGo");
  let from = clampIso(fromEl.value);
  let to = clampIso(toEl.value);
  if (!from || !to) {
    err.hidden = false;
    err.textContent = "Укажите период";
    return;
  }
  if (from > to) [from, to] = [to, from];
  fromEl.value = from;
  toEl.value = to;
  err.hidden = true;
  go.disabled = true;
  go.textContent = "Скачиваем…";
  try {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...requestBody(), from, to }),
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = `Ошибка ${res.status}`;
      try {
        const data = JSON.parse(text);
        if (data && data.error) msg = data.error;
      } catch {
        if (text) msg = text;
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const name = filenameFromDisposition(
      res.headers.get("Content-Disposition"),
      `ozon-performance_${from}_${to}.xlsx`
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    closeExportDlg();
  } catch (e) {
    err.hidden = false;
    err.textContent = e.message || "Не удалось скачать файл";
  } finally {
    go.disabled = false;
    go.textContent = "Скачать";
  }
}

$("exportBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  openExportDlg();
});
$("exportDlg").addEventListener("click", (e) => e.stopPropagation());
$("exportDlgBackdrop").addEventListener("click", closeExportDlg);
$("exportDlgClose").addEventListener("click", closeExportDlg);
$("exportDlgCancel").addEventListener("click", closeExportDlg);
$("exportDlgGo").addEventListener("click", downloadExport);
$("exportPresets").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-export-preset]");
  if (!btn) return;
  const { from, to } = rangeForPreset(btn.dataset.exportPreset);
  $("exportFrom").value = from;
  $("exportTo").value = to;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("exportDlg").hidden) closeExportDlg();
});

const tableScroll = $("tableScroll");
const hscroll = $("hscroll");
if (tableScroll && hscroll) {
  tableScroll.addEventListener("scroll", () => {
    if (hscrollLock) return;
    hscrollLock = true;
    hscroll.scrollLeft = tableScroll.scrollLeft;
    hscrollLock = false;
  });
  hscroll.addEventListener("scroll", () => {
    if (hscrollLock) return;
    hscrollLock = true;
    tableScroll.scrollLeft = hscroll.scrollLeft;
    hscrollLock = false;
  });
}

restoreStatusChecks();
updateChipStates();
renderMetricHead();
loadMeta().then(loadProducts);
