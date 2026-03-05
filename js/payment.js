function openPaymentForTable(tableId) {
  const table = getTableById(tableId);
  if (!table) return;

  const hasPlay = table.status !== "idle" || table.elapsedBeforeStopSec > 0;
  const hasItems = table.items.length > 0;
  if (!hasPlay && !hasItems) {
    window.alert("Bàn chưa có dữ liệu để thanh toán.");
    return;
  }

  // Bước 1: stop timer trước khi vào form thanh toán.
  if (table.status === "playing") {
    handleStop(table.id, { silent: true });
  }

  STATE.paymentDraft.method = "cash";
  STATE.paymentDraft.cashGivenInput = "";
  STATE.paymentDraft.bankConfirmed = false;
  saveData();
  renderTables();
  openModal("payment", table.id);
}

function setPaymentMethod(method) {
  STATE.paymentDraft.method = method === "bank" ? "bank" : "cash";
  STATE.paymentDraft.bankConfirmed = false;
}

function confirmBankTransfer() {
  STATE.paymentDraft.bankConfirmed = true;
}

function setCashGivenInput(rawValue) {
  STATE.paymentDraft.cashGivenInput = rawValue;
}

function getCashGivenValue() {
  const raw = String(STATE.paymentDraft.cashGivenInput ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function getChangeDisplayText(changeMoney) {
  if (changeMoney === null) return "--";
  return changeMoney >= 0 ? formatMoney(changeMoney) : "Chưa đủ tiền";
}

function createQRContent(tableNumber, total) {
  const amountFormatted = formatAmountWithDot(total);
  const transferContent = `BIDA_BAN${tableNumber}_${formatDateDDMMYYYY(new Date())}_${amountFormatted}`;
  const amountNumeric = String(Math.max(0, toFiniteNumber(total, 0)));

  return {
    bankCode: (CONFIG.bankAccount.bankCode || CONFIG.bankAccount.bankName || "").toLowerCase(),
    bankName: CONFIG.bankAccount.bankName,
    accountNumber: CONFIG.bankAccount.accountNumber,
    accountName: CONFIG.bankAccount.accountName,
    amountFormatted,
    amountNumeric,
    transferContent
  };
}

function generateQR(code) {
  const bankCode = code.bankCode || "acb";
  const accountNumber = code.accountNumber || "";
  const amountParam = code.amountNumeric || "0";
  const addInfoParam = code.transferContent || "";
  const accountNameParam = code.accountName || "";

  return `https://img.vietqr.io/image/${encodeURIComponent(bankCode)}-${encodeURIComponent(accountNumber)}-compact2.png?amount=${encodeURIComponent(amountParam)}&addInfo=${encodeURIComponent(addInfoParam)}&accountName=${encodeURIComponent(accountNameParam)}`;
}

function renderPaymentWithQR(table, bill) {
  const qrContent = createQRContent(table.id, bill.total);
  const qrUrl = generateQR(qrContent);

  return `
    <div class="bank-qr-wrap">
      <img class="bank-qr-image" src="${qrUrl}" alt="QR thanh toán ${table.name}" />
      
    </div>
  `;
}
/*<div class="bank-qr-info">
        <div><strong>Tên TK:</strong> ${qrContent.accountName}</div>
        <div><strong>Số TK:</strong> ${qrContent.accountNumber}</div>
        <div><strong>Ngân hàng:</strong> ${qrContent.bankName}</div>
        <div><strong>Số tiền:</strong> ${qrContent.amountFormatted}</div>
        <div><strong>Nội dung:</strong> ${qrContent.transferContent}</div>
      </div>*/
      
function buildInvoiceFromTable(table, bill, paymentMeta) {
  const endMs = Date.now();
  const startTime = table.sessionStartTime
    ? table.sessionStartTime
    : new Date(endMs - bill.elapsedSeconds * 1000).toISOString();

  return {
    id: makeInvoiceId(),
    tableName: table.name,
    tableType: table.type,
    startTime,
    endTime: new Date(endMs).toISOString(),
    items: table.items.map(item => ({ ...item })),
    hourlyRateUsed: calculateHourlyRate(table),
    hourMoney: bill.hourMoney,
    itemMoney: bill.itemMoney,
    tax: bill.tax,
    serviceFee: bill.serviceFee,
    total: bill.total,
    elapsedSeconds: bill.elapsedSeconds,
    paymentMethod: paymentMeta.paymentMethod,
    cashGiven: paymentMeta.cashGiven,
    change: paymentMeta.change,
    bankConfirmed: paymentMeta.bankConfirmed
  };
}

function handlePayment() {
  const table = getTableById(STATE.modal.id);
  if (!table) return;

  if (table.status === "playing") {
    handleStop(table.id, { silent: true });
  }

  const bill = calculateBill(table);
  const method = STATE.paymentDraft.method;
  const cashGiven = method === "cash" ? getCashGivenValue() : null;
  const changeMoney = cashGiven === null ? null : cashGiven - bill.total;
  const bankConfirmed = method === "bank" ? STATE.paymentDraft.bankConfirmed : null;

  if (method === "cash" && cashGiven !== null && cashGiven < bill.total) {
    window.alert("Tiền khách đưa chưa đủ để thanh toán.");
    return;
  }
  if (method === "bank" && !bankConfirmed) {
    window.alert("Vui lòng xác nhận đã nhận chuyển khoản trước khi thanh toán.");
    return;
  }

  const invoice = buildInvoiceFromTable(table, bill, {
    paymentMethod: method,
    cashGiven,
    change: changeMoney,
    bankConfirmed: method === "bank" ? true : null
  });

  STATE.invoices.unshift(invoice);
  clearTableSession(table);
  saveData();
  closeModal();
  render();
}


function renderPaymentModal(table) {
  const bill = calculateBill(table);
  const cashGiven = getCashGivenValue();
  const changeMoney = cashGiven === null ? null : cashGiven - bill.total;
  const isCash = STATE.paymentDraft.method === "cash";
  const qrContent = createQRContent(table.id, bill.total);

  el.modalTitle.textContent = `${table.name} - Thanh toán`;
  el.modalBody.innerHTML = `
    <div class="payment-layout payment-split">
      <section class="card payment-summary-card">
        <div class="payment-total-label">TỔNG TIỀN</div>
        <div class="payment-total-value">${formatMoney(bill.total)}</div>

        <div class="payment-breakdown">
          <div class="kv"><span>Bàn</span><strong>${table.name}</strong></div>
          <div class="kv"><span>Tiền giờ</span><strong>${formatMoney(bill.hourMoney)}</strong></div>
          <div class="kv"><span>Tiền nước</span><strong>${formatMoney(bill.itemMoney)}</strong></div>
          ${renderChargeRow("Phí dịch vụ", bill.serviceFee, isServiceFeeEnabled())}
          ${renderChargeRow("Thuế", bill.tax, isTaxEnabled())}
          ${!isCash ? `<div class="kv"><span>Nội dung chuyển khoản</span><strong class="transfer-content">${qrContent.transferContent}</strong></div>` : ""}
        </div>
      </section>

      <section class="card payment-column ${isCash ? "active" : ""}">
        <div class="payment-column-head">
          <h4 class="payment-column-title">Tiền mặt</h4>
          <button class="btn ghost payment-select-btn" data-action="set-payment-method" data-method="cash">Chọn tiền mặt</button>
        </div>

        <div class="field">
          <label for="cashReceivedInput">Khách đưa</label>
          <input id="cashReceivedInput" type="number" min="0" step="1000" placeholder="Có thể bỏ trống" value="${STATE.paymentDraft.cashGivenInput}" />
        </div>
        <div class="kv payment-kv">
          <span>Tiền thối</span>
          <strong id="paymentChangeValue">${getChangeDisplayText(changeMoney)}</strong>
        </div>
        <div class="payment-note">Ô "Khách đưa" không bắt buộc. Nếu có nhập và nhỏ hơn tổng tiền thì không thể xác nhận thanh toán.</div>
      </section>

      <section class="card payment-column ${!isCash ? "active" : ""}">
        <div class="payment-column-head">
          <h4 class="payment-column-title">Chuyển khoản (QR)</h4>
          <button class="btn ghost payment-select-btn" data-action="set-payment-method" data-method="bank">Chọn chuyển khoản</button>
        </div>
        ${renderPaymentWithQR(table, bill)}
        <button class="btn ghost bank-confirm-btn ${STATE.paymentDraft.bankConfirmed ? "confirmed" : ""}" data-action="confirm-bank-transfer">
          ${STATE.paymentDraft.bankConfirmed ? "Đã xác nhận chuyển khoản" : "Đã nhận chuyển khoản"}
        </button>
        <div class="payment-note">Khi dùng chuyển khoản, cần bấm "Đã nhận chuyển khoản" trước khi xác nhận thanh toán.</div>
      </section>
    </div>
    <div class="payment-actions-row">
      <button class="btn pay payment-confirm" data-action="confirm-payment">XÁC NHẬN THANH TOÁN</button>
    </div>
  `;
}
