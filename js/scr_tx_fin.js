/** Version 2.1 | 20 MAR 2026 | Siam Palette Group | Created 12 MAR 2026 */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_tx_fin.js
 * Transaction screens: Log, Sales, Bills, Return,
 * Bill Detail, SD Bridge, Find Transactions
 * ═══════════════════════════════════════════
 *
 * CHANGED v1.8.1 → v1.9:
 * - [DELETED] _brandFilterOpts() — use App.brandFilterOpts()
 * - [DELETED] _skeletonRow() — use App.skeleton()
 * - [DELETED] _fmtDate() — use App.formatDateFull()
 * ═══════════════════════════════════════════
 */
(() => {
const esc = App.esc, fm = App.formatMoney, sb = App.statusBadge;

// (TX_MOCK removed — all screens use API data via _loadXxx)

// ═══════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════
function dateRange() {
  const t = new Date(), f = new Date(t);
  f.setDate(f.getDate() - 30);
  return { from: f.toISOString().split('T')[0], to: t.toISOString().split('T')[0] };
}

function reconBadge(v) {
  if (!v) return '';
  const c = { 'Match': 'var(--g)', 'Group Match': 'var(--b)', 'Unmatch': 'var(--r)' };
  return `<span style="font-size:var(--fs-xs);color:${c[v] || 'var(--t3)'};font-weight:600">${esc(v)}</span>`;
}

const TW = 'max-width:1000px;margin:0 auto';
const sth = App.sth, sthR = App.sthR;

// Aliases — shared helpers from App
const _brandFilterOpts = App.brandFilterOpts;
const _skeletonRow = App.skeleton;
const _fmtDate = App.formatDateFull;

/** Supplier filter <option> list — from App.S.vendors */
function _supplierFilterOpts() {
  const vendors = App.S.vendors || [];
  return '<option value="">All Suppliers</option>' + vendors.map(v => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join('');
}

/** Channel filter <option> list — from App.S.channels */
function _channelFilterOpts() {
  const channels = App.S.channels || [];
  return '<option value="">All Channels</option>' + channels.map(c => `<option>${esc(c)}</option>`).join('');
}

// ═══════════════════════════════════════
// 1. TRANSACTION LOG — ★ CONNECTED TO DB
// ═══════════════════════════════════════

/** Render log table rows from data array */
function _logRows(rows) {
  if (!rows || rows.length === 0) {
    return '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--t3)">No transactions found</td></tr>';
  }
  return rows.map(r => `<tr><td>${_fmtDate(r.date)}</td><td><a class="lk" onclick="ScrTx._goBillDetail('${esc(r.bill_id || r.id || '')}')">${esc(r.ref)}</a></td><td>${esc(r.type)}</td><td>${esc(r.desc)}</td><td>${esc(r.brand)}</td><td>${esc(r.contact)}</td><td style="text-align:right">${fm(r.amount)}</td><td>${reconBadge(r.recon)}</td></tr>`).join('');
}

function renderTxLog() {
  const dr = dateRange();
  const mem = App.S._tx_log;
  const hasMem = mem && mem.length > 0;
  const rows = hasMem ? _logRows(mem) : _skeletonRow(8);

  return {
    tb: `<div class="tb"><div class="tb-t">Transaction Log</div><button class="bs" onclick="App.go('rc_bank')">Reconcile</button></div>`,
    ct: `<div style="${TW}"><div class="card"><div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px"><div><div class="fl-l">Type</div><select class="fl" id="log_type" onchange="ScrTx._filterLog()" style="width:100px"><option value="">All</option><option value="Income">Income</option><option value="Expense">Expense</option><option value="Transfer">Transfer</option></select></div><div><div class="fl-l">Brand</div><select class="fl" id="log_brand" onchange="ScrTx._filterLog()" style="width:120px">${_brandFilterOpts()}</select></div><div><div class="fl-l">Status</div><select class="fl" id="log_status" onchange="ScrTx._filterLog()" style="width:80px"><option value="">All</option><option value="Paid">Paid</option><option value="Unpaid">Unpaid</option></select></div><div><div class="fl-l">Date from</div><input class="fl" id="log_from" type="date" value="${dr.from}" onchange="ScrTx._filterLog()" style="width:130px"></div><div><div class="fl-l">Date to</div><input class="fl" id="log_to" type="date" value="${dr.to}" onchange="ScrTx._filterLog()" style="width:130px"></div><div><div class="fl-l">Search</div><input class="fl" id="log_search" placeholder="" oninput="ScrTx._filterLog()" style="width:100px"></div><div style="flex:1"></div><button class="bg" style="color:var(--acc)" onclick="ScrTx._resetLog()">Reset</button></div></div><div class="card" style="padding:0"><table class="tbl" id="tbl_log"><thead><tr>${sth('Date', 'date', 'tbl_log')}${sth('Ref no', 'ref', 'tbl_log')}${sth('Type', 'type', 'tbl_log')}${sth('Description', 'desc', 'tbl_log')}${sth('Brand', 'brand', 'tbl_log')}${sth('Contact', 'contact', 'tbl_log')}${sthR('Amount ($)', 'amount', 'tbl_log')}${sth('Reconcile', 'recon', 'tbl_log')}</tr></thead><tbody id="log_tbody">${rows}</tbody></table></div><div id="txlog_lm" style="text-align:center;padding:10px;display:none"><button class="btn bo" style="font-size:var(--fs-sm)">Load more</button></div></div>`,
  };
}

async function _loadLog(filters) {
  const f = filters || { type: 'all', page: 1 };
  if (!f.type) f.type = 'all';
  if (!f.page) f.page = 1;
  try {
    const result = await API.getTransactions(f);
    const tbody = document.getElementById('log_tbody');
    if (tbody) tbody.innerHTML = _logRows(result.rows);
  } catch (e) {
    const tbody = document.getElementById('log_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--r)">Error: ${esc(e.message)}</td></tr>`;
  }
}

function _filterLog() {
  const f = { type: 'all', page: 1 };
  const type = document.getElementById('log_type')?.value;
  const brand = document.getElementById('log_brand')?.value;
  const status = document.getElementById('log_status')?.value;
  const from = document.getElementById('log_from')?.value;
  const to = document.getElementById('log_to')?.value;
  const search = document.getElementById('log_search')?.value?.trim();
  if (type) f.sub_type = type;
  if (brand) f.brand = brand;
  if (status) f.status = status;
  if (from) f.date_from = from;
  if (to) f.date_to = to;
  if (search) f.search = search;
  _loadLog(f);
}

function _resetLog() {
  const dr = dateRange();
  const el = (id) => document.getElementById(id);
  if (el('log_type')) el('log_type').value = '';
  if (el('log_brand')) el('log_brand').value = '';
  if (el('log_status')) el('log_status').value = '';
  if (el('log_from')) el('log_from').value = dr.from;
  if (el('log_to')) el('log_to').value = dr.to;
  if (el('log_search')) el('log_search').value = '';
  _loadLog();
}

// ═══════════════════════════════════════
// 2. SALES — ★ CONNECTED TO DB
// ═══════════════════════════════════════

function _saleRows(rows) {
  if (!rows || rows.length === 0) {
    return '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--t3)">No sales found</td></tr>';
  }
  return rows.map(r => `<tr><td>${_fmtDate(r.date)}</td><td>${esc(r.brand)}</td><td>${esc(r.channel || r.desc || '')}</td><td style="text-align:right;color:var(--g)">+${fm(r.amount)}</td><td style="text-align:right">${fm(r.gst || 0)}</td><td>${sb(r.status)}</td></tr>`).join('');
}

function renderTxSale() {
  const dr = dateRange();
  const mem = App.S._tx_sale;
  const hasMem = mem && mem.length > 0;
  const rows = hasMem ? _saleRows(mem) : _skeletonRow(6);
  const total = hasMem ? mem.reduce((s, r) => s + (Number(r.amount) || 0), 0) : 0;

  return {
    tb: `<div class="tb"><div class="tb-t">Sales</div><button class="bs" onclick="App.go('cr_sale')">+ Record Sale</button></div>`,
    ct: `<div style="${TW}"><div class="card"><div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px"><div><div class="fl-l">Brand</div><select class="fl" id="sale_brand" onchange="ScrTx._filterSales()" style="width:120px">${_brandFilterOpts()}</select></div><div><div class="fl-l">Channel</div><select class="fl" id="sale_channel" onchange="ScrTx._filterSales()" style="width:100px">${_channelFilterOpts()}</select></div><div><div class="fl-l">Date from</div><input class="fl" id="sale_from" type="date" value="${dr.from}" onchange="ScrTx._filterSales()" style="width:130px"></div><div><div class="fl-l">Date to</div><input class="fl" id="sale_to" type="date" value="${dr.to}" onchange="ScrTx._filterSales()" style="width:130px"></div><div style="flex:1"></div><button class="bg" style="color:var(--acc)" onclick="ScrTx._resetSales()">Reset</button></div><div id="sale_total" style="text-align:right;font-size:var(--fs-sm);color:var(--t2)">Total Revenue <b style="color:var(--g)">${fm(total)}</b></div></div><div class="card" style="padding:0"><table class="tbl" id="tbl_sale"><thead><tr>${sth('Date', 'date', 'tbl_sale')}${sth('Brand', 'brand', 'tbl_sale')}${sth('Channel', 'channel', 'tbl_sale')}${sthR('Amount ($)', 'amount', 'tbl_sale')}${sthR('GST', 'gst', 'tbl_sale')}${sth('Status', 'status', 'tbl_sale')}</tr></thead><tbody id="sale_tbody">${rows}</tbody></table></div><div id="txsale_lm" style="text-align:center;padding:10px;display:none"><button class="btn bo" style="font-size:var(--fs-sm)">Load more</button></div></div>`,
  };
}

async function _loadSales(filters) {
  const f = filters || { type: 'sale', page: 1 };
  if (!f.type) f.type = 'sale';
  if (!f.page) f.page = 1;
  try {
    const result = await API.getTransactions(f);
    const tbody = document.getElementById('sale_tbody');
    const totalEl = document.getElementById('sale_total');
    if (tbody) tbody.innerHTML = _saleRows(result.rows);
    if (totalEl && result.rows) {
      const total = result.rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      totalEl.innerHTML = `Total Revenue <b style="color:var(--g)">${fm(total)}</b>`;
    }
  } catch (e) {
    const tbody = document.getElementById('sale_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--r)">Error: ${esc(e.message)}</td></tr>`;
  }
}

function _filterSales() {
  const f = { type: 'sale', page: 1 };
  const brand = document.getElementById('sale_brand')?.value;
  const channel = document.getElementById('sale_channel')?.value;
  const from = document.getElementById('sale_from')?.value;
  const to = document.getElementById('sale_to')?.value;
  if (brand) f.brand = brand;
  if (channel) f.channel = channel;
  if (from) f.date_from = from;
  if (to) f.date_to = to;
  _loadSales(f);
}

function _resetSales() {
  const dr = dateRange();
  const el = (id) => document.getElementById(id);
  if (el('sale_brand')) el('sale_brand').value = '';
  if (el('sale_channel')) el('sale_channel').value = '';
  if (el('sale_from')) el('sale_from').value = dr.from;
  if (el('sale_to')) el('sale_to').value = dr.to;
  _loadSales();
}

// ═══════════════════════════════════════
// 3. BILLS — ★ CONNECTED TO DB
// ═══════════════════════════════════════

/** Render bill table rows from data array */
function _billRows(bills) {
  if (!bills || bills.length === 0) {
    return '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--t3)">No bills found</td></tr>';
  }
  return bills.map(r => {
    const dC = r.status === 'Debit' ? 'color:var(--b)' : '';
    const duC = r.status === 'Overdue' ? 'color:var(--r)' : '';
    const billId = r.id || '';
    return `<tr onclick="ScrTx._openBillDetail('${esc(billId)}')" style="cursor:pointer"><td>${_fmtDate(r.date)}</td><td style="${dC}"><a class="lk">${esc(r.bill_no)}</a></td><td style="${dC}">${esc(r.supplier_name)}</td><td style="${dC}">${esc(r.inv_no)}</td><td style="text-align:right;${dC}">${fm(r.amount)}</td><td style="text-align:right;${dC}">${fm(r.balance)}</td><td style="${duC}">${_fmtDate(r.due_date)}</td><td>${r.has_file ? '📄' : ''}</td><td>${sb(r.status)}</td></tr>`;
  }).join('');
}

/** Render bill summary line */
function _billSummaryHTML(summary) {
  if (!summary) return '';
  return `<div style="text-align:right;font-size:var(--fs-sm);color:var(--t2)">Total <b>${fm(summary.totalAmount)}</b> · Balance due <b>${fm(summary.balanceDue)}</b> · <span style="color:var(--r);font-weight:600">Overdue ${fm(summary.overdueAmount)}</span></div>`;
}

function renderTxBill() {
  const dr = dateRange();
  // Check memory first — if we have bills, show them instantly
  const mem = App.S._bills;
  const hasMem = mem && mem.length > 0;
  const rows = hasMem ? _billRows(mem) : '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--t3)"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading bills...</td></tr>';
  const summary = hasMem ? _billSummaryHTML(App.S._billSummary) : '';

  return {
    tb: `<div class="tb"><div class="tb-t">Bills</div><button class="btn bo">⊕ Record supplier payment</button><button class="btn bo" onclick="App.go('cr_import')">Import</button><button class="bs" onclick="App.go('cr_bill')">Create bill</button></div>`,
    ct: `<div style="${TW}"><div class="card"><div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px"><div><div class="fl-l">Status</div><select class="fl" id="bill_status" onchange="ScrTx._filterBills()" style="width:75px"><option value="">All</option><option value="Open">Open</option><option value="Overdue">Overdue</option><option value="Closed">Closed</option><option value="Debit">Debit</option></select></div><div><div class="fl-l">Supplier</div><select class="fl" id="bill_supplier" onchange="ScrTx._filterBills()" style="width:140px">${_supplierFilterOpts()}</select></div><div><div class="fl-l">Brand</div><select class="fl" id="bill_brand" onchange="ScrTx._filterBills()" style="width:110px">${_brandFilterOpts()}</select></div><div><div class="fl-l">Issue from</div><input class="fl" id="bill_from" type="date" value="${dr.from}" onchange="ScrTx._filterBills()" style="width:130px"></div><div><div class="fl-l">Issue to</div><input class="fl" id="bill_to" type="date" value="${dr.to}" onchange="ScrTx._filterBills()" style="width:130px"></div><div><div class="fl-l">Search</div><input class="fl" id="bill_search" placeholder="" oninput="ScrTx._filterBills()" style="width:100px"></div><div style="flex:1"></div><button class="bg" style="color:var(--acc)" onclick="ScrTx._resetBills()">Reset</button></div><div id="bill_summary">${summary}</div></div><div class="card" style="padding:0"><table class="tbl" id="tbl_bill"><thead><tr>${sth('Issue date', 'date', 'tbl_bill')}${sth('Bill no', 'bill', 'tbl_bill')}${sth('Supplier', 'supplier', 'tbl_bill')}${sth('Inv no', 'inv', 'tbl_bill')}${sthR('Amount ($)', 'amount', 'tbl_bill')}${sthR('Balance due', 'balance', 'tbl_bill')}${sth('Due date', 'due', 'tbl_bill')}<th>File</th>${sth('Status', 'status', 'tbl_bill')}</tr></thead><tbody id="bill_tbody">${rows}</tbody></table></div><div id="txbill_lm" style="text-align:center;padding:10px;display:none"><button class="btn bo" style="font-size:var(--fs-sm)" onclick="ScrTx._loadMoreBills()">Load more</button></div></div>`,
  };
}

/** onLoad: fetch bills from API — accepts optional filters */
async function _loadBills(filters) {
  const f = filters || { page: 1 };
  if (!f.page) f.page = 1;
  try {
    const result = await API.getBills(f);
    const tbody = document.getElementById('bill_tbody');
    const summaryEl = document.getElementById('bill_summary');
    const lmEl = document.getElementById('txbill_lm');
    if (tbody) tbody.innerHTML = _billRows(result.rows);
    if (summaryEl) summaryEl.innerHTML = _billSummaryHTML(result.summary);
    if (lmEl) lmEl.style.display = result.hasMore ? 'block' : 'none';
    // Store summary in memory for instant display next time
    App.S._billSummary = result.summary;
    _billPage = 1; // reset page on new filter
  } catch (e) {
    const tbody = document.getElementById('bill_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--r)">Error: ${esc(e.message)}</td></tr>`;
  }
}

function _filterBills() {
  const f = { page: 1 };
  const status = document.getElementById('bill_status')?.value;
  const supplier = document.getElementById('bill_supplier')?.value;
  const brand = document.getElementById('bill_brand')?.value;
  const from = document.getElementById('bill_from')?.value;
  const to = document.getElementById('bill_to')?.value;
  const search = document.getElementById('bill_search')?.value?.trim();
  if (status) f.status = status;
  if (supplier) f.supplier_id = supplier;
  if (brand) f.brand = brand;
  if (from) f.date_from = from;
  if (to) f.date_to = to;
  if (search) f.search = search;
  _loadBills(f);
}

function _resetBills() {
  const dr = dateRange();
  const el = (id) => document.getElementById(id);
  if (el('bill_status')) el('bill_status').value = '';
  if (el('bill_supplier')) el('bill_supplier').value = '';
  if (el('bill_brand')) el('bill_brand').value = '';
  if (el('bill_from')) el('bill_from').value = dr.from;
  if (el('bill_to')) el('bill_to').value = dr.to;
  if (el('bill_search')) el('bill_search').value = '';
  _loadBills();
}

let _billPage = 1;
async function _loadMoreBills() {
  _billPage++;
  try {
    const result = await API.getBills({ page: _billPage });
    const tbody = document.getElementById('bill_tbody');
    const lmEl = document.getElementById('txbill_lm');
    if (tbody) tbody.innerHTML += _billRows(result.rows);
    if (lmEl && !result.hasMore) lmEl.style.display = 'none';
  } catch (e) {
    App.toast('Load more failed: ' + e.message);
  }
}

// ═══════════════════════════════════════
// 4. RETURN AND DEBIT — ★ CONNECTED TO DB
// ═══════════════════════════════════════

function _returnRows(rows) {
  if (!rows || rows.length === 0) {
    return '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--t3)">No debit notes found</td></tr>';
  }
  return rows.map(r => {
    const billNo = r.ref || r.bill_no || '';
    return `<tr style="cursor:pointer" onclick="ScrTx._showDebitDetail('${esc(r.id || billNo)}')"><td>${_fmtDate(r.date)}</td><td style="color:var(--b)"><a class="lk">${esc(billNo)}</a></td><td style="color:var(--b)">${esc(r.contact || r.supplier_name || '')}</td><td style="color:var(--b)">${esc(r.inv_no || '')}</td><td>${esc(r.desc || '')}</td><td style="text-align:right;color:var(--b)">${fm(r.amount)}</td><td style="text-align:right;color:var(--b)">${fm(r.balance || r.amount)}</td><td>${sb(r.status === 'Debit' ? 'pending' : 'closed')}</td><td><a class="lk" style="font-size:var(--fs-xs)">Record</a></td><td><a class="lk" style="font-size:var(--fs-xs)">Apply</a></td></tr>`;
  }).join('');
}

function renderTxReturn() {
  const mem = App.S._tx_return;
  const hasMem = mem && mem.length > 0;
  const rows = hasMem ? _returnRows(mem) : _skeletonRow(10);
  const tA = hasMem ? mem.reduce((s, r) => s + (Number(r.amount) || 0), 0) : 0;

  return {
    tb: `<div class="tb"><div class="tb-t">Purchase Returns and Debits</div><button class="bs" onclick="App.go('cr_debit')">Create debit note</button></div>`,
    ct: `<div style="${TW}"><div class="card"><div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:6px"><div><div class="fl-l">Supplier</div><select class="fl" id="ret_supplier" onchange="ScrTx._filterReturns()" style="width:160px">${_supplierFilterOpts()}</select></div><div><div class="fl-l">Brand</div><select class="fl" id="ret_brand" onchange="ScrTx._filterReturns()" style="width:140px">${_brandFilterOpts()}</select></div><div><div class="fl-l">Search</div><input class="fl" id="ret_search" placeholder="Search..." oninput="ScrTx._filterReturns()" style="width:140px"></div><div style="flex:1"></div><button class="bg" style="color:var(--acc)" onclick="ScrTx._resetReturns()">Reset</button></div><div id="ret_total" style="text-align:right;font-size:var(--fs-sm);color:var(--t2)">Total debit: <b>${fm(tA)}</b></div></div><div class="card" style="padding:0"><table class="tbl" id="tbl_ret"><thead><tr>${sth('Date', 'date', 'tbl_ret')}${sth('Bill no', 'bill', 'tbl_ret')}${sth('Supplier', 'supplier', 'tbl_ret')}${sth('Inv no', 'inv', 'tbl_ret')}<th>Notes</th>${sthR('Amount ($)', 'amount', 'tbl_ret')}<th style="text-align:right">Balance</th><th>Status</th><th>Refund</th><th>Apply</th></tr></thead><tbody id="ret_tbody">${rows}</tbody></table></div><div id="txret_lm" style="text-align:center;padding:10px;display:none"><button class="btn bo" style="font-size:var(--fs-sm)">Load more</button></div><div id="debit_detail" style="display:none"></div></div>`,
  };
}

async function _loadReturns(filters) {
  const f = filters || { type: 'return', page: 1 };
  if (!f.type) f.type = 'return';
  if (!f.page) f.page = 1;
  try {
    const result = await API.getTransactions(f);
    const tbody = document.getElementById('ret_tbody');
    const totalEl = document.getElementById('ret_total');
    if (tbody) tbody.innerHTML = _returnRows(result.rows);
    if (totalEl && result.rows) {
      const tA = result.rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      totalEl.innerHTML = `Total debit: <b>${fm(tA)}</b>`;
    }
  } catch (e) {
    const tbody = document.getElementById('ret_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--r)">Error: ${esc(e.message)}</td></tr>`;
  }
}

function _filterReturns() {
  const f = { type: 'return', page: 1 };
  const supplier = document.getElementById('ret_supplier')?.value;
  const brand = document.getElementById('ret_brand')?.value;
  const search = document.getElementById('ret_search')?.value?.trim();
  if (supplier) f.supplier_id = supplier;
  if (brand) f.brand = brand;
  if (search) f.search = search;
  _loadReturns(f);
}

function _resetReturns() {
  const el = (id) => document.getElementById(id);
  if (el('ret_supplier')) el('ret_supplier').value = '';
  if (el('ret_brand')) el('ret_brand').value = '';
  if (el('ret_search')) el('ret_search').value = '';
  _loadReturns();
}

function _showDebitDetail(idOrBill) {
  // Try memory first
  const mem = App.S._tx_return;
  const r = mem ? mem.find(x => x.id === idOrBill || x.ref === idOrBill || x.bill_no === idOrBill) : null;
  if (!r) return;
  const el = document.getElementById('debit_detail');
  if (!el) return;
  el.style.display = 'block';
  el.innerHTML = `<div class="card" style="margin-top:10px;border-left:3px solid var(--b)"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><div style="font-weight:700;color:var(--b)">Debit Note — ${esc(r.ref || r.bill_no || '')}</div><button class="bg" onclick="document.getElementById('debit_detail').style.display='none'">✕</button></div><div class="fr"><div class="fg"><label class="lb">Supplier</label><div style="font-weight:600">${esc(r.contact || r.supplier_name || '')}</div></div><div class="fg"><label class="lb">Date</label><div>${_fmtDate(r.date)}</div></div></div><div class="fr"><div class="fg"><label class="lb">Inv No</label><div style="color:var(--b)">${esc(r.inv_no || '')}</div></div><div class="fg"><label class="lb">Amount</label><div style="font-weight:700;color:var(--b)">${fm(r.amount)}</div></div></div><div class="fr"><div class="fg"><label class="lb">Notes</label><div>${esc(r.desc || '')}</div></div><div class="fg"><label class="lb">Status</label><div>${sb(r.status === 'Debit' ? 'pending' : 'closed')}</div></div></div></div>`;
  el.scrollIntoView({ behavior: 'smooth' });
}

// ═══════════════════════════════════════
// 5. BILL DETAIL — ★ READS FROM MEMORY (set by createBill or _openBillDetail)
// ═══════════════════════════════════════
let _bdView = 'self';

function renderTxBillDetail() {
  _bdView = 'self';
  const detail = App.S._billDetail;

  if (!detail || !detail.bill) {
    return {
      tb: `<div class="tb"><button class="bg" onclick="App.go('tx_bill')">← Bills</button><div class="tb-t">Bill Detail</div></div>`,
      ct: '<div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading bill detail...</div>',
    };
  }

  const b = detail.bill;
  const li = detail.lineItems || [];
  const alloc = detail.allocation || 'self';
  // Filled-field style: light purple bg to indicate data is present
  const FB = 'background:#f3f0ff;border-color:#d8d0f0;color:var(--t1);-webkit-text-fill-color:var(--t1);opacity:1';
  const DS = `disabled style="${FB}"`;

  const subtotal = li.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const tax = li.reduce((s, l) => s + (Number(l.gst) || 0), 0);
  const total = subtotal + tax;
  const paid = total - (Number(b.balance) || 0);

  const isOB = alloc === 'ob' || alloc === 'on_behalf';

  // Line items rows — match create bill table layout with disabled light purple fields
  const liRows = li.length > 0 ? li.map(l => {
    const ownerCol = isOB ? `<td style="padding:0;border:1px solid #e5e7eb"><input disabled style="width:100%;padding:8px 10px;border:none;font-size:var(--fs-body);${FB}" value="${esc(l.cost_owner || '')}"></td>` : '';
    return `<tr>`
      + ownerCol
      + `<td style="padding:0;border:1px solid #e5e7eb"><input disabled style="width:100%;padding:8px 10px;border:none;font-size:var(--fs-body);${FB}" value="${esc(l.desc || l.description || '')}"></td>`
      + `<td style="padding:0;border:1px solid #e5e7eb"><input disabled style="width:100%;padding:8px 10px;border:none;font-size:var(--fs-body);${FB}" value="${esc(l.category || l.category_display || '')}"></td>`
      + `<td style="padding:0;border:1px solid #e5e7eb"><input disabled style="width:100%;padding:8px 10px;border:none;text-align:right;font-size:var(--fs-body);font-weight:500;${FB}" value="${fm(l.amount)}"></td>`
      + `<td style="padding:0;border:1px solid #e5e7eb"><input disabled style="width:100%;padding:8px 10px;border:none;text-align:right;font-size:var(--fs-body);background:#faf9fe;border-color:#d8d0f0;color:var(--t3);-webkit-text-fill-color:var(--t3);opacity:1" value="${fm(l.gst)}"></td>`
      + `<td style="padding:0;border:1px solid #e5e7eb"><input disabled style="width:100%;padding:8px 10px;border:none;font-size:var(--fs-body);${FB}" value="${esc(l.tax_code || 'FRE')}"></td>`
      + `</tr>`;
  }).join('') : `<tr><td colspan="${isOB ? 6 : 5}" style="text-align:center;color:var(--t3);padding:16px">No line items</td></tr>`;

  // Column headers — match create bill exactly
  const ownerTh = isOB ? '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:14%">Cost Owner</th>' : '';
  const descW = isOB ? '22%' : '30%';
  const catW = isOB ? '22%' : '26%';
  const amtW = isOB ? '16%' : '18%';

  // Attachment helpers
  const atts = detail.attachments || [];
  const hasAtt = atts.length > 0;
  const firstImg = hasAtt ? (typeof atts[0] === 'string' ? atts[0] : atts[0].file_url || atts[0].url || '') : '';
  const isImg = (u) => /\.(jpg|jpeg|png|gif|webp)$/i.test(u);

  // Activity history
  const payments = detail.payments || [];
  const createdDate = b.created_at ? new Date(b.created_at).toLocaleDateString('en-AU') : (b.date ? new Date(b.date + 'T00:00:00').toLocaleDateString('en-AU') : '');
  const activityRows = [
    ...payments.map(p => `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f0">
      <span style="color:var(--g);font-size:16px">$</span>
      <div style="flex:1">
        <div style="font-size:var(--fs-sm);color:var(--g);font-weight:600">Bill payment recorded</div>
        <div style="font-size:var(--fs-xs);color:var(--t3);margin-top:2px">${esc(p.reference || '')} &middot; Payment recorded &middot; ${fm(p.amount)}</div>
      </div>
      <div style="font-size:var(--fs-xs);color:var(--t3)">${p.payment_date ? new Date(p.payment_date + 'T00:00:00').toLocaleDateString('en-AU') : ''}</div>
    </div>`),
    `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0">
      <span style="font-size:14px">📄</span>
      <div style="flex:1;font-size:var(--fs-sm);color:var(--t2)">Bill created</div>
      <div style="font-size:var(--fs-xs);color:var(--t3)">${createdDate}</div>
    </div>`,
  ].join('');

  return {
    tb: `<div class="tb"><button class="bg" onclick="App.go('tx_bill')">← Bills</button><div class="tb-t">Bill ${esc(b.bill_no)}</div><div style="flex:1"></div>${sb(b.status)}</div>`,
    ct: `<div style="max-width:1100px;margin:0 auto">
      <!-- Quick links -->
      <div style="display:flex;gap:12px;margin-bottom:10px;font-size:var(--fs-sm)">
        ${hasAtt ? '<a class="lk" onclick="document.getElementById(\'bd_att\').scrollIntoView({behavior:\'smooth\'})">📎 Attachments (' + atts.length + ')</a>' : ''}
        <a class="lk" onclick="document.getElementById('bd_activity').scrollIntoView({behavior:'smooth'})">🕐 Activity history</a>
        <a class="lk" style="color:var(--g)" onclick="document.getElementById('bd_actions').scrollIntoView({behavior:'smooth'})">$ Record payment</a>
      </div>

      <!-- ═══ SPLIT VIEW: Source doc (left) + Form (right) ═══ -->
      <div style="display:flex;gap:16px;align-items:flex-start">

        <!-- LEFT: Source document -->
        <div style="width:420px;flex-shrink:0">
          <div class="card" style="padding:0;overflow:hidden">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #eee">
              <span style="font-size:var(--fs-sm);font-weight:600">Source document uploaded</span>
              <div style="display:flex;gap:4px">
                ${firstImg ? `<button class="bg" style="font-size:12px;padding:2px 6px" title="Open full size" onclick="window.open('${esc(firstImg)}','_blank')">🔍</button>` : ''}
                ${firstImg ? `<a href="${esc(firstImg)}" download class="bg" style="font-size:12px;padding:2px 6px;text-decoration:none" title="Download">⬇</a>` : ''}
              </div>
            </div>
            ${firstImg && isImg(firstImg)
              ? `<div style="padding:8px;background:#fafafa"><img src="${esc(firstImg)}" style="width:100%;border-radius:6px;cursor:pointer" onclick="window.open('${esc(firstImg)}','_blank')" alt="Invoice"></div>`
              : firstImg
                ? `<div style="padding:20px;text-align:center"><a href="${esc(firstImg)}" target="_blank" class="lk" style="font-size:var(--fs-sm)">📄 Open document</a></div>`
                : '<div style="padding:40px;text-align:center;color:var(--t4);font-size:var(--fs-sm)">No source document</div>'
            }
            ${atts.length > 1 ? `<div style="padding:8px;border-top:1px solid #eee;font-size:var(--fs-xs);color:var(--t3)">+${atts.length - 1} more attachment${atts.length > 2 ? 's' : ''}</div>` : ''}
          </div>
        </div>

        <!-- RIGHT: Form fields -->
        <div style="flex:1;min-width:0">
          <!-- Header fields -->
          <div class="card" style="padding:14px 16px">
            <div class="fg" style="margin-bottom:8px">
              <label class="lb">Transaction Type</label>
              <input class="inp" ${DS} value="Expense / Bill">
            </div>
            <div class="fg" style="margin-bottom:8px">
              <label class="lb">Supplier *</label>
              <input class="inp" ${DS} value="${esc(b.supplier_name || '—')}">
            </div>
            <div class="fg" style="margin-bottom:8px">
              <label class="lb">Bill Number</label>
              <input class="inp" ${DS} value="${esc(b.bill_no)}" style="font-weight:600">
            </div>
            <div class="fg" style="margin-bottom:8px">
              <label class="lb">Supplier Invoice Number</label>
              <input class="inp" ${DS} value="${esc(b.inv_no || '—')}">
            </div>
            <div style="display:flex;gap:10px;margin-bottom:8px">
              <div class="fg" style="flex:1"><label class="lb">Issue Date *</label><input class="inp" ${DS} value="${b.date ? new Date(b.date + 'T00:00:00').toLocaleDateString('en-AU') : ''}"></div>
              <div class="fg" style="flex:1"><label class="lb">Due Date *</label><input class="inp" ${DS} value="${b.due_date ? new Date(b.due_date + 'T00:00:00').toLocaleDateString('en-AU') : ''}"></div>
            </div>
            <div style="display:flex;gap:10px;margin-bottom:8px">
              <div class="fg" style="flex:1"><label class="lb">Brand *</label><input class="inp" ${DS} value="${esc(b.paying_entity || b.brand || '—')}"></div>
              <div class="fg" style="flex:1"><label class="lb">Accrual Month</label><input class="inp" ${DS} value="${b.date ? (() => { const d = new Date(b.date + 'T00:00:00'); return d.toLocaleString('en-US', { month: 'long' }) + ' ' + d.getFullYear(); })() : ''}"></div>
            </div>

            <!-- Tax mode -->
            <div style="display:flex;gap:12px;margin:6px 0;font-size:var(--fs-sm);align-items:center">
              <span style="color:var(--t3)">Amounts are</span>
              <label style="cursor:default"><input type="radio" name="bd_taxmode" checked disabled style="accent-color:var(--acc)"> Tax exclusive</label>
              <label style="cursor:default"><input type="radio" name="bd_taxmode" disabled style="accent-color:var(--acc)"> Tax inclusive</label>
            </div>

            <!-- Allocation Layout -->
            <div style="display:flex;align-items:center;gap:0;margin:8px 0 0">
              <hr style="border:none;border-top:1px solid #eee;flex:1;margin:0">
              <div style="padding:0 8px;display:flex;align-items:center;gap:4px">
                <span style="font-size:var(--fs-xs);color:var(--t4)">Allocation Layout</span>
                <span style="font-size:var(--fs-xs);padding:2px 8px;border-radius:4px;background:var(--acc2);color:var(--acc);font-weight:600">${isOB ? 'On Behalf / Split' : 'Self'}</span>
              </div>
            </div>

            <!-- Line Items Table -->
            <table style="width:100%;border-collapse:collapse;font-size:var(--fs-body);margin-top:8px">
              <thead><tr>
                ${ownerTh}
                <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">Description</th>
                <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">Category *</th>
                <th style="text-align:right;padding:6px;font-weight:600;font-size:var(--fs-xs)">Amount ($)</th>
                <th style="text-align:right;padding:6px;font-weight:600;font-size:var(--fs-xs)">GST</th>
                <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">Tax code</th>
              </tr></thead>
              <tbody>${liRows}</tbody>
            </table>

            <!-- Notes -->
            <div style="margin-top:8px">
              <div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:2px">Notes</div>
              <textarea class="inp" disabled style="width:100%;min-height:50px;resize:none;${FB};border:1px solid #d8d0f0;border-radius:var(--rd);padding:6px 8px;font-family:inherit;font-size:var(--fs-sm)">${esc(b.notes || '')}</textarea>
            </div>

            <!-- Totals -->
            <div style="text-align:right;font-size:var(--fs-body);margin-top:8px;padding-top:8px;border-top:1px solid #eee">
              <div style="display:flex;justify-content:flex-end;gap:16px;padding:3px 0"><span>Subtotal</span><b>${fm(subtotal)}</b></div>
              <div style="display:flex;justify-content:flex-end;gap:16px;padding:3px 0;color:var(--t3)"><span>Tax</span><span>${fm(tax)}</span></div>
              <div style="display:flex;justify-content:flex-end;gap:16px;padding:3px 0"><b>Total</b><b>${fm(total)}</b></div>
              <div style="display:flex;justify-content:flex-end;gap:16px;padding:3px 0;color:var(--t3)"><span>Amount paid</span><span>${fm(paid)}</span></div>
              <div style="display:flex;justify-content:flex-end;gap:16px;padding:5px 0;font-weight:700;font-size:var(--fs-body);color:${b.status === 'Closed' ? 'var(--g)' : 'var(--r)'}"><span>Balance due</span><span>${b.status === 'Closed' ? fm(0) : fm(b.balance)}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div id="bd_actions" style="display:flex;align-items:center;gap:6px;padding:10px 0;flex-wrap:wrap">
        ${b.status !== 'Closed' && b.status !== 'Cancelled' ? `<button class="btn bo" style="color:var(--r);border-color:var(--r)" onclick="ScrTx._voidBill('${esc(b.id || '')}')">Cancel</button>` : ''}
        ${b.status !== 'Closed' && b.status !== 'Cancelled' ? `<button class="btn bo" style="color:var(--g);border-color:var(--g)" onclick="ScrTx._recordPaymentFromBill('${esc(b.id || '')}')">$ Record Payment</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn bo" onclick="App.go('tx_bill')">Back to Bills</button>
      </div>

      <!-- More information section -->
      <div style="margin-top:6px">
        <!-- Activity History -->
        <div id="bd_activity" style="margin-bottom:10px">
          <div style="background:#333;color:#fff;padding:8px 12px;border-radius:8px 8px 0 0;font-size:var(--fs-sm);font-weight:600;display:flex;align-items:center;gap:8px;cursor:pointer" onclick="const c=this.nextElementSibling;c.style.display=c.style.display==='none'?'block':'none'">
            Activity history
            ${payments.length > 0 ? `<span style="font-size:var(--fs-xxs);padding:1px 8px;border-radius:8px;background:var(--gbg);color:var(--g)">Bill payment recorded</span>` : ''}
            <span style="margin-left:auto;font-size:12px">▾</span>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:8px 12px">
            ${activityRows}
          </div>
        </div>

        <!-- Attachments -->
        <div id="bd_att">
          <div style="background:#333;color:#fff;padding:8px 12px;border-radius:8px 8px 0 0;font-size:var(--fs-sm);font-weight:600;display:flex;align-items:center;gap:8px;cursor:pointer" onclick="const c=this.nextElementSibling;c.style.display=c.style.display==='none'?'block':'none'">
            Attachments ${hasAtt ? `<span style="background:var(--acc2);color:var(--acc);font-size:var(--fs-xxs);padding:1px 6px;border-radius:8px">${atts.length}</span>` : ''}
            <span style="margin-left:auto;font-size:12px">▾</span>
          </div>
          <div style="border:1.5px dashed #ddd;border-top:none;border-radius:0 0 8px 8px;padding:12px;text-align:center">
            ${hasAtt
              ? atts.map(a => {
                  const url = typeof a === 'string' ? a : a.file_url || a.url || '';
                  const name = typeof a === 'string' ? a.split('/').pop() : a.file_name || a.name || 'file';
                  const size = a.file_size ? (a.file_size / 1024 / 1024).toFixed(2) + ' MB' : '';
                  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;padding:6px 10px;background:var(--bg3);border-radius:6px;font-size:var(--fs-sm);text-align:left">
                    <span>📄</span>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</span>
                    ${size ? `<span style="font-size:var(--fs-xs);color:var(--t3)">${size}</span>` : ''}
                    <a href="${esc(url)}" target="_blank" class="lk" style="font-size:var(--fs-xs)">⬇</a>
                  </div>`;
                }).join('')
              : '<div style="padding:8px"><div style="font-size:24px;color:var(--t4);margin-bottom:4px">☁</div>Drag files here to upload, or <a class="lk" style="font-weight:600">browse for files</a><div style="font-size:var(--fs-xs);color:var(--t4);margin-top:4px">PDF, TIFF, JPEG or PNG and below 10MB</div></div>'
            }
          </div>
        </div>
      </div>
    </div>`,
  };
}

/** Open bill detail — fetch from API if not the last created bill */
async function _openBillDetail(billId) {
  if (!billId) { App.go('tx_bill_detail'); return; }

  // Check if already in memory (e.g. just created)
  const mem = App.S._billDetail;
  if (mem && mem.bill && mem.bill.id === billId) {
    // Set hash with bill ID for bookmarkable URL
    App.S.route = 'tx_bill_detail';
    location.hash = 'tx_bill_detail/' + billId;
    const result = renderTxBillDetail();
    const ct = document.getElementById('content');
    const tb = document.getElementById('toolbar');
    if (ct) ct.innerHTML = result.ct || '';
    if (tb) tb.innerHTML = result.tb || '';
    return;
  }

  // Fetch from API — show loading skeleton first
  App.S.route = 'tx_bill_detail';
  location.hash = 'tx_bill_detail/' + billId;
  const ct = document.getElementById('content');
  const tb = document.getElementById('toolbar');
  if (ct) ct.innerHTML = '<div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading bill detail...</div>';
  if (tb) tb.innerHTML = '<div class="tb"><button class="bg" onclick="App.go(\'tx_bill\')">← Bills</button><div class="tb-t">Bill Detail</div></div>';

  try {
    const detail = await API.getBillDetail(billId);
    App.S._billDetail = detail;
    // Re-render now that data is ready
    if (App.S.route === 'tx_bill_detail') {
      const result = renderTxBillDetail();
      if (ct) ct.innerHTML = result.ct || '';
      if (tb) tb.innerHTML = result.tb || '';
    }
  } catch (e) {
    App.toast('Error loading bill: ' + e.message);
  }
}

// ═══════════════════════════════════════
// Bill Detail helpers (shared views — _bdPay, _bdAtt)
// ═══════════════════════════════════════
function _bdPay(s) {
  const p = s === 'paid';
  return `<div style="margin-top:10px;border:1px solid var(--bd);border-radius:var(--rd);overflow:hidden"><div style="background:#333;color:#fff;padding:6px 10px;font-size:var(--fs-sm);font-weight:600;display:flex;justify-content:space-between">Payment <span style="font-size:9px;padding:1px 8px;border-radius:8px;background:${p ? 'var(--gbg)' : 'var(--obg)'};color:${p ? 'var(--g)' : 'var(--o)'}">${p ? 'Paid' : 'Unpaid'}</span></div><div style="padding:8px;font-size:var(--fs-sm);text-align:center;color:var(--t3)">${p ? 'Paid in full' : 'No payment · <a class="lk">Record Payment →</a>'}</div></div>`;
}

function _bdAtt(f) {
  const l = f.map(x => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;padding:4px 8px;background:var(--bg3);border-radius:4px;font-size:var(--fs-sm)"><span>📄</span><span style="flex:1">${esc(x)}</span><a class="lk" style="font-size:var(--fs-xs)">View</a><a class="lk" style="font-size:var(--fs-xs);color:var(--r)">Remove</a></div>`).join('');
  return `<div style="margin-top:8px;border:1.5px dashed #ddd;border-radius:8px;padding:10px"><div style="background:#333;color:#fff;padding:5px 10px;border-radius:5px 5px 0 0;font-size:var(--fs-sm);font-weight:600">Attachments (${f.length})</div><div style="border:1.5px dashed #ddd;border-top:none;border-radius:0 0 5px 5px;padding:10px">${l}<div style="text-align:center;font-size:var(--fs-sm);color:var(--t3)">Drag files here, or <a style="color:var(--acc);font-weight:600;cursor:pointer">browse</a></div></div></div>`;
}

// Keep old view switcher for backward compat (MOCK detail views)
function _switchBdView() {}
function _bdDoc() { return ''; }
function _bdSelfView() { return ''; }
function _bdObView() { return ''; }
function _bdSplitView() { return ''; }

/** Navigate to bill detail by bill ID (issue #5) */
let _currentBillId = null;
function _goBillDetail(billId) {
  if (!billId) return;
  _currentBillId = billId;
  _openBillDetail(billId);
}

/** Cancel/Reverse a bill */
function _voidBill(billId) {
  App.showDialog({
    title: 'Cancel Bill',
    message: 'This will cancel this bill and create a reversal entry. This cannot be undone.',
    confirmText: 'Cancel Bill',
    onConfirm: async () => {
      try {
        await API.call('fin_void_bill', { bill_id: billId });
        App.toast('Bill cancelled');
        App.go('tx_log');
      } catch (e) {
        App.toast(e.message || 'Cancel failed');
      }
    },
  });
}

/** Record Payment from Bill Detail — navigate to py_record with this bill pre-selected */
function _recordPaymentFromBill(billId) {
  const detail = App.S._billDetail;
  if (!detail || !detail.bill) return App.toast('Bill data not loaded');
  const b = detail.bill;
  // Store bill info for py_record to pick up
  App.S._prefillPayment = {
    bill_id: b.id,
    bill_no: b.bill_no,
    vendor_name: b.supplier_name || b.vendor_name || '',
    amount: b.balance || 0,
    brand: b.paying_entity || b.brand || '',
  };
  App.go('py_record');
}

// ═══════════════════════════════════════
// 6. SD BRIDGE — ★ CONNECTED TO DB
// ═══════════════════════════════════════
let _sdFilter = 'all'; // 'all', 'pending', 'synced'
let _sdMonth = new Date().toISOString().substring(0, 7); // '2026-03'
let _sdChecked = new Set();
let _sdBrandFilter = ''; // brand name filter
let _sdRows = []; // cached rows for brand extraction

function renderTxSdBridge() {
  _sdChecked = new Set();
  return {
    tb: `<div class="tb"><div class="tb-t">SD Bridge</div><span style="font-size:var(--fs-xs);color:var(--t3)">Sale Daily → Finance sync</span><div style="flex:1"></div><select class="fl" style="width:150px" id="sd_month" onchange="ScrTx._sdChangeMonth()">${(()=>{let o='',d=new Date();for(let i=0;i<6;i++){let m=new Date(d.getFullYear(),d.getMonth()-i,1),v=m.toISOString().substring(0,7);o+=`<option value="${v}"${v===_sdMonth?' selected':''}>${v}</option>`}return o})()}</select><button class="btn bo" onclick="App.go('st_alert')">Settings</button></div>`,
    ct: `<div style="max-width:1100px;margin:0 auto">
      <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:12px;flex-wrap:wrap">
        <div style="display:flex;gap:3px" id="sd_filter_btns">
          <button class="btn bo" style="padding:6px 16px;font-size:12px;font-weight:600;background:var(--t1);color:#fff;border-color:var(--t1)" onclick="ScrTx._sdSetFilter('all',this)">All</button>
          <button class="btn bo" style="padding:6px 16px;font-size:12px" onclick="ScrTx._sdSetFilter('pending',this)">Pending</button>
          <button class="btn bo" style="padding:6px 16px;font-size:12px" onclick="ScrTx._sdSetFilter('synced',this)">Done</button>
        </div>
        <div><div class="fl-l">Brand</div><select class="fl" id="sd_brand" onchange="ScrTx._sdSetBrandFilter()" style="width:140px"><option value="">All Brands</option></select></div>
        <div style="flex:1"></div>
      </div>
      <div class="kpi" id="sd_kpi">
        <div class="kpi-c" style="background:#fff"><div class="kpi-v" style="color:var(--t4)">—</div><div class="kpi-l">Total Revenue</div></div>
        <div class="kpi-c" style="background:#fff"><div class="kpi-v" style="color:var(--t4)">—</div><div class="kpi-l">Total Expenses</div></div>
        <div class="kpi-c" style="background:#fff"><div class="kpi-v" style="color:var(--t4)">—</div><div class="kpi-l">Pending items</div></div>
      </div>
      <div id="sd_cards"><div style="text-align:center;padding:30px;color:var(--t3)"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading SD Bridge...</div></div>
      <div id="sd_actions" style="display:none;align-items:center;padding:10px 0;gap:8px">
        <button class="btn bo" style="padding:5px 12px;font-size:11px" onclick="ScrTx._sdSelectAll()">Select All Pending</button>
        <button class="bg" style="font-size:11px" onclick="ScrTx._sdDeselectAll()">Deselect All</button>
        <div style="flex:1;font-size:var(--fs-xs);color:var(--t3)" id="sd_sel_count">0 selected</div>
        <button class="bs" style="padding:6px 16px;font-size:12px" onclick="ScrTx._sdSyncSelected()">Sync selected</button>
      </div>
    </div>`,
  };
}

async function _loadSdBridge() {
  try {
    const result = await API.getSdPending({ month: _sdMonth });
    const rows = result.rows || [];
    _sdRows = rows; // cache for brand extraction
    const kpi = result.kpi || {};

    // Build brand dropdown from actual bridge data
    const brandSet = new Set();
    rows.forEach(r => { const b = r.paying_entity || r.store || ''; if (b) brandSet.add(b); });
    const brandSel = document.getElementById('sd_brand');
    if (brandSel) {
      const prev = brandSel.value;
      brandSel.innerHTML = '<option value="">All Brands</option>' +
        [...brandSet].sort().map(b => `<option${b === prev ? ' selected' : ''}>${App.esc(b)}</option>`).join('');
    }

    // Render KPI
    const kpiEl = document.getElementById('sd_kpi');
    if (kpiEl) {
      kpiEl.innerHTML = `
        <div class="kpi-c" style="background:#fff"><div class="kpi-v" style="color:var(--g)">${fm(kpi.revenue || 0)}</div><div class="kpi-l">Total Revenue</div></div>
        <div class="kpi-c" style="background:#fff"><div class="kpi-v" style="color:var(--r)">${fm(kpi.expenses || 0)}</div><div class="kpi-l">Total Expenses</div></div>
        <div class="kpi-c" style="background:#fff"><div class="kpi-v">${kpi.pendingCount || 0}</div><div class="kpi-l">Pending items</div></div>
        <div class="kpi-c" style="background:#fff"><div class="kpi-v" style="color:var(--g)">${kpi.syncedCount || 0}</div><div class="kpi-l">Synced</div></div>`;
    }

    // Update filter button counts
    const allCount = rows.length;
    const pendingCount = rows.filter(r => r.status === 'pending').length;
    const syncedCount2 = rows.filter(r => r.status === 'synced').length;
    const btns = document.getElementById('sd_filter_btns');
    if (btns) {
      const btnEls = btns.querySelectorAll('button');
      if (btnEls[0]) btnEls[0].textContent = 'All (' + allCount + ')';
      if (btnEls[1]) btnEls[1].textContent = 'Pending (' + pendingCount + ')';
      if (btnEls[2]) btnEls[2].textContent = 'Done (' + syncedCount2 + ')';
    }

    // Filter rows
    let filtered = rows;
    if (_sdFilter === 'pending') filtered = rows.filter(r => r.status === 'pending');
    else if (_sdFilter === 'synced') filtered = rows.filter(r => r.status === 'synced');

    // Brand filter (paying_entity from SD bridge data)
    if (_sdBrandFilter) {
      filtered = filtered.filter(r => (r.paying_entity || r.store || '') === _sdBrandFilter);
    }

    // Group by date + store
    const groups = {};
    filtered.forEach(r => {
      const key = (r.date || 'unknown') + '|' + (r.store || 'unknown');
      if (!groups[key]) groups[key] = { date: r.date, store: r.store, items: [] };
      groups[key].items.push(r);
    });

    const cardsEl = document.getElementById('sd_cards');
    if (!cardsEl) return;

    if (filtered.length === 0) {
      cardsEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--t3)">No records for this period</div>';
      return;
    }

    // Sort groups by date desc
    const sortedGroups = Object.values(groups).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    let html = '';
    sortedGroups.forEach((g, gi) => {
      const pendingItems = g.items.filter(r => r.status === 'pending');
      const syncedItems = g.items.filter(r => r.status === 'synced');
      const totalItems = g.items.length;
      const syncPct = totalItems > 0 ? Math.round(syncedItems.length / totalItems * 100) : 0;
      const allSynced = pendingItems.length === 0;
      const borderColor = allSynced ? 'var(--g)' : 'var(--o)';
      const barColor = allSynced ? 'var(--g)' : 'var(--o)';

      const rev = g.items.filter(r => r.type === 'revenue').reduce((s, r) => s + (r.amount || 0), 0);
      const exp = g.items.filter(r => r.type === 'expense').reduce((s, r) => s + (r.amount || 0), 0);

      const fmtDate = _fmtDate(g.date);

      html += `<div style="border:1px solid var(--bd);border-radius:10px;margin-bottom:12px;overflow:hidden;border-left:3px solid ${borderColor}">`;
      // Group header
      html += `<div style="display:flex;align-items:center;padding:12px 16px;gap:10px;cursor:pointer;background:#fff" onclick="ScrTx._sdToggleGroup(${gi})">`;
      html += `<span style="font-size:12px;color:var(--t3)" id="sd_arr_${gi}">▸</span>`;
      html += `<div style="font-size:13px;font-weight:700">${esc(fmtDate)}</div>`;
      html += `<div style="font-size:11px;color:var(--t2);font-weight:600;background:var(--bg3);padding:2px 8px;border-radius:4px">${esc(g.store || '')}</div>`;
      html += `<div style="display:flex;align-items:center;gap:6px;margin-left:12px"><div style="width:80px;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="width:${syncPct}%;height:100%;background:${barColor};border-radius:3px"></div></div><span style="font-size:10px;color:${barColor};font-weight:600">${syncedItems.length}/${totalItems}${allSynced ? ' ✓' : ''}</span></div>`;
      html += `<div style="display:flex;gap:8px;margin-left:auto">`;
      if (rev > 0) html += `<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:var(--gbg);color:var(--g)">💰 ${fm(rev)}</span>`;
      if (exp > 0) html += `<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:var(--rbg);color:var(--r)">📦 ${fm(exp)}</span>`;
      if (allSynced) html += `<span class="sts sts-c" style="font-size:10px">All synced</span>`;
      html += `</div></div>`;

      // Group items (collapsed by default)
      html += `<div id="sd_grp_${gi}" style="display:none;border-top:1px solid var(--bd2)">`;
      g.items.forEach(r => {
        const isPending = r.status === 'pending';
        const isRev = r.type === 'revenue';
        const icon = isRev ? '💰' : (r.doc_type === 'Invoice' ? '📄' : '📦');
        const amtColor = isRev ? 'var(--g)' : 'var(--r)';
        const amtSign = isRev ? '+' : '-';
        const rowBg = isPending ? 'rgba(217,119,6,.03)' : '';
        const rowOpacity = isPending ? '' : 'opacity:.7';

        // Doc type badge
        const docBadge = r.doc_type === 'Invoice' ? '<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:var(--obg);color:var(--o)">Invoice</span>'
          : r.doc_type === 'Bill' ? '<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:var(--rbg);color:var(--r)">Bill</span>'
          : r.doc_type === 'None' ? '<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:var(--gbg);color:var(--g)">Revenue</span>'
          : '';

        // Payment status badge
        const payBadge = r.payment_status === 'Paid' ? '<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:var(--gbg);color:var(--g)">Paid</span>'
          : r.payment_status === 'Unpaid' ? '<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:var(--rbg);color:var(--r)">Unpaid</span>'
          : r.payment_status === 'Pending' ? '<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:var(--obg);color:var(--o)">Pending</span>'
          : '';

        // Display name: vendor for expense, channel description for revenue
        const displayName = isRev ? (r.description || 'Revenue') : (r.vendor_name || r.description || '—');
        const subInfo = r.doc_number ? r.doc_number : '';

        html += `<div style="display:flex;align-items:center;padding:8px 16px;gap:10px;border-bottom:1px solid var(--bd2);font-size:12px;background:${rowBg};${rowOpacity}">`;
        if (isPending) {
          html += `<input type="checkbox" style="accent-color:var(--acc)" data-sdid="${esc(r.id)}" onchange="ScrTx._sdCheckToggle(this)">`;
        } else {
          html += `<input type="checkbox" disabled checked style="accent-color:var(--acc)">`;
        }
        html += `<span style="font-size:15px;width:22px;text-align:center">${icon}</span>`;
        html += `<div style="flex:1;min-width:0"><div style="font-weight:500">${esc(displayName)}</div><div style="font-size:10px;color:var(--t3);display:flex;gap:6px;align-items:center;margin-top:1px">${docBadge}${subInfo ? '<span>' + esc(subInfo) + '</span>' : ''}${r.description && !isRev && r.vendor_name ? '<span>' + esc(r.description) + '</span>' : ''}</div></div>`;
        html += `<div style="font-weight:700;min-width:80px;text-align:right;color:${amtColor}">${amtSign}${fm(Math.abs(r.amount || 0))}</div>`;
        html += `<div style="min-width:60px;text-align:center">${payBadge}</div>`;
        html += `<div style="min-width:60px;text-align:center">${isPending ? '<span class="sts sts-p">Pending</span>' : '<span class="sts sts-c">✓ Synced</span>'}</div>`;
        html += `</div>`;
      });

      // Group footer — sync buttons (only if has pending)
      if (pendingItems.length > 0) {
        const pendingIds = pendingItems.map(r => r.id);
        html += `<div style="display:flex;align-items:center;padding:10px 16px;background:var(--bg2);border-top:1px solid var(--bd2);gap:8px">`;
        html += `<label style="font-size:10px;display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--acc);font-weight:600"><input type="checkbox" style="accent-color:var(--acc)" onchange="ScrTx._sdSelectGroup(this,${gi})"> Select all (${pendingItems.length})</label>`;
        html += `<div style="flex:1;font-size:10px;color:var(--t3)">${syncedItems.length} of ${totalItems} synced</div>`;
        html += `<button class="bs" style="padding:6px 16px;font-size:12px" onclick="ScrTx._sdSyncSelected()">Sync selected</button>`;
        html += `</div>`;
      }
      html += `</div></div>`;
    });

    cardsEl.innerHTML = html;

    // Show/hide bottom actions
    _sdUpdateSelCount();

  } catch (e) {
    const cardsEl = document.getElementById('sd_cards');
    if (cardsEl) cardsEl.innerHTML = `<div style="text-align:center;padding:30px;color:var(--r)">Error: ${esc(e.message)}</div>`;
  }
}

function _sdToggleGroup(idx) {
  const el = document.getElementById('sd_grp_' + idx);
  const arr = document.getElementById('sd_arr_' + idx);
  if (!el) return;
  const show = el.style.display === 'none';
  el.style.display = show ? 'block' : 'none';
  if (arr) arr.textContent = show ? '▾' : '▸';
}

function _sdSetFilter(f, btn) {
  _sdFilter = f;
  // Highlight button
  if (btn) {
    btn.parentElement.querySelectorAll('button').forEach(b => {
      b.style.background = '#fff'; b.style.color = 'var(--t2)'; b.style.borderColor = 'var(--bd)';
    });
    btn.style.background = 'var(--t1)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--t1)';
  }
  _loadSdBridge();
}

function _sdSetBrandFilter() {
  _sdBrandFilter = document.getElementById('sd_brand')?.value || '';
  _loadSdBridge();
}

function _sdChangeMonth() {
  const el = document.getElementById('sd_month');
  if (el) _sdMonth = el.value;
  _sdChecked = new Set();
  _loadSdBridge();
}

function _sdCheckToggle(cb) {
  const id = cb.dataset.sdid;
  if (cb.checked) _sdChecked.add(id);
  else _sdChecked.delete(id);
  _sdUpdateSelCount();
}

function _sdUpdateSelCount() {
  const el = document.getElementById('sd_sel_count');
  const actEl = document.getElementById('sd_actions');
  if (el) el.textContent = _sdChecked.size + ' selected';
  // Always show actions bar if there are pending items on the page
  const hasPending = document.querySelectorAll('[data-sdid]').length > 0;
  if (actEl) actEl.style.display = hasPending ? 'flex' : 'none';
}

/** Select all pending items across all groups */
function _sdSelectAll() {
  document.querySelectorAll('[data-sdid]').forEach(cb => {
    if (!cb.disabled) {
      cb.checked = true;
      _sdChecked.add(cb.dataset.sdid);
    }
  });
  // Check all group checkboxes too
  document.querySelectorAll('#sd_cards input[type="checkbox"][onchange*="_sdSelectGroup"]').forEach(cb => { cb.checked = true; });
  _sdUpdateSelCount();
}

/** Deselect all */
function _sdDeselectAll() {
  _sdChecked = new Set();
  document.querySelectorAll('[data-sdid]').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('#sd_cards input[type="checkbox"][onchange*="_sdSelectGroup"]').forEach(cb => { cb.checked = false; });
  _sdUpdateSelCount();
}

/** Select/deselect all pending items in a specific group */
function _sdSelectGroup(masterCb, groupIdx) {
  const grp = document.getElementById('sd_grp_' + groupIdx);
  if (!grp) return;
  const checkboxes = grp.querySelectorAll('[data-sdid]');
  checkboxes.forEach(cb => {
    if (!cb.disabled) {
      cb.checked = masterCb.checked;
      if (masterCb.checked) _sdChecked.add(cb.dataset.sdid);
      else _sdChecked.delete(cb.dataset.sdid);
    }
  });
  _sdUpdateSelCount();
}

async function _sdSyncSelected() {
  if (_sdChecked.size === 0) { App.toast('Please select records to sync'); return; }
  const ids = Array.from(_sdChecked);

  // Disable buttons during sync
  const btns = document.querySelectorAll('#sd_cards .bs, #sd_actions .bs');
  btns.forEach(b => { b.disabled = true; b.textContent = 'Syncing...'; });

  try {
    const result = await API.syncSd(ids);
    const count = result.synced || ids.length;
    const billNos = (result.created || []).map(c => c.bill_no).filter(Boolean);
    const msg = billNos.length > 0
      ? `Synced ${count} → ${billNos.join(', ')}`
      : `Synced ${count} records`;
    App.toast(msg);
    _sdChecked = new Set();
    // Reload to reflect new state
    await _loadSdBridge();
  } catch (e) {
    App.toast('Sync failed: ' + e.message);
  } finally {
    btns.forEach(b => { b.disabled = false; b.textContent = 'Sync selected'; });
  }
}

// ═══════════════════════════════════════
// 7. FIND TRANSACTIONS — ★ CONNECTED TO DB (DC tab)
// ═══════════════════════════════════════
let _findTab = 'dc';

function renderTxFind() {
  _findTab = 'dc';
  const dr = dateRange();
  return {
    tb: '<div class="tb"><div class="tb-t">Find Transactions</div></div>',
    ct: `<div class="card" style="max-width:1000px;margin:0 auto"><div class="tabs" id="find_tabs"><div class="tab a" onclick="ScrTx._switchFindTab('dc')">Debit and Credit</div><div class="tab" onclick="ScrTx._switchFindTab('ft')">Find Transaction</div></div><div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px"><div><div class="fl-l">Period</div><select class="fl"><option>This month</option><option>Last month</option></select></div><div><div class="fl-l">Date from</div><input class="fl" type="date" value="${dr.from}" style="width:130px"></div><div><div class="fl-l">Date to</div><input class="fl" type="date" value="${dr.to}" style="width:130px"></div><div><div class="fl-l">Contact</div><select class="fl" style="width:100px"><option>All</option></select></div><div><div class="fl-l">Brand</div><select class="fl" id="find_brand" style="width:140px">${_brandFilterOpts()}</select></div><div><div class="fl-l">Search</div><input class="fl" placeholder="" style="width:100px"></div><div style="flex:1"></div><button class="bg" style="color:var(--acc)">Reset</button></div><div id="find_ct">${_skeletonRow(7).replace('<tr>', '<table class="tbl"><tr>').replace('</tr>', '</tr></table>')}</div></div>`,
  };
}

async function _loadFind() {
  const el = document.getElementById('find_ct');
  if (el) el.innerHTML = _findTab === 'dc' ? await _findDC() : await _findFT();
}

function _switchFindTab(t) {
  _findTab = t;
  document.querySelectorAll('#find_tabs .tab').forEach(x => x.classList.remove('a'));
  document.querySelectorAll('#find_tabs .tab')[t === 'dc' ? 0 : 1]?.classList.add('a');
  _loadFind();
}

async function _findDC() {
  try {
    const data = await API.getDebitCredits({});
    if (!data || data.length === 0) {
      return '<div style="text-align:center;padding:20px;color:var(--t3)">No debit/credit records found</div>';
    }
    const rows = data.map(r => `<tr><td>${_fmtDate(r.date)}</td><td style="color:var(--b)"><a class="lk">${esc(r.debitRef)}</a></td><td><a class="lk">${esc(r.creditRef)}</a></td><td>${esc(r.supplier)}</td><td style="text-align:right;color:var(--b)">${fm(r.debitAmt)}</td><td style="text-align:right">${fm(r.creditAmt)}</td><td>${sb(r.status === 'Linked' ? 'closed' : 'pending')}</td></tr>`).join('');
    return `<div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:8px">Debit notes paired with linked invoices</div><table class="tbl" id="tbl_find_dc"><thead><tr>${sth('Date','date','tbl_find_dc')}${sth('Debit Note','debit','tbl_find_dc')}${sth('Linked Invoice','credit','tbl_find_dc')}${sth('Supplier','supplier','tbl_find_dc')}${sthR('Debit ($)','debitAmt','tbl_find_dc')}${sthR('Invoice ($)','creditAmt','tbl_find_dc')}${sth('Status','status','tbl_find_dc')}</tr></thead><tbody>${rows}</tbody></table>`;
  } catch (e) {
    return `<div style="text-align:center;padding:20px;color:var(--r)">Error: ${esc(e.message)}</div>`;
  }
}

async function _findFT() {
  try {
    const result = await API.getTransactions({ type: 'all', page: 1 });
    const data = result.rows || [];
    if (data.length === 0) {
      return '<div style="text-align:center;padding:20px;color:var(--t3)">No transactions found</div>';
    }
    const rows = data.map(r => `<tr><td>${_fmtDate(r.date)}</td><td><a class="lk">${esc(r.ref)}</a></td><td>${esc(r.type)}</td><td>${esc(r.desc)}</td><td>${esc(r.contact)}</td><td style="text-align:right">${fm(r.amount)}</td><td>${sb(r.status)}</td></tr>`).join('');
    return `<div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:8px">All transactions</div><table class="tbl" id="tbl_find_ft"><thead><tr>${sth('Date','date','tbl_find_ft')}${sth('Reference','ref','tbl_find_ft')}${sth('Type','type','tbl_find_ft')}${sth('Description','desc','tbl_find_ft')}${sth('Contact','contact','tbl_find_ft')}${sthR('Amount ($)','amount','tbl_find_ft')}${sth('Status','status','tbl_find_ft')}</tr></thead><tbody>${rows}</tbody></table>`;
  } catch (e) {
    return `<div style="text-align:center;padding:20px;color:var(--r)">Error: ${esc(e.message)}</div>`;
  }
}

// ═══════════════════════════════════════
// REGISTER ROUTES
// ═══════════════════════════════════════
App.registerRoutes({
  tx_log:         { render: renderTxLog, onLoad: _loadLog },
  tx_sale:        { render: renderTxSale, onLoad: _loadSales },
  tx_bill:        { render: renderTxBill, onLoad: _loadBills },
  tx_return:      { render: renderTxReturn, onLoad: _loadReturns },
  tx_bill_detail: { render: renderTxBillDetail },
  tx_sd:          { render: renderTxSdBridge, onLoad: _loadSdBridge },
  tx_find:        { render: renderTxFind, onLoad: _loadFind },
});

// ═══════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════
window.ScrTx = {
  _switchBdView,
  _showDebitDetail,
  _switchFindTab,
  _sort: App.sortTable,
  _openBillDetail,
  _goBillDetail,
  _voidBill,
  _recordPaymentFromBill,
  _loadMoreBills,
  _sdToggleGroup,
  _sdSetFilter,
  _sdSetBrandFilter,
  _sdChangeMonth,
  _sdCheckToggle,
  _sdSyncSelected,
  _sdSelectAll,
  _sdDeselectAll,
  _sdSelectGroup,
  // Filter + Reset (Task 1)
  _filterLog,
  _resetLog,
  _filterSales,
  _resetSales,
  _filterBills,
  _resetBills,
  _filterReturns,
  _resetReturns,
};

})();
