// =============================
// CONFIG
// =============================
const CONFIG = {
  storageKey: "bida_pos_v3",
  branchName: "Chi nhánh trung tâm",
  defaultHourlyRateLo: 120000,
  defaultHourlyRatePhang: 150000,
  defaultEnableTax: false,
  defaultTaxPercent: 0,
  defaultEnableServiceFee: false,
  defaultServiceFeePercent: 0,
  bankAccount: {
    accountName: "HUYNH TAN VU",
    accountNumber: "5908205558840",
    bankName: "AGRIBANK",
    bankCode: "970405"
  }
};

// =============================
// STATE
// =============================
const STATE = {
  activeView: "tables",
  config: {
    hourlyRateLo: CONFIG.defaultHourlyRateLo,
    hourlyRatePhang: CONFIG.defaultHourlyRatePhang,
    enableTax: CONFIG.defaultEnableTax,
    taxPercent: CONFIG.defaultTaxPercent,
    enableServiceFee: CONFIG.defaultEnableServiceFee,
    serviceFeePercent: CONFIG.defaultServiceFeePercent
  },
  tableUi: {
    searchQuery: "",
    activeFilter: "all",
    currentPage: 1,
    perPage: 8
  },
  paymentDraft: {
    method: "cash",
    cashGivenInput: "",
    bankConfirmed: false
  },
  tables: [],
  drinkMenu: [],
  invoices: [],
  modal: {
    type: null,
    id: null
  }
};

let realtimeClockIntervalId = null;

// =============================
// DATA MOCK
// =============================
const DATA_MOCK = {
  tables: Array.from({ length: 16 }, (_, i) => ({
    id: i + 1,
    name: `Bàn ${String(i + 1).padStart(2, "0")}`,
    type: i % 2 === 0 ? "lo" : "phang",
    status: "idle",
    startTime: null,
    sessionStartTime: null,
    elapsedBeforeStopSec: 0,
    items: [],
    hourlyRateOverride: null,
    intervalId: null
  })),
  drinkMenu: [
    { id: "d1", name: "Nước suối", price: 10000, category: "Nước" },
    { id: "d2", name: "Pepsi", price: 15000, category: "Nước ngọt" },
    { id: "d3", name: "Sting đỏ", price: 18000, category: "Nước ngọt" },
    { id: "d4", name: "Trà chanh", price: 20000, category: "Trà" },
    { id: "d5", name: "Cà phê sữa", price: 25000, category: "Cà phê" },
    { id: "d6", name: "Bò húc", price: 22000, category: "Năng lượng" }
  ]
};
