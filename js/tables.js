// =============================
// BUSINESS LOGIC
// =============================
function getTableById(tableId) {
  return STATE.tables.find(t => t.id === Number(tableId));
}

function getTableStatusText(status) {
  if (status === "playing") return "Đang chơi";
  if (status === "stopped") return "Tạm dừng";
  return "Trống";
}

function clearTableInterval(table) {
  if (!table || !table.intervalId) return;
  clearInterval(table.intervalId);
  table.intervalId = null;
}

function refreshTableCardMetrics(table) {
  if (!table) return;
  const card = document.querySelector(`.table-card[data-table-id="${table.id}"]`);
  if (!card) return;

  const bill = calculateBill(table);
  const startedAt = table.sessionStartTime || table.startTime;

  card.classList.remove("idle", "playing", "stopped");
  card.classList.add(table.status);

  const statusEl = card.querySelector(".status");
  if (statusEl) {
    statusEl.className = `status ${table.status}`;
    statusEl.textContent = getTableStatusText(table.status);
  }

  const timer = card.querySelector('[data-role="timer"]');
  const total = card.querySelector('[data-role="temp-total"]');
  const startMoment = card.querySelector('[data-role="start-moment"]');
  if (timer) timer.textContent = formatDuration(bill.elapsedSeconds);
  if (total) total.textContent = formatMoney(bill.total);
  if (startMoment) startMoment.textContent = formatStartMoment(startedAt);
}

function refreshTableModalMetrics(table) {
  if (!table || STATE.modal.type !== "table" || Number(STATE.modal.id) !== table.id) return;
  const bill = calculateBill(table);
  const startedAt = table.sessionStartTime || table.startTime;

  const timer = document.querySelector('[data-role="modal-timer"]');
  const total = document.querySelector('[data-role="modal-total"]');
  const startMoment = document.querySelector('[data-role="modal-start-moment"]');
  if (timer) timer.textContent = formatDuration(bill.elapsedSeconds);
  if (total) total.textContent = formatMoney(bill.total);
  if (startMoment) startMoment.textContent = formatStartMoment(startedAt);
}

function updateTableUI(tableId, options = {}) {
  const table = getTableById(tableId);
  if (!table) return;

  if (options.refreshList) {
    renderTables();
  } else {
    refreshTableCardMetrics(table);
  }

  if ((STATE.modal.type === "table" || STATE.modal.type === "payment") && Number(STATE.modal.id) === table.id) {
    renderModalContent();
  }
}

function startTableInterval(table) {
  if (!table || table.status !== "playing") return;
  clearTableInterval(table);

  table.intervalId = setInterval(() => {
    const currentTable = getTableById(table.id);
    if (!currentTable || currentTable.status !== "playing") {
      clearTableInterval(currentTable || table);
      return;
    }
    refreshTableCardMetrics(currentTable);
    refreshTableModalMetrics(currentTable);
  }, 1000);
}

function restoreRunningTableIntervals() {
  STATE.tables.forEach(table => {
    if (table.status === "playing") {
      startTableInterval(table);
    } else {
      table.intervalId = null;
    }
  });
}

function calculateHourlyRate(table) {
  if (table.hourlyRateOverride !== null && table.hourlyRateOverride !== undefined && table.hourlyRateOverride !== "") {
    return toNonNegativeNumber(table.hourlyRateOverride, 0);
  }
  if (table.type === "phang") return toNonNegativeNumber(STATE.config.hourlyRatePhang, 0);
  return toNonNegativeNumber(STATE.config.hourlyRateLo, 0);
}

function getTableTypeLabel(type) {
  return type === "phang" ? "Bida phăng" : "Bida lỗ";
}

function renderTableTypeBadge(type) {
  return `<span class="table-type-badge ${type}">${getTableTypeLabel(type)}</span>`;
}

function getElapsedSeconds(table, atTimeMs = Date.now()) {
  if (table.status === "playing" && table.startTime) {
    const running = Math.max(0, Math.floor((atTimeMs - new Date(table.startTime).getTime()) / 1000));
    return table.elapsedBeforeStopSec + running;
  }
  return table.elapsedBeforeStopSec;
}

function calculateDrinkTotal(items) {
  return items.reduce((sum, item) => sum + (toNonNegativeNumber(item.price, 0) * toNonNegativeNumber(item.qty, 0)), 0);
}

function isTaxEnabled() {
  return Boolean(STATE.config.enableTax) && toNonNegativeNumber(STATE.config.taxPercent, 0) > 0;
}

function isServiceFeeEnabled() {
  return Boolean(STATE.config.enableServiceFee) && toNonNegativeNumber(STATE.config.serviceFeePercent, 0) > 0;
}

// Bỏ hoàn toàn làm tròn: tính theo phút thực tế.
function calculateBill(table, atTimeMs = Date.now()) {
  const elapsedSeconds = getElapsedSeconds(table, atTimeMs);
  const rawMinutes = elapsedSeconds / 60;
  const hourMoney = (rawMinutes / 60) * calculateHourlyRate(table);
  const itemMoney = calculateDrinkTotal(table.items);
  const subtotal = hourMoney + itemMoney;
  const serviceFee = isServiceFeeEnabled()
    ? subtotal * (toNonNegativeNumber(STATE.config.serviceFeePercent, 0) / 100)
    : 0;
  const taxableBase = subtotal + serviceFee;
  const tax = isTaxEnabled()
    ? taxableBase * (toNonNegativeNumber(STATE.config.taxPercent, 0) / 100)
    : 0;
  const total = subtotal + tax + serviceFee;

  return {
    elapsedSeconds,
    rawMinutes,
    hourMoney,
    itemMoney,
    tax,
    serviceFee,
    total
  };
}

function filterTables() {
  const query = STATE.tableUi.searchQuery.trim().toLowerCase();
  const filteredByText = STATE.tables.filter(table => {
    if (!query) return true;
    return table.name.toLowerCase().includes(query) || String(table.id).includes(query);
  });

  const mode = STATE.tableUi.activeFilter;
  return filteredByText.filter(table => {
    if (mode === "all") return true;
    if (mode === "lo") return table.type === "lo";
    if (mode === "phang") return table.type === "phang";
    if (mode === "playing") return table.status === "playing";
    if (mode === "idle") return table.status === "idle";
    return true;
  });
}

function getPaginatedTables() {
  const filtered = filterTables();
  const totalPages = Math.max(1, Math.ceil(filtered.length / STATE.tableUi.perPage));
  if (STATE.tableUi.currentPage > totalPages) {
    STATE.tableUi.currentPage = totalPages;
  }

  const start = (STATE.tableUi.currentPage - 1) * STATE.tableUi.perPage;
  const end = start + STATE.tableUi.perPage;
  return {
    rows: filtered.slice(start, end),
    totalItems: filtered.length,
    totalPages,
    currentPage: STATE.tableUi.currentPage
  };
}

function handleStart(tableId) {
  const table = getTableById(tableId);
  if (!table) return { ok: false, message: "Không tìm thấy bàn." };
  if (table.status === "playing") {
    return { ok: false, message: "Bàn đang chơi, không thể bắt đầu lại." };
  }

  const nowIso = toIsoNow();
  if (table.status === "idle") {
    table.elapsedBeforeStopSec = 0;
    table.sessionStartTime = nowIso;
  }
  if (!table.sessionStartTime) {
    table.sessionStartTime = nowIso;
  }

  table.status = "playing";
  table.startTime = nowIso;
  startTableInterval(table);
  saveData();
  updateTableUI(table.id, { refreshList: true });
  return { ok: true };
}

function handleStop(tableId, options = {}) {
  const table = getTableById(tableId);
  if (!table || table.status !== "playing") return;

  table.elapsedBeforeStopSec = getElapsedSeconds(table);
  clearTableInterval(table);
  table.startTime = null;
  table.status = "stopped";
  saveData();

  if (!options.silent) {
    updateTableUI(table.id, { refreshList: true });
  }
}
function resetTable(tableId) {
  const table = getTableById(tableId);
  if (!table) return;
  const confirmed = window.confirm(`Xác nhận reset ${table.name}?`);
  if (!confirmed) return;
  clearTableSession(table);
  saveData();
  closeModal();
  render();
}

function clearTableSession(table) {
  clearTableInterval(table);
  table.status = "idle";
  table.startTime = null;
  table.sessionStartTime = null;
  table.elapsedBeforeStopSec = 0;
  table.items = [];
  table.hourlyRateOverride = null;
}

function addItemToTable(tableId, drinkId) {
  const table = getTableById(tableId);
  const drink = STATE.drinkMenu.find(d => d.id === drinkId);
  if (!table || !drink) return;

  const existed = table.items.find(i => i.id === drink.id);
  if (existed) {
    existed.qty += 1;
  } else {
    table.items.push({
      id: drink.id,
      name: drink.name,
      price: drink.price,
      category: drink.category,
      qty: 1
    });
  }

  saveData();
  renderTables();
  renderModalContent();
}

function removeItemFromTable(tableId, drinkId) {
  const table = getTableById(tableId);
  if (!table) return;
  const index = table.items.findIndex(i => i.id === drinkId);
  if (index < 0) return;

  if (table.items[index].qty > 1) {
    table.items[index].qty -= 1;
  } else {
    table.items.splice(index, 1);
  }

  saveData();
  renderTables();
  renderModalContent();
}

function setTableRateOverride(tableId, value) {
  const table = getTableById(tableId);
  if (!table) return;
  const next = Number(value);
  table.hourlyRateOverride = Number.isFinite(next) && next > 0 ? next : null;
  saveData();
  renderTables();
  renderModalContent();
}

function addTable(name, type) {
  const tableName = String(name || "").trim();
  if (!tableName) {
    window.alert("Vui lòng nhập tên bàn.");
    return;
  }

  const nextId = STATE.tables.length ? Math.max(...STATE.tables.map(t => t.id)) + 1 : 1;
  STATE.tables.push({
    id: nextId,
    name: tableName,
    type: type === "phang" ? "phang" : "lo",
    status: "idle",
    startTime: null,
    sessionStartTime: null,
    elapsedBeforeStopSec: 0,
    items: [],
    hourlyRateOverride: null,
    intervalId: null
  });

  saveData();
  render();
}

function deleteTable(tableId) {
  const table = getTableById(tableId);
  if (!table) return { ok: false, message: "Không tìm thấy bàn." };
  if (table.status === "playing") {
    return { ok: false, message: "Không thể xóa bàn đang chơi." };
  }

  clearTableInterval(table);
  STATE.tables = STATE.tables.filter(t => t.id !== table.id);
  saveData();
  render();
  return { ok: true };
}

function updateTableType(tableId, nextType) {
  const table = getTableById(tableId);
  if (!table) return;
  table.type = nextType === "phang" ? "phang" : "lo";
  saveData();
  render();
  if (STATE.modal.type === "table" && Number(STATE.modal.id) === table.id) {
    renderModalContent();
  }
}


function getTodayInvoices() {
  return STATE.invoices.filter(inv => isToday(inv.endTime));
}

function updateRevenue() {
  const invoices = getTodayInvoices();
  const summary = invoices.reduce((acc, inv) => {
    acc.total += Number(inv.total) || 0;
    acc.hourMoney += Number(inv.hourMoney) || 0;
    acc.itemMoney += Number(inv.itemMoney) || 0;
    acc.tax += Number(inv.tax) || 0;
    acc.serviceFee += Number(inv.serviceFee) || 0;
    if (inv.tableType === "phang") acc.totalPhang += Number(inv.total) || 0;
    else acc.totalLo += Number(inv.total) || 0;
    return acc;
  }, {
    total: 0,
    hourMoney: 0,
    itemMoney: 0,
    tax: 0,
    serviceFee: 0,
    totalLo: 0,
    totalPhang: 0
  });

  el.todayRevenue.textContent = formatMoney(summary.total);
  return {
    ...summary,
    paidTables: invoices.length,
    invoices
  };
}

function saveData() {
  const serializableTables = STATE.tables.map(table => {
    const { intervalId, ...rest } = table;
    return rest;
  });

  const payload = {
    config: STATE.config,
    tableUi: STATE.tableUi,
    tables: serializableTables,
    drinkMenu: STATE.drinkMenu,
    invoices: STATE.invoices
  };
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(payload));
}

function loadData() {
  const raw = localStorage.getItem(CONFIG.storageKey);
  if (!raw) {
    STATE.tables = DATA_MOCK.tables.map(t => ({ ...t }));
    STATE.drinkMenu = DATA_MOCK.drinkMenu.map(d => ({ ...d }));
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const legacyRate = toNonNegativeNumber(parsed.config?.hourlyRate, CONFIG.defaultHourlyRateLo);
    STATE.config = {
      hourlyRateLo: toNonNegativeNumber(parsed.config?.hourlyRateLo, legacyRate),
      hourlyRatePhang: toNonNegativeNumber(parsed.config?.hourlyRatePhang, legacyRate),
      enableTax: parsed.config?.enableTax !== undefined
        ? Boolean(parsed.config.enableTax)
        : CONFIG.defaultEnableTax,
      taxPercent: toPercentNumber(parsed.config?.taxPercent, CONFIG.defaultTaxPercent),
      enableServiceFee: parsed.config?.enableServiceFee !== undefined
        ? Boolean(parsed.config.enableServiceFee)
        : CONFIG.defaultEnableServiceFee,
      serviceFeePercent: toPercentNumber(parsed.config?.serviceFeePercent, CONFIG.defaultServiceFeePercent)
    };

    STATE.tableUi = {
      searchQuery: parsed.tableUi?.searchQuery || "",
      activeFilter: parsed.tableUi?.activeFilter || "all",
      currentPage: Math.max(1, toFiniteNumber(parsed.tableUi?.currentPage, 1)),
      perPage: 8
    };

    STATE.tables = Array.isArray(parsed.tables) && parsed.tables.length
      ? parsed.tables.map((t, index) => {
        const status = ["idle", "playing", "stopped"].includes(t.status) ? t.status : "idle";
        const fallbackStartTime = status === "playing" ? toIsoNow() : null;
        const startTime = t.startTime || fallbackStartTime;

        return {
          id: Math.max(1, toFiniteNumber(t.id, index + 1)),
          name: t.name,
          type: t.type === "phang" ? "phang" : "lo",
          status,
          startTime,
          sessionStartTime: t.sessionStartTime || startTime || null,
          elapsedBeforeStopSec: toNonNegativeNumber(t.elapsedBeforeStopSec, 0),
          items: Array.isArray(t.items)
            ? t.items.map(i => ({
              id: i.id,
              name: i.name,
              price: toNonNegativeNumber(i.price, 0),
              category: i.category || "Khác",
              qty: Math.max(1, toFiniteNumber(i.qty, 1))
            }))
            : [],
          hourlyRateOverride: t.hourlyRateOverride ?? null,
          intervalId: null
        };
      })
      : DATA_MOCK.tables.map(t => ({ ...t }));

    STATE.drinkMenu = Array.isArray(parsed.drinkMenu) && parsed.drinkMenu.length
      ? parsed.drinkMenu.map(d => ({
        id: d.id,
        name: d.name,
        price: toNonNegativeNumber(d.price, 0),
        category: d.category || "Khác"
      }))
      : DATA_MOCK.drinkMenu.map(d => ({ ...d }));

    STATE.invoices = Array.isArray(parsed.invoices)
      ? parsed.invoices.map(inv => ({
        ...inv,
        tableType: inv.tableType === "phang" ? "phang" : "lo",
        hourlyRateUsed: toNonNegativeNumber(inv.hourlyRateUsed, (inv.tableType === "phang" ? STATE.config.hourlyRatePhang : STATE.config.hourlyRateLo)),
        paymentMethod: inv.paymentMethod === "transfer" ? "bank" : (inv.paymentMethod || "cash"),
        cashGiven: inv.cashGiven ?? inv.cashReceived ?? null,
        change: inv.change ?? inv.changeMoney ?? null,
        bankConfirmed: inv.bankConfirmed ?? (inv.paymentMethod === "bank" || inv.paymentMethod === "transfer" ? true : null)
      }))
      : [];
  } catch (error) {
    console.error("loadData error", error);
    STATE.tables = DATA_MOCK.tables.map(t => ({ ...t }));
    STATE.drinkMenu = DATA_MOCK.drinkMenu.map(d => ({ ...d }));
    STATE.invoices = [];
  }
}
// =============================
// UI RENDERING
// =============================
function renderSearch() {
  const toolbar = document.getElementById("tableToolbar");
  if (!toolbar) return;

  if (!toolbar.innerHTML.trim()) {
    toolbar.innerHTML = `
      <div class="table-toolbar-left">
        <input id="tableSearchInput" class="table-search" type="text" placeholder="Tìm bàn..." />
      </div>
      <div id="tableFilters" class="table-filters"></div>
      <div id="tableSearchMeta" class="table-search-meta"></div>
    `;
  }

  const searchInput = document.getElementById("tableSearchInput");
  const searchMeta = document.getElementById("tableSearchMeta");
  if (searchInput && document.activeElement !== searchInput) {
    searchInput.value = STATE.tableUi.searchQuery;
  }

  if (searchMeta) {
    const totalItems = filterTables().length;
    searchMeta.textContent = `Kết quả: ${totalItems} bàn`;
  }
}

function renderFilters() {
  const container = document.getElementById("tableFilters");
  if (!container) return;

  const options = [
    { id: "all", label: "Tất cả" },
    { id: "lo", label: "Bida lỗ" },
    { id: "phang", label: "Bida phăng" },
    { id: "playing", label: "Đang chơi" },
    { id: "idle", label: "Trống" }
  ];

  container.innerHTML = options.map(option => `
    <button
      class="filter-btn ${STATE.tableUi.activeFilter === option.id ? "active" : ""}"
      data-action="set-filter"
      data-filter="${option.id}"
    >${option.label}</button>
  `).join("");
}

function renderPagination(totalPages) {
  const pagination = document.getElementById("tablePagination");
  if (!pagination) return;

  const current = STATE.tableUi.currentPage;
  let pageButtons = "";
  for (let i = 1; i <= totalPages; i += 1) {
    pageButtons += `
      <button class="page-btn ${i === current ? "active" : ""}" data-action="goto-page" data-page="${i}">${i}</button>
    `;
  }

  pagination.innerHTML = `
    <button class="page-btn nav" data-action="prev-page" ${current <= 1 ? "disabled" : ""}>Trang trước</button>
    <div class="page-numbers">${pageButtons}</div>
    <button class="page-btn nav" data-action="next-page" ${current >= totalPages ? "disabled" : ""}>Trang sau</button>
  `;
}

function renderTables() {
  if (!document.getElementById("tableToolbar")) {
    el.tablesView.innerHTML = `
      <div id="tableToolbar" class="table-toolbar"></div>
      <div id="tableGrid" class="table-grid"></div>
      <div id="tablePagination" class="table-pagination"></div>
    `;
  }

  renderSearch();
  renderFilters();
  const { rows, totalPages, totalItems } = getPaginatedTables();
  const grid = document.getElementById("tableGrid");
  if (!grid) return;

  if (!totalItems) {
    grid.innerHTML = `<div class="empty-table-result">Không tìm thấy bàn phù hợp.</div>`;
    renderPagination(1);
    return;
  }

  const cards = rows.map(table => {
    const bill = calculateBill(table);
    const drinkCount = table.items.reduce((sum, item) => sum + item.qty, 0);
    const startedAt = table.sessionStartTime || table.startTime;

    return `
      <article class="table-card ${table.status}" data-table-id="${table.id}">
        <div class="table-head-row">
          <h3>${table.name}</h3>
          ${renderTableTypeBadge(table.type)}
        </div>
        <div class="status ${table.status}">${getTableStatusText(table.status)}</div>
        <div class="table-meta">Mã bàn: <strong>#${table.id}</strong></div>
        <div class="table-meta start-meta">
          <span>Bắt đầu lúc:</span>
          <strong data-role="start-moment">${formatStartMoment(startedAt)}</strong>
        </div>
        <div class="table-meta">Thời gian: <strong data-role="timer">${formatDuration(bill.elapsedSeconds)}</strong></div>
        <div class="table-meta">Đồ uống: <strong>${drinkCount}</strong></div>
        <div class="table-total" data-role="temp-total">${formatMoney(bill.total)}</div>
      </article>
    `;
  }).join("");

  grid.innerHTML = cards;
  grid.classList.remove("page-animate");
  void grid.offsetWidth;
  grid.classList.add("page-animate");

  renderPagination(totalPages);
}

function renderRevenue() {
  const summary = updateRevenue();
  const rows = summary.invoices.map(inv => `
    <tr>
      <td>${inv.id}</td>
      <td>${inv.tableName}</td>
      <td>${getTableTypeLabel(inv.tableType)}</td>
      <td>${formatTime(inv.startTime)}</td>
      <td>${formatTime(inv.endTime)}</td>
      <td>${formatMoney(inv.total)}</td>
      <td><button class="btn ghost" data-action="view-invoice" data-id="${inv.id}">Xem chi tiết</button></td>
    </tr>
  `).join("");

  el.revenueView.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card revenue-primary"><span>Tổng doanh thu hôm nay</span><strong>${formatMoney(summary.total)}</strong></div>
      <div class="stat-card"><span>Tổng số bàn đã thanh toán</span><strong>${summary.paidTables}</strong></div>
      <div class="stat-card"><span>Tổng tiền giờ</span><strong>${formatMoney(summary.hourMoney)}</strong></div>
      <div class="stat-card"><span>Tổng tiền nước</span><strong>${formatMoney(summary.itemMoney)}</strong></div>
      <div class="stat-card"><span>Tổng thuế</span><strong>${formatMoney(summary.tax)}</strong></div>
      <div class="stat-card"><span>Tổng phí dịch vụ</span><strong>${formatMoney(summary.serviceFee)}</strong></div>
      <div class="stat-card"><span>Tổng tiền Bida lỗ</span><strong>${formatMoney(summary.totalLo)}</strong></div>
      <div class="stat-card"><span>Tổng tiền Bida phăng</span><strong>${formatMoney(summary.totalPhang)}</strong></div>
    </div>
    <div class="panel">
      <table>
        <thead>
          <tr>
            <th>Mã hóa đơn</th>
            <th>Tên bàn</th>
            <th>Loại bàn</th>
            <th>Giờ bắt đầu</th>
            <th>Giờ kết thúc</th>
            <th>Tổng tiền</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td class="empty" colspan="7">Chưa có hóa đơn hôm nay.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderSettings() {
  const tableRows = STATE.tables.map(table => `
    <div class="table-admin-row">
      <div class="table-admin-main">
        <strong>${table.name}</strong>
        <small>#${table.id}</small>
      </div>
      <select class="table-admin-type" data-action="change-table-type" data-table-id="${table.id}">
        <option value="lo" ${table.type === "lo" ? "selected" : ""}>Bida lỗ</option>
        <option value="phang" ${table.type === "phang" ? "selected" : ""}>Bida phăng</option>
      </select>
      <button class="btn stop" data-action="delete-table" data-table-id="${table.id}">Xóa</button>
    </div>
  `).join("");

  el.settingsView.innerHTML = `
    <div class="panel" style="padding:16px;">
      <form id="settingsForm" class="settings-form">
        <div class="field">
          <label for="hourlyRateLo">Giá giờ Bida lỗ (đ)</label>
          <input id="hourlyRateLo" name="hourlyRateLo" type="number" min="0" step="1000" value="${STATE.config.hourlyRateLo}" required />
        </div>
        <div class="field">
          <label for="hourlyRatePhang">Giá giờ Bida phăng (đ)</label>
          <input id="hourlyRatePhang" name="hourlyRatePhang" type="number" min="0" step="1000" value="${STATE.config.hourlyRatePhang}" required />
        </div>
        <div class="field full">
          <label style="display:flex;align-items:center;gap:8px;">
            <input id="enableTax" name="enableTax" type="checkbox" ${STATE.config.enableTax ? "checked" : ""} />
            Tính thuế
          </label>
        </div>
        <div class="field">
          <label for="taxPercent">Thuế (%)</label>
          <input id="taxPercent" name="taxPercent" type="number" min="0" max="100" step="0.1" value="${STATE.config.taxPercent}" required />
        </div>
        <div class="field full">
          <label style="display:flex;align-items:center;gap:8px;">
            <input id="enableServiceFee" name="enableServiceFee" type="checkbox" ${STATE.config.enableServiceFee ? "checked" : ""} />
            Tính phí dịch vụ
          </label>
        </div>
        <div class="field">
          <label for="serviceFeePercent">Phí dịch vụ (%)</label>
          <input id="serviceFeePercent" name="serviceFeePercent" type="number" min="0" max="100" step="0.1" value="${STATE.config.serviceFeePercent}" required />
        </div>
        <div class="field full">
          <button class="btn pay" type="submit">Lưu cấu hình</button>
        </div>
      </form>
    </div>

    <div class="panel table-admin-panel">
      <div class="table-admin-section">
        <h3>Thêm bàn mới</h3>
        <form id="addTableForm" class="table-admin-add">
          <input name="tableName" type="text" placeholder="Tên bàn mới" required />
          <select name="tableType">
            <option value="lo">Bida lỗ</option>
            <option value="phang">Bida phăng</option>
          </select>
          <button class="btn start" type="submit">Thêm bàn</button>
        </form>
      </div>
      <div class="table-admin-section">
        <h3>Danh sách bàn</h3>
        <div class="table-admin-list">
          ${tableRows || `<div class="empty">Chưa có bàn.</div>`}
        </div>
      </div>
    </div>
  `;
}

function renderTableDetailModal(table) {
  const bill = calculateBill(table);
  const startedAt = table.sessionStartTime || table.startTime;
  const menuHtml = STATE.drinkMenu.map(d => `
    <div class="row-item">
      <div>
        <small>${d.category}</small>
        <strong>${d.name}</strong>
        <small>${formatMoney(d.price)}</small>
      </div>
      <button class="btn start" data-action="add-item" data-table-id="${table.id}" data-drink-id="${d.id}">+ Thêm</button>
    </div>
  `).join("");

  const orderHtml = table.items.map(item => `
    <div class="row-item">
      <div>
        <strong>${item.name}</strong>
        <small>${formatMoney(item.price)} / món</small>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <span>x${item.qty}</span>
        <button class="btn stop" data-action="remove-item" data-table-id="${table.id}" data-drink-id="${item.id}">- Bớt</button>
      </div>
    </div>
  `).join("");

  el.modalTitle.textContent = `${table.name} - Chi tiết`;
  el.modalBody.innerHTML = `
    <section class="card">
      <h4>Thông tin bàn</h4>
      <div class="kv"><span>Loại bàn</span><strong>${getTableTypeLabel(table.type)}</strong></div>
      <div class="kv"><span>Trạng thái</span><strong>${getTableStatusText(table.status)}</strong></div>
      <div class="kv"><span>Bắt đầu</span><strong data-role="modal-start-moment">${formatStartMoment(startedAt)}</strong></div>
      <div class="kv"><span>Thời gian chơi</span><strong data-role="modal-timer">${formatDuration(bill.elapsedSeconds)}</strong></div>
      <div class="kv"><span>Đơn giá giờ</span><strong>${formatMoney(calculateHourlyRate(table))}</strong></div>
      <div class="kv"><span>Tiền giờ</span><strong>${formatMoney(bill.hourMoney)}</strong></div>
      <div class="kv"><span>Tiền nước</span><strong>${formatMoney(bill.itemMoney)}</strong></div>
      ${renderChargeRow("Phí dịch vụ", bill.serviceFee, isServiceFeeEnabled())}
      ${renderChargeRow("Thuế", bill.tax, isTaxEnabled())}
      <div class="kv"><span>Tổng tạm tính</span><strong data-role="modal-total">${formatMoney(bill.total)}</strong></div>
      <div class="actions">
        <button class="btn start" data-action="start-table" data-table-id="${table.id}" ${table.status === "playing" ? "disabled" : ""}>Bắt đầu</button>
        <button class="btn stop" data-action="stop-table" data-table-id="${table.id}" ${table.status !== "playing" ? "disabled" : ""}>Dừng</button>
        <button class="btn pay" data-action="open-payment" data-table-id="${table.id}">Thanh toán</button>
        <button class="btn warn" data-action="reset-table" data-table-id="${table.id}">Reset bàn</button>
      </div>
    </section>
    <section class="card">
      <h4>Menu đồ uống</h4>
      <div class="scroll-list">${menuHtml}</div>
    </section>
    <section class="card">
      <h4>Đồ uống của bàn</h4>
      <div class="scroll-list">${orderHtml || `<div class="empty">Chưa có món.</div>`}</div>
    </section>
    <section class="card">
      <h4>Cấu hình bàn</h4>
      <div class="kv"><span>Phút thực tế</span><strong>${bill.rawMinutes.toFixed(1)}</strong></div>
      <div class="field" style="margin-top:8px;">
        <label>Giá giờ override (đ, để trống = mặc định)</label>
        <input id="tableRateOverrideInput" type="number" min="0" step="1000" value="${table.hourlyRateOverride || ""}" data-table-id="${table.id}" />
      </div>
      <div class="actions">
        <button class="btn ghost" data-action="apply-rate-override" data-table-id="${table.id}">Áp dụng giá giờ</button>
      </div>
    </section>
  `;
}
