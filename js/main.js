function renderDeleteTableConfirmModal(table) {
  el.modalTitle.textContent = "Xác nhận xóa bàn";
  el.modalBody.innerHTML = `
    <section class="card confirm-delete-wrap">
      <h4>Xóa ${table.name}</h4>
      <p class="confirm-delete-text">Bàn sẽ bị xóa khỏi hệ thống. Hành động này không thể hoàn tác.</p>
      <div class="confirm-delete-actions">
        <button class="btn ghost" data-action="cancel-delete-table">Hủy</button>
        <button class="btn stop" data-action="confirm-delete-table" data-table-id="${table.id}">Xóa bàn</button>
      </div>
    </section>
  `;
}

function renderInvoiceModal(invoice) {
  const items = (invoice.items || []).map(item => `
    <div class="row-item">
      <div>
        <strong>${item.name}</strong>
        <small>${item.category || "Khác"}</small>
      </div>
      <div>${item.qty} x ${formatMoney(item.price)}</div>
    </div>
  `).join("");

  el.modalTitle.textContent = `Hóa đơn ${invoice.id}`;
  el.modalBody.innerHTML = `
    <section class="card">
      <h4>Thông tin hóa đơn</h4>
      <div class="kv"><span>Bàn</span><strong>${invoice.tableName}</strong></div>
      <div class="kv"><span>Loại bàn</span><strong>${getTableTypeLabel(invoice.tableType)}</strong></div>
      <div class="kv"><span>Bắt đầu</span><strong>${formatDateTime(invoice.startTime)}</strong></div>
      <div class="kv"><span>Kết thúc</span><strong>${formatDateTime(invoice.endTime)}</strong></div>
      <div class="kv"><span>Phương thức</span><strong>${invoice.paymentMethod === "bank" ? "Chuyển khoản" : "Tiền mặt"}</strong></div>
      <div class="kv"><span>Giá giờ áp dụng</span><strong>${formatMoney(invoice.hourlyRateUsed)}</strong></div>
      <div class="kv"><span>Khách đưa</span><strong>${invoice.cashGiven === null ? "--" : formatMoney(invoice.cashGiven)}</strong></div>
      <div class="kv"><span>Tiền thối</span><strong>${invoice.change === null ? "--" : formatMoney(invoice.change)}</strong></div>
      <div class="kv"><span>Tiền giờ</span><strong>${formatMoney(invoice.hourMoney)}</strong></div>
      <div class="kv"><span>Tiền nước</span><strong>${formatMoney(invoice.itemMoney)}</strong></div>
      ${renderChargeRow("Phí dịch vụ", invoice.serviceFee, isServiceFeeEnabled())}
      ${renderChargeRow("Thuế", invoice.tax, isTaxEnabled())}
      <div class="kv"><span>Tổng tiền</span><strong>${formatMoney(invoice.total)}</strong></div>
    </section>
    <section class="card">
      <h4>Danh sách đồ uống</h4>
      <div class="scroll-list">${items || `<div class="empty">Không có đồ uống.</div>`}</div>
    </section>
  `;
}

function renderModalContent() {
  if (!STATE.modal.type) return;

  if (STATE.modal.type === "table") {
    const table = getTableById(STATE.modal.id);
    if (table) renderTableDetailModal(table);
    return;
  }

  if (STATE.modal.type === "payment") {
    const table = getTableById(STATE.modal.id);
    if (table) renderPaymentModal(table);
    return;
  }

  if (STATE.modal.type === "invoice") {
    const invoice = STATE.invoices.find(inv => inv.id === STATE.modal.id);
    if (invoice) renderInvoiceModal(invoice);
    return;
  }

  if (STATE.modal.type === "confirm-delete-table") {
    const table = getTableById(STATE.modal.id);
    if (table) renderDeleteTableConfirmModal(table);
  }
}

function renderActiveView() {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  if (STATE.activeView === "tables") {
    el.tablesView.classList.add("active");
    renderTables();
  }
  if (STATE.activeView === "revenue") {
    el.revenueView.classList.add("active");
    renderRevenue();
  }
  if (STATE.activeView === "settings") {
    el.settingsView.classList.add("active");
    renderSettings();
  }
  updateRevenue();
}

function render() {
  renderActiveView();
  document.querySelectorAll(".menu-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === STATE.activeView);
  });
}

// =============================
// EVENT HANDLERS
// =============================
function openModal(type, id) {
  STATE.modal.type = type;
  STATE.modal.id = id;
  renderModalContent();
  el.modalOverlay.classList.add("open");
  el.modalOverlay.setAttribute("aria-hidden", "false");
}

function closeModal() {
  el.modalOverlay.classList.remove("open");
  el.modalOverlay.setAttribute("aria-hidden", "true");
  STATE.modal.type = null;
  STATE.modal.id = null;
}

function onRootClick(event) {
  const menuBtn = event.target.closest(".menu-item");
  if (menuBtn) {
    STATE.activeView = menuBtn.dataset.view;
    render();
    return;
  }

  const tableCard = event.target.closest(".table-card");
  if (tableCard) {
    openModal("table", Number(tableCard.dataset.tableId));
    return;
  }

  const actionBtn = event.target.closest("[data-action]");
  if (!actionBtn) return;

  const action = actionBtn.dataset.action;
  const tableId = actionBtn.dataset.tableId;
  const drinkId = actionBtn.dataset.drinkId;
  const invoiceId = actionBtn.dataset.id;
  const method = actionBtn.dataset.method;
  const targetPage = Number(actionBtn.dataset.page);
  const targetFilter = actionBtn.dataset.filter;

  if (action === "add-item") addItemToTable(tableId, drinkId);
  if (action === "remove-item") removeItemFromTable(tableId, drinkId);
  if (action === "start-table") {
    const result = handleStart(tableId);
    if (!result?.ok && result?.message) {
      window.alert(result.message);
    }
  }
  if (action === "stop-table") handleStop(tableId);
  if (action === "reset-table") resetTable(tableId);
  if (action === "open-payment") openPaymentForTable(tableId);
  if (action === "view-invoice") openModal("invoice", invoiceId);
  if (action === "set-payment-method") {
    setPaymentMethod(method);
    renderModalContent();
  }
  if (action === "confirm-bank-transfer") {
    confirmBankTransfer();
    renderModalContent();
  }
  if (action === "confirm-payment") handlePayment();
  if (action === "apply-rate-override") {
    const input = document.getElementById("tableRateOverrideInput");
    setTableRateOverride(tableId, input ? input.value : "");
  }
  if (action === "delete-table") {
    openModal("confirm-delete-table", Number(tableId));
    return;
  }
  if (action === "cancel-delete-table") {
    closeModal();
    return;
  }
  if (action === "confirm-delete-table") {
    const result = deleteTable(tableId || STATE.modal.id);
    if (!result?.ok) {
      window.alert(result?.message || "Không thể xóa bàn.");
      return;
    }
    closeModal();
    render();
    return;
  }
  if (action === "set-filter") {
    STATE.tableUi.activeFilter = targetFilter || "all";
    STATE.tableUi.currentPage = 1;
    renderTables();
  }

  if (action === "goto-page") {
    STATE.tableUi.currentPage = targetPage;
    renderTables();
  }
  if (action === "prev-page") {
    STATE.tableUi.currentPage = Math.max(1, STATE.tableUi.currentPage - 1);
    renderTables();
  }
  if (action === "next-page") {
    const totalPages = Math.max(1, Math.ceil(filterTables().length / STATE.tableUi.perPage));
    STATE.tableUi.currentPage = Math.min(totalPages, STATE.tableUi.currentPage + 1);
    renderTables();
  }
}
function onInput(event) {
  const numberInput = event.target.closest('input[type="number"]');
  if (numberInput) {
    const allowDecimal = numberInput.id === "taxPercent" || numberInput.id === "serviceFeePercent";
    const sanitizedValue = sanitizeNumberInputValue(numberInput.value, allowDecimal);
    if (numberInput.value !== sanitizedValue) {
      numberInput.value = sanitizedValue;
    }
  }

  const searchInput = event.target.closest("#tableSearchInput");
  if (searchInput) {
    STATE.tableUi.searchQuery = searchInput.value;
    STATE.tableUi.currentPage = 1;
    renderTables();
    return;
  }

  const cashInput = event.target.closest("#cashReceivedInput");
  if (cashInput) {
    setCashGivenInput(cashInput.value);
    if (STATE.modal.type === "payment") {
      const table = getTableById(STATE.modal.id);
      if (!table) return;
      const bill = calculateBill(table);
      const cashGiven = getCashGivenValue();
      const changeMoney = cashGiven === null ? null : cashGiven - bill.total;
      const changeEl = document.getElementById("paymentChangeValue");
      if (changeEl) {
        changeEl.textContent = getChangeDisplayText(changeMoney);
      }
    }
  }
}

function onChange(event) {
  const typeSelect = event.target.closest('[data-action="change-table-type"]');
  if (typeSelect) {
    updateTableType(typeSelect.dataset.tableId, typeSelect.value);
  }
}

function onSubmit(event) {
  const addForm = event.target.closest("#addTableForm");
  if (addForm) {
    event.preventDefault();
    const data = new FormData(addForm);
    addTable(data.get("tableName"), data.get("tableType"));
    return;
  }

  const form = event.target.closest("#settingsForm");
  if (!form) return;
  event.preventDefault();
  const formData = new FormData(form);

  STATE.config.hourlyRateLo = toNonNegativeNumber(formData.get("hourlyRateLo"), CONFIG.defaultHourlyRateLo);
  STATE.config.hourlyRatePhang = toNonNegativeNumber(formData.get("hourlyRatePhang"), CONFIG.defaultHourlyRatePhang);
  STATE.config.enableTax = formData.get("enableTax") === "on";
  STATE.config.taxPercent = toPercentNumber(formData.get("taxPercent"), 0);
  STATE.config.enableServiceFee = formData.get("enableServiceFee") === "on";
  STATE.config.serviceFeePercent = toPercentNumber(formData.get("serviceFeePercent"), 0);

  saveData();
  render();
  window.alert("Đã lưu cấu hình.");
}

function setupEvents() {
  document.body.addEventListener("click", onRootClick);
  document.body.addEventListener("input", onInput);
  document.body.addEventListener("change", onChange);
  document.body.addEventListener("submit", onSubmit);

  el.closeModalBtn.addEventListener("click", closeModal);
  el.modalOverlay.addEventListener("click", event => {
    if (event.target === el.modalOverlay) closeModal();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
  });
}

function updateRealtimeClock() {
  updateRevenue();
}

function init() {
  el.branchName.textContent = CONFIG.branchName;
  loadData();
  restoreRunningTableIntervals();
  setupEvents();
  render();
  if (realtimeClockIntervalId) {
    clearInterval(realtimeClockIntervalId);
  }
  realtimeClockIntervalId = setInterval(updateRealtimeClock, 1000);
  window.addEventListener("beforeunload", () => {
    STATE.tables.forEach(clearTableInterval);
    if (realtimeClockIntervalId) {
      clearInterval(realtimeClockIntervalId);
    }
  }, { once: true });
}

document.addEventListener("DOMContentLoaded", init);
