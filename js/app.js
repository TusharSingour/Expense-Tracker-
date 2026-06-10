import { animatePieChart, animateBarChart } from "./charts.js";
import { CATEGORY_KEYS, CATEGORY_META, getCategoryMeta } from "./categories.js";

const STORAGE_TX = "apexspend_transactions_inr";
const STORAGE_PROFILE = "apexspend_profile";
const STORAGE_THEME = "apexspend_theme";

/** @typedef {{ id: string; amount: number; category: string; categoryColor: string; type: 'income'|'expense'; date: string; note: string }} Tx */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

function formatMoney(n) {
  return inrFormatter.format(Number(n) || 0);
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeTx(raw) {
  const meta = getCategoryMeta(raw.category);
  return {
    id: raw.id || uid(),
    amount: Number(raw.amount) || 0,
    category: meta.key,
    categoryColor: raw.categoryColor || meta.color,
    type: raw.type === "income" ? "income" : "expense",
    date: raw.date,
    note: raw.note || "",
  };
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_TX);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(normalizeTx);
    }
  } catch (_) {}
  return seedTransactions();
}

function saveTransactions(list) {
  localStorage.setItem(STORAGE_TX, JSON.stringify(list));
}

function seedTransactions() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  const samples = [
    { amount: 125000, category: "Other", type: "income", date: iso(y, m, 1), note: "Salary credit" },
    { amount: 45000, category: "Education", type: "income", date: iso(y, Math.max(1, m - 1), 18), note: "Scholarship" },
    { amount: 3200, category: "Food", type: "expense", date: iso(y, m, 2), note: "Groceries" },
    { amount: 8500, category: "Travel", type: "expense", date: iso(y, m, 4), note: "Metro + cab" },
    { amount: 4200, category: "Bills", type: "expense", date: iso(y, m, 6), note: "Broadband" },
    { amount: 18999, category: "Shopping", type: "expense", date: iso(y, Math.max(1, m - 1), 12), note: "Electronics" },
    { amount: 2500, category: "Health", type: "expense", date: iso(y, m, 9), note: "Pharmacy" },
    { amount: 120000, category: "Food", type: "expense", date: iso(y, Math.max(1, m - 2), 20), note: "Annual family dinner" },
    { amount: 6500, category: "Education", type: "expense", date: iso(y, Math.max(1, m - 3), 5), note: "Course materials" },
  ];

  const list = samples.map((s) => normalizeTx({ ...s, id: uid() }));
  saveTransactions(list);
  return list;
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_PROFILE);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { name: "Alex Morgan", email: "alex@example.com", avatarHue: 210 };
}

function saveProfile(p) {
  localStorage.setItem(STORAGE_PROFILE, JSON.stringify(p));
}

function initials(name) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function toast(message, variant = "success") {
  const region = document.getElementById("toast-region");
  if (!region) return;
  const el = document.createElement("div");
  el.className = `toast toast--${variant}`;
  el.textContent = message;
  region.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(12px)";
    el.style.transition = "opacity 0.25s ease, transform 0.25s ease";
    setTimeout(() => el.remove(), 260);
  }, 3200);
}

let transactions = loadTransactions();
let profile = loadProfile();
let pieCancel = () => {};
let barCancel = () => {};
let resizeChartHandler = () => {};

const $ = (sel) => document.querySelector(sel);

function categoryOptionsHtml(includePlaceholder) {
  const opts = CATEGORY_KEYS.map((key) => {
    const m = CATEGORY_META[key];
    return `<option value="${key}">${m.icon} ${m.label}</option>`;
  }).join("");
  if (includePlaceholder) {
    return `<option value="" disabled selected hidden></option>${opts}`;
  }
  return opts;
}

function populateCategorySelects() {
  const tx = /** @type {HTMLSelectElement} */ ($("#tx-category"));
  const hist = /** @type {HTMLSelectElement} */ ($("#hist-filter-cat"));
  if (tx) tx.innerHTML = categoryOptionsHtml(true);
  if (hist) {
    hist.innerHTML = `<option value="">All categories</option>${categoryOptionsHtml(false)}`;
  }
}

/**
 * @param {HTMLSelectElement | null} sel
 * @param {HTMLElement | null} fieldWrap
 * @param {HTMLElement | null} preview
 */
function syncCategoryAccent(sel, fieldWrap, preview) {
  const key = sel?.value;
  const meta = key ? getCategoryMeta(key) : null;
  const color = meta?.color || "transparent";

  if (fieldWrap) {
    fieldWrap.style.setProperty("--category-accent", color);
    fieldWrap.classList.toggle("is-active", Boolean(key));
  }
  if (preview) {
    preview.style.background = color;
    preview.classList.toggle("is-visible", Boolean(key));
    if (meta) preview.style.boxShadow = `0 0 24px ${color}55`;
  }
}

function wireCategorySelect(sel, fieldWrap, preview) {
  if (!sel) return;
  const handler = () => syncCategoryAccent(sel, fieldWrap, preview);
  sel.onchange = handler;
  sel.onfocus = handler;
  handler();
}

function setPage(name) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("page--active"));
  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add("page--active");

  document.querySelectorAll(".sidebar__link").forEach((a) => {
    a.classList.toggle("sidebar__link--active", a.dataset.page === name);
    if (a.dataset.page === name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });

  closeMobileSidebar();
  if (name === "dashboard") refreshDashboard();
  if (name === "history") renderHistoryTable();
  if (name === "add") {
    syncCategoryAccent(
      /** @type {HTMLSelectElement} */ ($("#tx-category")),
      $("#add-category-field"),
      $("#add-category-preview")
    );
  }
}

function closeMobileSidebar() {
  $("#sidebar")?.classList.remove("is-open");
  $("#sidebar-backdrop")?.classList.remove("is-visible");
  $("#menu-toggle")?.setAttribute("aria-expanded", "false");
}

function applyTheme(light) {
  document.documentElement.classList.toggle("light-mode", light);
  localStorage.setItem(STORAGE_THEME, light ? "light" : "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? "#f1f5f9" : "#0f172a");
}

function initTheme() {
  const saved = localStorage.getItem(STORAGE_THEME);
  if (saved === "light") applyTheme(true);
}

function totals(list) {
  let income = 0;
  let expense = 0;
  list.forEach((t) => {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  });
  return { income, expense, balance: income - expense };
}

function monthlyStats(list, year, month) {
  let income = 0;
  let expense = 0;
  list.forEach((t) => {
    const d = new Date(t.date + "T12:00:00");
    if (d.getFullYear() === year && d.getMonth() + 1 === month) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
  });
  return { income, expense, net: income - expense };
}

function categoryExpenseSegments(list) {
  const map = new Map();
  list.forEach((t) => {
    if (t.type !== "expense") return;
    const color = t.categoryColor || getCategoryMeta(t.category).color;
    const cur = map.get(t.category) || { value: 0, color };
    map.set(t.category, { value: cur.value + t.amount, color });
  });
  return [...map.entries()]
    .map(([label, { value, color }]) => ({ label, value, color }))
    .sort((a, b) => b.value - a.value);
}

function last6MonthsSeries(list) {
  const labels = [];
  const income = [];
  const expense = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const mo = d.getMonth() + 1;
    labels.push(d.toLocaleString("en-IN", { month: "short" }));
    const s = monthlyStats(list, y, mo);
    income.push(s.income);
    expense.push(s.expense);
  }
  return { labels, income, expense };
}

function refreshDashboard() {
  const { income, expense, balance } = totals(transactions);
  $("#sum-balance").textContent = formatMoney(balance);
  $("#sum-income").textContent = formatMoney(income);
  $("#sum-expense").textContent = formatMoney(expense);

  const now = new Date();
  const ms = monthlyStats(transactions, now.getFullYear(), now.getMonth() + 1);
  $("#month-income").textContent = formatMoney(ms.income);
  $("#month-expense").textContent = formatMoney(ms.expense);
  $("#month-net").textContent = formatMoney(ms.net);
  $("#month-net").className = ms.net >= 0 ? "" : "text-danger";
  $("#month-label").textContent = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

  renderRecent();
  scheduleCharts();
}

function renderRecent() {
  const ul = $("#recent-list");
  if (!ul) return;
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  ul.innerHTML = "";
  sorted.forEach((t) => {
    const li = document.createElement("li");
    li.className = "txn-item";
    const color = t.categoryColor || getCategoryMeta(t.category).color;
    const icon = getCategoryMeta(t.category).icon;
    li.innerHTML = `
      <span class="txn-item__stripe" style="background:${color}; box-shadow:0 0 16px ${color}66" aria-hidden="true"></span>
      <div class="txn-item__icon" aria-hidden="true" style="border-color:${color}44">${icon}</div>
      <div class="txn-item__body">
        <p class="txn-item__title">${escapeHtml(t.category)}</p>
        <p class="txn-item__meta">${formatDate(t.date)} · ${escapeHtml(t.note || "—")}</p>
      </div>
      <span class="txn-item__badge">${t.type}</span>
      <span class="txn-item__amount txn-item__amount--${t.type}">${t.type === "income" ? "+" : "−"}${formatMoney(t.amount)}</span>
    `;
    ul.appendChild(li);
  });
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function formatDate(iso) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

function scheduleCharts() {
  pieCancel();
  barCancel();
  window.removeEventListener("resize", resizeChartHandler);

  const pieCanvas = /** @type {HTMLCanvasElement} */ ($("#chart-pie"));
  const barCanvas = /** @type {HTMLCanvasElement} */ ($("#chart-bar"));
  if (!pieCanvas || !barCanvas) return;

  const segs = categoryExpenseSegments(transactions);
  pieCancel = animatePieChart(pieCanvas, segs, { formatCurrency: formatMoney });

  const barData = last6MonthsSeries(transactions);
  barCancel = animateBarChart(barCanvas, barData);

  resizeChartHandler = () => {
    if (!$("#page-dashboard")?.classList.contains("page--active")) return;
    pieCancel();
    barCancel();
    pieCancel = animatePieChart(pieCanvas, categoryExpenseSegments(transactions), {
      formatCurrency: formatMoney,
    });
    barCancel = animateBarChart(barCanvas, last6MonthsSeries(transactions));
  };
  window.addEventListener("resize", resizeChartHandler);
}

function filteredTransactions() {
  const q = ($("#hist-search")?.value || "").trim().toLowerCase();
  const cat = $("#hist-filter-cat")?.value || "";
  const from = $("#hist-from")?.value || "";
  const to = $("#hist-to")?.value || "";

  return transactions.filter((t) => {
    if (cat && t.category !== cat) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    if (q) {
      const hay = `${t.category} ${t.note || ""} ${t.type}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderHistoryTable() {
  const tbody = $("#history-body");
  const empty = $("#history-empty");
  if (!tbody) return;

  const rows = [...filteredTransactions()].sort((a, b) => b.date.localeCompare(a.date));
  tbody.innerHTML = "";

  if (rows.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  rows.forEach((t) => {
    const color = t.categoryColor || getCategoryMeta(t.category).color;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(t.date)}</td>
      <td>
        <span class="cat-badge">
          <span class="cat-dot" style="background:${color}; box-shadow:0 0 10px ${color}88"></span>
          ${escapeHtml(t.category)}
        </span>
      </td>
      <td><span class="type-pill type-pill--${t.type}">${t.type}</span></td>
      <td>${escapeHtml(t.note || "—")}</td>
      <td class="text-right ${t.type === "income" ? "amount-in" : "amount-out"}">${t.type === "income" ? "+" : "−"}${formatMoney(t.amount)}</td>
      <td class="text-right">
        <div class="table-actions">
          <button type="button" class="icon-action" data-edit="${t.id}" aria-label="Edit transaction">${iconPencil()}</button>
          <button type="button" class="icon-action icon-action--delete" data-del="${t.id}" aria-label="Delete transaction">${iconTrash()}</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.getAttribute("data-edit")));
  });
  tbody.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => deleteTransaction(btn.getAttribute("data-del")));
  });
}

function iconPencil() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
}

function iconTrash() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
}

function deleteTransaction(id) {
  transactions = transactions.filter((t) => t.id !== id);
  saveTransactions(transactions);
  toast("Transaction deleted", "success");
  renderHistoryTable();
  refreshDashboard();
}

function openEditModal(id) {
  const t = transactions.find((x) => x.id === id);
  if (!t) return;
  $("#edit-id").value = t.id;
  $("#edit-amount").value = String(t.amount);
  $("#edit-date").value = t.date;
  $("#edit-note").value = t.note || "";

  const sel = /** @type {HTMLSelectElement} */ ($("#edit-category"));
  sel.innerHTML = categoryOptionsHtml(false);
  sel.value = t.category in CATEGORY_META ? t.category : "Other";

  document.getElementById(`edit-type-${t.type}`).checked = true;

  syncCategoryAccent(sel, $("#edit-category-field"), $("#edit-category-preview"));

  $("#modal-overlay").hidden = false;
}

function closeModal() {
  $("#modal-overlay").hidden = true;
}

function exportCsv() {
  const headers = ["date", "category", "categoryColor", "type", "amount", "note"];
  const lines = [headers.join(",")];
  transactions.forEach((t) => {
    lines.push(
      [t.date, csvEscape(t.category), t.categoryColor, t.type, t.amount, csvEscape(t.note || "")].join(",")
    );
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `apexspend-inr-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("CSV exported successfully");
}

function csvEscape(s) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function refreshProfileUI() {
  $("#user-greeting-name").textContent = profile.name;
  $("#prof-name").value = profile.name;
  $("#prof-email").value = profile.email;
  $("#profile-name-display").textContent = profile.name;
  $("#profile-email-display").textContent = profile.email;

  const ini = initials(profile.name);
  $("#avatar-placeholder").textContent = ini;
  $("#profile-avatar-display").textContent = ini;

  const hue = profile.avatarHue ?? 210;
  const grad = `linear-gradient(135deg, hsl(${hue}, 75%, 52%), hsl(${(hue + 40) % 360}, 70%, 45%))`;
  $(".avatar-btn").style.background = grad;
  $("#profile-avatar-display").style.background = grad;
}

function initDateInputs() {
  const today = new Date().toISOString().slice(0, 10);
  $("#tx-date").value = today;
}

document.addEventListener("DOMContentLoaded", () => {
  populateCategorySelects();
  wireCategorySelect(
    /** @type {HTMLSelectElement} */ ($("#tx-category")),
    $("#add-category-field"),
    $("#add-category-preview")
  );
  wireCategorySelect(
    /** @type {HTMLSelectElement} */ ($("#edit-category")),
    $("#edit-category-field"),
    $("#edit-category-preview")
  );

  initTheme();
  initDateInputs();
  refreshProfileUI();

  const loader = $("#loading-overlay");
  requestAnimationFrame(() => {
    setTimeout(() => {
      loader?.classList.add("is-done");
      loader?.setAttribute("aria-busy", "false");
    }, 550);
  });

  $("#topbar-date").textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  document.querySelectorAll("[data-page]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const p = el.dataset.page;
      if (!p) return;
      e.preventDefault();
      setPage(p);
      document.getElementById("avatar-menu")?.setAttribute("hidden", "");
      $("#avatar-toggle")?.setAttribute("aria-expanded", "false");
    });
  });

  $("#menu-toggle")?.addEventListener("click", () => {
    const side = $("#sidebar");
    const open = side?.classList.toggle("is-open");
    $("#sidebar-backdrop")?.classList.toggle("is-visible", open);
    $("#menu-toggle")?.setAttribute("aria-expanded", open ? "true" : "false");
  });

  $("#sidebar-backdrop")?.addEventListener("click", closeMobileSidebar);

  $("#sidebar-collapse")?.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-collapsed");
    $("#sidebar")?.classList.toggle("is-collapsed-desktop");
  });

  $("#theme-toggle")?.addEventListener("click", () => {
    const light = !document.documentElement.classList.contains("light-mode");
    applyTheme(light);
    toast(light ? "Light mode on" : "Dark mode on");
    scheduleCharts();
  });

  $("#avatar-toggle")?.addEventListener("click", () => {
    const menu = $("#avatar-menu");
    const open = menu?.hasAttribute("hidden");
    if (open) menu?.removeAttribute("hidden");
    else menu?.setAttribute("hidden", "");
    $("#avatar-toggle")?.setAttribute("aria-expanded", open ? "true" : "false");
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".avatar-dropdown")) {
      $("#avatar-menu")?.setAttribute("hidden", "");
      $("#avatar-toggle")?.setAttribute("aria-expanded", "false");
    }
  });

  $("#btn-export-csv")?.addEventListener("click", exportCsv);

  $("#form-transaction")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = parseFloat($("#tx-amount").value);
    const category = $("#tx-category").value;
    const type = /** @type {'income'|'expense'} */ (document.querySelector('input[name="type"]:checked')?.value || "expense");
    const date = $("#tx-date").value;
    const note = $("#tx-note").value.trim();
    const meta = getCategoryMeta(category);

    if (!amount || amount <= 0 || !category || !date) {
      toast("Please fill all required fields", "error");
      return;
    }

    transactions.unshift(
      normalizeTx({
        id: uid(),
        amount,
        category: meta.key,
        categoryColor: meta.color,
        type,
        date,
        note,
      })
    );
    saveTransactions(transactions);
    e.target.reset();
    $("#tx-date").value = new Date().toISOString().slice(0, 10);
    document.getElementById("type-expense").checked = true;
    syncCategoryAccent(
      /** @type {HTMLSelectElement} */ ($("#tx-category")),
      $("#add-category-field"),
      $("#add-category-preview")
    );
    toast("Transaction added");
    setPage("dashboard");
    refreshDashboard();
  });

  $("#hist-search")?.addEventListener("input", renderHistoryTable);
  $("#hist-filter-cat")?.addEventListener("change", renderHistoryTable);
  $("#hist-from")?.addEventListener("change", renderHistoryTable);
  $("#hist-to")?.addEventListener("change", renderHistoryTable);

  $("#modal-cancel")?.addEventListener("click", closeModal);
  $("#modal-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });

  $("#form-edit-transaction")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = $("#edit-id").value;
    const amount = parseFloat($("#edit-amount").value);
    const category = $("#edit-category").value;
    const type = /** @type {'income'|'expense'} */ (document.querySelector('input[name="edit-type"]:checked')?.value || "expense");
    const date = $("#edit-date").value;
    const note = $("#edit-note").value.trim();
    const meta = getCategoryMeta(category);

    const idx = transactions.findIndex((x) => x.id === id);
    if (idx === -1) return;
    transactions[idx] = normalizeTx({
      ...transactions[idx],
      amount,
      category: meta.key,
      categoryColor: meta.color,
      type,
      date,
      note,
    });
    saveTransactions(transactions);
    closeModal();
    toast("Transaction updated");
    renderHistoryTable();
    refreshDashboard();
  });

  $("#form-profile")?.addEventListener("submit", (e) => {
    e.preventDefault();
    profile.name = $("#prof-name").value.trim() || profile.name;
    profile.email = $("#prof-email").value.trim() || profile.email;
    saveProfile(profile);
    refreshProfileUI();
    toast("Profile saved");
  });

  $("#btn-random-avatar")?.addEventListener("click", () => {
    profile.avatarHue = Math.floor(Math.random() * 360);
    saveProfile(profile);
    refreshProfileUI();
    toast("Avatar style updated");
  });

  const logout = () => {
    toast("Signed out. Your data stays on this device.");
    document.getElementById("avatar-menu")?.setAttribute("hidden", "");
    $("#avatar-toggle")?.setAttribute("aria-expanded", "false");
    setPage("dashboard");
  };

  $("#menu-logout")?.addEventListener("click", logout);
  $("#btn-logout-profile")?.addEventListener("click", logout);

  setPage("dashboard");
});
