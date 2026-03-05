// =============================
// UTILITIES
// =============================
const moneyFormatter = new Intl.NumberFormat("vi-VN");
const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const el = {
  branchName: document.getElementById("branchName"),
  todayRevenue: document.getElementById("todayRevenue"),
  tablesView: document.getElementById("tablesView"),
  revenueView: document.getElementById("revenueView"),
  settingsView: document.getElementById("settingsView"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  closeModalBtn: document.getElementById("closeModalBtn")
};

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toNonNegativeNumber(value, fallback = 0) {
  const n = toFiniteNumber(value, fallback);
  return n >= 0 ? n : fallback;
}

function toPercentNumber(value, fallback = 0) {
  return Math.min(100, toNonNegativeNumber(value, fallback));
}

function sanitizeNumberInputValue(rawValue, allowDecimal = false) {
  let value = String(rawValue ?? "").replace(",", ".");
  value = value.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, "");
  if (allowDecimal) {
    const firstDotIndex = value.indexOf(".");
    if (firstDotIndex !== -1) {
      value = value.slice(0, firstDotIndex + 1) + value.slice(firstDotIndex + 1).replace(/\./g, "");
    }
  }
  return value;
}

function formatMoney(value) {
  return `${moneyFormatter.format(toFiniteNumber(value, 0))} đ`;
}

function formatTime(value) {
  if (!value) return "--";
  return timeFormatter.format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "--";
  return dateTimeFormatter.format(new Date(value));
}

function formatStartMoment(value) {
  if (!value) return "--";
  const dateObj = new Date(value);
  return `${timeFormatter.format(dateObj)} - ${dateFormatter.format(dateObj)}`;
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function isToday(value) {
  const d = new Date(value);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function toIsoNow() {
  return new Date().toISOString();
}

function makeInvoiceId() {
  const tail = Date.now().toString().slice(-6);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HD-${tail}-${rand}`;
}

function renderChargeRow(label, amount, enabled = true) {
  if (!enabled) return "";
  return `<div class="kv"><span>${label}</span><strong>${formatMoney(amount)}</strong></div>`;
}

function formatDateDDMMYYYY(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

function formatAmountWithDot(total) {
  const raw = String(Math.max(0, toFiniteNumber(total, 0)));
  const [intPart, decimalPartRaw = ""] = raw.split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimalPart = decimalPartRaw.replace(/0+$/, "");
  return decimalPart ? `${formattedInt},${decimalPart}` : formattedInt;
}
