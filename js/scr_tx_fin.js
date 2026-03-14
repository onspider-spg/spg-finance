/** Version 1.6.2 | 15 MAR 2026 | Siam Palette Group | Created 12 MAR 2026 */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_tx_fin.js
 * Transaction screens: Log, Sales, Bills, Return,
 * Bill Detail, SD Bridge, Find Transactions
 * ═══════════════════════════════════════════
 *
 * CHANGED v1.6.1 → v1.6.2:
 * - [MOVED] _sortTable, sth, sthR → App.sortTable, App.sth, App.sthR (shared in app_fin.js)
 * - [FIXED] Arrow indicator changed from ⇅ to ▲/▼ (active column only)
 * - [ADDED] Sort support for Find DC and Find FT tables
 * ═══════════════════════════════════════════
 */
(() => {
const esc = App.esc, fm = App.formatMoney, sb = App.statusBadge;

// ═══════════════════════════════════════
// MOCK DATA — still used for screens not yet connected to DB
// ═══════════════════════════════════════
const TX_MOCK = {
  log: [
    { date: '12/03/2026', ref: '1277', type: 'Pay run', desc: 'Wage Mar W2', brand: 'Mango Coco', contact: 'Watcharapol D.', amount: 609, recon: 'Match' },
    { date: '11/03/2026', ref: '1284', type: 'Bill payment', desc: 'Mind.RBuakl', brand: 'Mango Coco', contact: 'Mind.RBuakl xx_M...', amount: 582.82, recon: 'Group Match' },
    { date: '11/03/2026', ref: '1282', type: 'Bill payment', desc: 'Rental Mar 2026', brand: 'Mango Coco', contact: 'Dencal Pty Ltd', amount: 23558.32, recon: 'Match' },
    { date: '11/03/2026', ref: 'FIN-0050', type: 'Bill', desc: 'Purchase; Dencal', brand: 'Mango Coco', contact: 'Dencal Pty Ltd', amount: 23558.32, recon: '' },
    { date: '10/03/2026', ref: 'FIN-0049', type: 'Bill', desc: 'Siam Pacific Food', brand: 'Flying Tigress', contact: 'Siam Pacific Food', amount: 86.44, recon: 'Unmatch' },
  ],
  sales: [
    { date: '12/03/2026', brand: 'Mango Coco', channel: 'Cash', amount: 2340.50, gst: 234.05, status: 'Received' },
    { date: '12/03/2026', brand: 'Mango Coco', channel: 'UberEats', amount: 890.20, gst: 89.02, status: 'Received' },
    { date: '11/03/2026', brand: 'Flying Tigress', channel: 'Card', amount: 1560, gst: 156, status: 'Received' },
    { date: '11/03/2026', brand: 'Mango Coco', channel: 'Easi', amount: 340, gst: 34, status: 'Received' },
  ],
  returns: [{ date: '09/03/2026', bill: 'FIN-0047', supplier: 'Siam Pacific Food', inv: 'INV00003237-CR', origInv: 'FIN-0048 · INV00003237', amount: -50, balance: -50, applyStatus: 'Unused' }],
  debitCredits: [{ date: '09/03/2026', debitRef: 'FIN-0047', creditRef: 'FIN-0048', supplier: 'Siam Pacific Food', debitAmt: -50, creditAmt: 654.16, status: 'Linked' }],
  groupedTx: [
    { date: '11/03/2026', ref: 'PAY-001', type: 'Group Payment', desc: 'Pro Bros — 7 bills', contact: 'Pro Bros Providore', amount: 4150, items: 7 },
    { date: '10/03/2026', ref: 'FIN-0050', type: 'Single Payment', desc: 'Attakor Trading', contact: 'Attakor Trading', amount: 200, items: 1 },
    { date: '09/03/2026', ref: 'FIN-0049', type: 'Unpaid', desc: 'Siam Pacific Food', contact: 'Siam Pacific Food', amount: 86.44, items: 1 },
  ],
};

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

/** Skeleton loading row for tables */
function _skeletonRow(cols) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:20px;color:var(--t3)"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</td></tr>`;
}

/** Format ISO date to DD/MM/YYYY for display */
function _fmtDate(d) {
  if (!d) return '';
  if (d.includes('/')) return d; // already formatted
  const p = d.split('-');
  return p.length >= 3 ? p[2] + '/' + p[1] + '/' + p[0] : d;
}

// ═══════════════════════════════════════
// 1. TRANSACTION LOG — ★ CONNECTED TO DB
// ═══════════════════════════════════════

/** Render log table rows from data array */
function _logRows(rows) {
  if (!rows || rows.length === 0) {
    return '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--t3)">No transactions found</td></tr>';
  }
  return rows.map(r => `<tr><td>${_fmtDate(r.date)}</td><td><a class="lk">${esc(r.ref)}</a></td><td>${esc(r.type)}</td><td>${esc(r.desc)}</td><td>${esc(r.brand)}</td><td>${esc(r.contact)}</td><td style="text-align:right">${fm(r.amount)}</td><td>${reconBadge(r.recon)}</td></tr>`).join('');
}

function renderTxLog() {
  const dr = dateRange();
  const mem = App.S._tx_log;
  const hasMem = mem && mem.length > 0;
  const rows = hasMem ? _logRows(mem) : _skeletonRow(8);

  return {
    tb: `<div class="tb"><div class="tb-t">Transaction Log</div><button class="bs" onclick="App.go('rc_bank')">Reconcile</button></div>`,
    ct: `<div style="${TW}"><div class="card"><div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px"><div><div class="fl-l">Type</div><select class="fl" style="width:100px"><option>All</option><option>Income</option><option>Expense</option><option>Transfer</option></select></div><div><div class="fl-l">Brand</div><select class="fl" style="width:120px"><option>All</option><option>Mango Coco</option><option>Flying Tigress</option></select></div><div><div class="fl-l">Status</div><select class="fl" style="width:80px"><option>All</option><option>Paid</option><option>Unpaid</option></select></div><div><div class="fl-l">Date from</div><input class="fl" type="date" value="${dr.from}" style="width:130px"></div><div><div class="fl-l">Date to</div><input class="fl" type="date" value="${dr.to}" style="width:130px"></div><div><div class="fl-l">Search</div><input class="fl" placeholder="" style="width:100px"></div><div style="flex:1"></div><button class="bg" style="color:var(--acc)">Reset</button></div></div><div class="card" style="padding:0"><table class="tbl" id="tbl_log"><thead><tr>${sth('Date', 'date', 'tbl_log')}${sth('Ref no', 'ref', 'tbl_log')}${sth('Type', 'type', 'tbl_log')}${sth('Description', 'desc', 'tbl_log')}${sth('Brand', 'brand', 'tbl_log')}${sth('Contact', 'contact', 'tbl_log')}${sthR('Amount ($)', 'amount', 'tbl_log')}${sth('Reconcile', 'recon', 'tbl_log')}</tr></thead><tbody id="log_tbody">${rows}</tbody></table></div><div id="txlog_lm" style="text-align:center;padding:10px;display:none"><button class="btn bo" style="font-size:var(--fs-sm)">Load more</button></div></div>`,
  };
}

async function _loadLog() {
  try {
    const result = await API.getTransactions({ type: 'all', page: 1 });
    const tbody = document.getElementById('log_tbody');
    if (tbody) tbody.innerHTML = _logRows(result.rows);
  } catch (e) {
    const tbody = document.getElementById('log_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--r)">Error: ${esc(e.message)}</td></tr>`;
  }
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
    ct: `<div style="${TW}"><div class="card"><div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px"><div><div class="fl-l">Brand</div><select class="fl" style="width:120px"><option>All</option><option>Mango Coco</option><option>Flying Tigress</option></select></div><div><div class="fl-l">Channel</div><select class="fl" style="width:100px"><option>All</option><option>Cash</option><option>Card</option><option>UberEats</option></select></div><div><div class="fl-l">Date from</div><input class="fl" type="date" value="${dr.from}" style="width:130px"></div><div><div class="fl-l">Date to</div><input class="fl" type="date" value="${dr.to}" style="width:130px"></div><div style="flex:1"></div><button class="bg" style="color:var(--acc)">Reset</button></div><div id="sale_total" style="text-align:right;font-size:var(--fs-sm);color:var(--t2)">Total Revenue <b style="color:var(--g)">${fm(total)}</b></div></div><div class="card" style="padding:0"><table class="tbl" id="tbl_sale"><thead><tr>${sth('Date', 'date', 'tbl_sale')}${sth('Brand', 'brand', 'tbl_sale')}${sth('Channel', 'channel', 'tbl_sale')}${sthR('Amount ($)', 'amount', 'tbl_sale')}${sthR('GST', 'gst', 'tbl_sale')}${sth('Status', 'status', 'tbl_sale')}</tr></thead><tbody id="sale_tbody">${rows}</tbody></table></div><div id="txsale_lm" style="text-align:center;padding:10px;display:none"><button class="btn bo" style="font-size:var(--fs-sm)">Load more</button></div></div>`,
  };
}

async function _loadSales() {
  try {
    const result = await API.getTransactions({ type: 'sale', page: 1 });
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
    ct: `<div style="${TW}"><div class="card"><div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px"><div><div class="fl-l">Status</div><select class="fl" style="width:75px"><option>All</option><option>Open</option><option>Overdue</option><option>Closed</option><option>Debit</option></select></div><div><div class="fl-l">Supplier</div><select class="fl" style="width:140px"><option>All</option></select></div><div><div class="fl-l">Brand</div><select class="fl" style="width:110px"><option>All</option></select></div><div><div class="fl-l">Issue from</div><input class="fl" type="date" value="${dr.from}" style="width:130px"></div><div><div class="fl-l">Issue to</div><input class="fl" type="date" value="${dr.to}" style="width:130px"></div><div><div class="fl-l">Search</div><input class="fl" placeholder="" style="width:100px"></div><div style="flex:1"></div><button class="bg" style="color:var(--acc)">Reset</button></div><div id="bill_summary">${summary}</div></div><div class="card" style="padding:0"><table class="tbl" id="tbl_bill"><thead><tr>${sth('Issue date', 'date', 'tbl_bill')}${sth('Bill no', 'bill', 'tbl_bill')}${sth('Supplier', 'supplier', 'tbl_bill')}${sth('Inv no', 'inv', 'tbl_bill')}${sthR('Amount ($)', 'amount', 'tbl_bill')}${sthR('Balance due', 'balance', 'tbl_bill')}${sth('Due date', 'due', 'tbl_bill')}<th>File</th>${sth('Status', 'status', 'tbl_bill')}</tr></thead><tbody id="bill_tbody">${rows}</tbody></table></div><div id="txbill_lm" style="text-align:center;padding:10px;display:none"><button class="btn bo" style="font-size:var(--fs-sm)" onclick="ScrTx._loadMoreBills()">Load more</button></div></div>`,
  };
}

/** onLoad: fetch bills from API if not in memory */
async function _loadBills() {
  try {
    const result = await API.getBills({ page: 1 });
    const tbody = document.getElementById('bill_tbody');
    const summaryEl = document.getElementById('bill_summary');
    const lmEl = document.getElementById('txbill_lm');
    if (tbody) tbody.innerHTML = _billRows(result.rows);
    if (summaryEl) summaryEl.innerHTML = _billSummaryHTML(result.summary);
    if (lmEl && result.hasMore) lmEl.style.display = 'block';
    // Store summary in memory for instant display next time
    App.S._billSummary = result.summary;
  } catch (e) {
    const tbody = document.getElementById('bill_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--r)">Error: ${esc(e.message)}</td></tr>`;
  }
}

let _billPage = 1;
async function _loadMoreBills() {
  _billPage++;
  try {
    const result = await API.getBills({ page: _billPage });
    const tbody = document.getElementById('bill_tbody');
    const lmEl = document.getElementById('txbill_lm');
    if (tbody) tbody.innerHTML = _billRows(result.rows);
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
    ct: `<div style="${TW}"><div class="card"><div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:6px"><div><div class="fl-l">Supplier</div><select class="fl" style="width:160px"><option>All</option></select></div><div><div class="fl-l">Search</div><input class="fl" placeholder="Search..." style="width:140px"></div><div style="flex:1"></div><button class="bg" style="color:var(--acc)">Reset</button></div><div id="ret_total" style="text-align:right;font-size:var(--fs-sm);color:var(--t2)">Total debit: <b>${fm(tA)}</b></div></div><div class="card" style="padding:0"><table class="tbl" id="tbl_ret"><thead><tr>${sth('Date', 'date', 'tbl_ret')}${sth('Bill no', 'bill', 'tbl_ret')}${sth('Supplier', 'supplier', 'tbl_ret')}${sth('Inv no', 'inv', 'tbl_ret')}<th>Notes</th>${sthR('Amount ($)', 'amount', 'tbl_ret')}<th style="text-align:right">Balance</th><th>Status</th><th>Refund</th><th>Apply</th></tr></thead><tbody id="ret_tbody">${rows}</tbody></table></div><div id="txret_lm" style="text-align:center;padding:10px;display:none"><button class="btn bo" style="font-size:var(--fs-sm)">Load more</button></div><div id="debit_detail" style="display:none"></div></div>`,
  };
}

async function _loadReturns() {
  try {
    const result = await API.getTransactions({ type: 'return', page: 1 });
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
  const DS = 'disabled style="background:var(--bg2);color:var(--t1);border-color:var(--bd2);-webkit-text-fill-color:var(--t1);opacity:1"';

  const subtotal = li.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const tax = li.reduce((s, l) => s + (Number(l.gst) || 0), 0);
  const total = subtotal + tax;
  const paid = total - (Number(b.balance) || 0);

  // Line items rows — real inputs, disabled
  const liRows = li.length > 0 ? li.map(l =>
    `<tr>
      <td style="padding:0;border:1px solid #e5e7eb"><input ${DS} value="${esc(l.desc || l.description || '')}" style="width:100%;padding:8px 10px;border:none;font-size:var(--fs-body);background:var(--bg2);-webkit-text-fill-color:var(--t1)"></td>
      <td style="padding:0;border:1px solid #e5e7eb"><input ${DS} value="${esc(l.category || l.category_display || '')}" style="width:100%;padding:8px 10px;border:none;font-size:var(--fs-body);background:var(--bg2);-webkit-text-fill-color:var(--t1)"></td>
      <td style="padding:0;border:1px solid #e5e7eb"><input ${DS} value="${fm(l.amount)}" style="width:100%;padding:8px 10px;border:none;text-align:right;font-size:var(--fs-body);font-weight:500;background:var(--bg2);-webkit-text-fill-color:var(--t1)"></td>
      <td style="padding:0;border:1px solid #e5e7eb;background:var(--bg2)"><input ${DS} value="${fm(l.gst)}" style="width:100%;padding:8px 10px;border:none;text-align:right;font-size:var(--fs-body);background:var(--bg2);color:var(--t3);-webkit-text-fill-color:var(--t3)"></td>
      <td style="padding:0;border:1px solid #e5e7eb"><input ${DS} value="${esc(l.tax_code || 'FRE')}" style="width:100%;padding:8px 10px;border:none;font-size:var(--fs-body);background:var(--bg2);-webkit-text-fill-color:var(--t1)"></td>
    </tr>`
  ).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--t3);padding:16px">No line items</td></tr>';

  return {
    tb: `<div class="tb"><button class="bg" onclick="App.go('tx_bill')">← Bills</button><div class="tb-t">Bill Detail — ${esc(b.bill_no)}</div><div style="flex:1"></div>${sb(b.status)}</div>`,
    ct: `<div style="max-width:860px;margin:0 auto">
      <!-- Main detail card — same layout as Create Bill -->
      <div class="card">
        <!-- 2-column header fields (disabled inputs) -->
        <div style="display:flex;gap:30px">
          <!-- Left column -->
          <div style="width:300px">
            <div class="fg">
              <label class="lb">Transaction Type</label>
              <input class="inp" ${DS} value="Expense / Bill" style="width:280px">
            </div>
            <div class="fg">
              <label class="lb">Supplier</label>
              <input class="inp" ${DS} value="${esc(b.supplier_name || '—')}" style="width:280px;font-weight:600">
            </div>
            <div class="fg">
              <label class="lb">Supplier Invoice Number</label>
              <input class="inp" ${DS} value="${esc(b.inv_no || '—')}" style="width:280px">
            </div>
          </div>

          <!-- Right column -->
          <div style="flex:1">
            <div style="display:flex;align-items:center;margin-bottom:10px;justify-content:flex-end;gap:10px">
              <span class="lb" style="margin:0">Bill Number</span>
              <input class="inp" ${DS} value="${esc(b.bill_no)}" style="width:180px;font-weight:600">
            </div>
            <div style="display:flex;align-items:center;margin-bottom:10px;justify-content:flex-end;gap:10px">
              <span class="lb" style="margin:0">Issue Date</span>
              <input class="inp" type="date" ${DS} value="${b.date || ''}" style="width:180px">
            </div>
            <div style="display:flex;align-items:center;margin-bottom:10px;justify-content:flex-end;gap:10px">
              <span class="lb" style="margin:0">Due Date</span>
              <input class="inp" type="date" ${DS} value="${b.due_date || ''}" style="width:180px">
            </div>
            <div style="display:flex;align-items:center;margin-bottom:10px;justify-content:flex-end;gap:10px">
              <span class="lb" style="margin:0">Accrual Month</span>
              <input class="inp" type="month" ${DS} value="${b.date ? b.date.substring(0, 7) : ''}" style="width:180px">
            </div>
          </div>
        </div>

        <!-- Allocation divider -->
        <div style="display:flex;align-items:center;margin:12px 0">
          <hr style="border:none;border-top:1px solid #eee;flex:1;margin:0">
          <div style="padding:0 8px;font-size:var(--fs-xs);color:var(--t4)">Allocation: ${esc(alloc)}</div>
        </div>

        <!-- Line Items Table (disabled inputs) -->
        <table style="width:100%;border-collapse:collapse;font-size:var(--fs-body);margin-top:10px">
          <thead><tr>
            <th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:30%">Description</th>
            <th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:26%">Category</th>
            <th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:18%">Amount ($)</th>
            <th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:10%">GST</th>
            <th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:14%">Tax code</th>
          </tr></thead>
          <tbody>${liRows}</tbody>
        </table>

        <!-- Notes + Totals -->
        <div style="display:flex;gap:16px;margin-top:12px">
          <div style="flex:1">
            ${b.notes ? `<div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:2px">Notes</div><textarea class="inp" disabled style="width:100%;min-height:50px;resize:none;background:var(--bg2);color:var(--t1);-webkit-text-fill-color:var(--t1);opacity:1;border-color:var(--bd2)">${esc(b.notes)}</textarea>` : ''}
          </div>
          <div style="width:240px;text-align:right;font-size:var(--fs-body)">
            <div style="display:flex;justify-content:flex-end;gap:16px;padding:4px 0"><b>Subtotal</b><b>${fm(subtotal)}</b></div>
            <div style="display:flex;justify-content:flex-end;gap:16px;padding:4px 0;color:var(--t2)">Tax <span>${fm(tax)}</span></div>
            <div style="display:flex;justify-content:flex-end;gap:16px;padding:4px 0"><b>Total</b><b>${fm(total)}</b></div>
            <div style="display:flex;justify-content:flex-end;gap:16px;padding:4px 0;color:var(--t2)">Amount paid <span>${fm(paid)}</span></div>
            <div style="display:flex;justify-content:flex-end;gap:16px;padding:6px 0;font-weight:700;color:${b.status === 'Closed' ? 'var(--g)' : 'var(--r)'}">Balance due <span>${b.status === 'Closed' ? fm(0) : fm(b.balance)}</span></div>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div style="display:flex;align-items:center;gap:6px;padding:8px 0">
        <button class="btn bo">View PDF</button>
        <button class="btn bo">Print</button>
        <div style="flex:1"></div>
        <button class="btn bo" onclick="App.go('tx_bill')">Back to Bills</button>
        <button class="bs">Record Payment</button>
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
    App.go('tx_bill_detail');
    return;
  }

  // Fetch from API
  App.go('tx_bill_detail'); // show loading skeleton
  try {
    const detail = await API.getBillDetail(billId);
    App.S._billDetail = detail;
    // Re-render now that data is ready
    const ct = document.getElementById('content');
    if (ct && App.S.route === 'tx_bill_detail') {
      const result = renderTxBillDetail();
      ct.innerHTML = result.ct || '';
      const tb = document.getElementById('toolbar');
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

// ═══════════════════════════════════════
// 6. SD BRIDGE — ★ CONNECTED TO DB
// ═══════════════════════════════════════
let _sdFilter = 'all'; // 'all', 'pending', 'synced'
let _sdMonth = new Date().toISOString().substring(0, 7); // '2026-03'
let _sdChecked = new Set();

function renderTxSdBridge() {
  _sdChecked = new Set();
  return {
    tb: `<div class="tb"><div class="tb-t">SD Bridge</div><span style="font-size:var(--fs-xs);color:var(--t3)">Sale Daily → Finance sync</span><div style="flex:1"></div><select class="fl" style="width:150px" id="sd_month" onchange="ScrTx._sdChangeMonth()"><option value="${_sdMonth}">${_sdMonth}</option></select><button class="btn bo" onclick="App.go('st_alert')">Settings</button></div>`,
    ct: `<div style="max-width:1100px;margin:0 auto">
      <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:12px;flex-wrap:wrap">
        <div style="display:flex;gap:3px" id="sd_filter_btns">
          <button class="btn bo" style="padding:6px 16px;font-size:12px;font-weight:600;background:var(--t1);color:#fff;border-color:var(--t1)" onclick="ScrTx._sdSetFilter('all',this)">All</button>
          <button class="btn bo" style="padding:6px 16px;font-size:12px" onclick="ScrTx._sdSetFilter('pending',this)">Pending</button>
          <button class="btn bo" style="padding:6px 16px;font-size:12px" onclick="ScrTx._sdSetFilter('synced',this)">Done</button>
        </div>
        <div style="flex:1"></div>
      </div>
      <div class="kpi" id="sd_kpi">
        <div class="kpi-c" style="background:#fff"><div class="kpi-v" style="color:var(--t4)">—</div><div class="kpi-l">Total Revenue</div></div>
        <div class="kpi-c" style="background:#fff"><div class="kpi-v" style="color:var(--t4)">—</div><div class="kpi-l">Total Expenses</div></div>
        <div class="kpi-c" style="background:#fff"><div class="kpi-v" style="color:var(--t4)">—</div><div class="kpi-l">Pending items</div></div>
      </div>
      <div id="sd_cards"><div style="text-align:center;padding:30px;color:var(--t3)"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading SD Bridge...</div></div>
      <div id="sd_actions" style="display:none;display:flex;align-items:center;padding:10px 0;gap:8px">
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
    const kpi = result.kpi || {};

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
        html += `<div style="display:flex;align-items:center;padding:10px 16px;background:var(--bg2);border-top:1px solid var(--bd2);gap:8px">`;
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
  if (actEl) actEl.style.display = _sdChecked.size > 0 ? 'flex' : 'none';
}

async function _sdSyncSelected() {
  if (_sdChecked.size === 0) { App.toast('Please select records to sync'); return; }
  const ids = Array.from(_sdChecked);

  // Disable buttons during sync
  const btns = document.querySelectorAll('#sd_cards .bs, #sd_actions .bs');
  btns.forEach(b => { b.disabled = true; b.textContent = 'Syncing...'; });

  try {
    const result = await API.syncSd(ids);
    App.toast('Synced ' + (result.synced || ids.length) + ' records');
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
    ct: `<div class="card" style="max-width:1000px;margin:0 auto"><div class="tabs" id="find_tabs"><div class="tab a" onclick="ScrTx._switchFindTab('dc')">Debit and Credit</div><div class="tab" onclick="ScrTx._switchFindTab('ft')">Find Transaction</div></div><div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px"><div><div class="fl-l">Period</div><select class="fl"><option>This month</option><option>Last month</option></select></div><div><div class="fl-l">Date from</div><input class="fl" type="date" value="${dr.from}" style="width:130px"></div><div><div class="fl-l">Date to</div><input class="fl" type="date" value="${dr.to}" style="width:130px"></div><div><div class="fl-l">Contact</div><select class="fl" style="width:100px"><option>All</option></select></div><div><div class="fl-l">Search</div><input class="fl" placeholder="" style="width:100px"></div><div style="flex:1"></div><button class="bg" style="color:var(--acc)">Reset</button></div><div id="find_ct">${_skeletonRow(7).replace('<tr>', '<table class="tbl"><tr>').replace('</tr>', '</tr></table>')}</div></div>`,
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
  _loadMoreBills,
  _sdToggleGroup,
  _sdSetFilter,
  _sdChangeMonth,
  _sdCheckToggle,
  _sdSyncSelected,
};

})();
