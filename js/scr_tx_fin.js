/** Version 1.5 | 14 MAR 2026 | Siam Palette Group | Created 12 MAR 2026 */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_tx_fin.js
 * Transaction screens: Log, Sales, Bills, Return,
 * Bill Detail, SD Bridge, Find Transactions
 * ═══════════════════════════════════════════
 *
 * CHANGED v1.4 → v1.5:
 * - Tx Log: MOCK → API.getTransactions({type:'all'}) + skeleton + onLoad
 * - Tx Sales: MOCK → API.getTransactions({type:'sale'}) + skeleton + onLoad
 * - Tx Return: MOCK → API.getTransactions({type:'return'}) + skeleton + onLoad
 * - Find Tx DC tab: MOCK → API.getDebitCredits() async load
 * - SD Bridge: MOCK → API.getSdPending() + dynamic render + onLoad
 * - Bills, Bill Detail: unchanged (already DB)
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
let _sortState = {};

/** Skeleton loading row for tables */
function _skeletonRow(cols) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:20px;color:var(--t3)"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</td></tr>`;
}

function _sortTable(tid, key) {
  const table = document.getElementById(tid);
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const ths = Array.from(table.querySelectorAll('th'));
  let idx = -1;
  ths.forEach((th, i) => { if (th.getAttribute('data-key') === key) idx = i; });
  if (idx < 0) return;
  const sk = tid + '_' + key;
  _sortState[sk] = !_sortState[sk];
  const asc = _sortState[sk];
  rows.sort((a, b) => {
    const aV = (a.cells[idx]?.textContent || '').trim().replace(/[$,+]/g, '');
    const bV = (b.cells[idx]?.textContent || '').trim().replace(/[$,+]/g, '');
    const aN = parseFloat(aV), bN = parseFloat(bV);
    if (!isNaN(aN) && !isNaN(bN)) return asc ? aN - bN : bN - aN;
    return asc ? aV.localeCompare(bV) : bV.localeCompare(aV);
  });
  rows.forEach(r => tbody.appendChild(r));
}

function sth(label, key, tid) {
  return `<th data-key="${key}" style="cursor:pointer" onclick="ScrTx._sortTable('${tid}','${key}')">${esc(label)} <span class="s">⇅</span></th>`;
}
function sthR(label, key, tid) {
  return `<th data-key="${key}" style="text-align:right;cursor:pointer" onclick="ScrTx._sortTable('${tid}','${key}')">${esc(label)} <span class="s">⇅</span></th>`;
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

  // If no detail in memory, show placeholder
  if (!detail || !detail.bill) {
    return {
      tb: `<div class="tb"><button class="bg" onclick="App.go('tx_bill')">← Bills</button><div class="tb-t">Bill Detail</div></div>`,
      ct: '<div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading bill detail...</div>',
    };
  }

  const b = detail.bill;
  const li = detail.lineItems || [];
  const alloc = detail.allocation || 'self';

  // Build line items table
  const liRows = li.length > 0 ? li.map(l =>
    `<tr><td>${esc(l.desc || l.description || '')}</td><td>${esc(l.category || l.category_display || '')}</td><td style="text-align:right">${fm(l.amount)}</td><td style="text-align:right">${fm(l.gst)}</td><td>${esc(l.tax_code)}</td></tr>`
  ).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--t3);padding:12px">No line items</td></tr>';

  const subtotal = li.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const tax = li.reduce((s, l) => s + (Number(l.gst) || 0), 0);
  const total = subtotal + tax;
  const isPaid = b.status === 'Closed';

  return {
    tb: `<div class="tb"><button class="bg" onclick="App.go('tx_bill')">← Bills</button><div class="tb-t">Bill Detail — ${esc(b.bill_no)}</div></div>`,
    ct: `<div style="max-width:1060px;margin:0 auto">
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div>
            <div style="font-size:var(--fs-h1);font-weight:700">${esc(b.bill_no)}</div>
            <div style="font-size:var(--fs-sm);color:var(--t3)">${esc(alloc)} allocation</div>
          </div>
          <div>${sb(b.status)}</div>
        </div>
        <div class="fr">
          <div class="fg"><label class="lb">Supplier</label><div style="font-weight:600">${esc(b.supplier_name)}</div></div>
          <div class="fg"><label class="lb">Bill Number</label><div>${esc(b.bill_no)}</div></div>
        </div>
        <div class="fr">
          <div class="fg"><label class="lb">Invoice No</label><div>${esc(b.inv_no || '—')}</div></div>
          <div class="fg"><label class="lb">Brand</label><div>${esc(b.brand || '—')}</div></div>
        </div>
        <div class="fr">
          <div class="fg"><label class="lb">Issue Date</label><div>${_fmtDate(b.date)}</div></div>
          <div class="fg"><label class="lb">Due Date</label><div>${_fmtDate(b.due_date) || '—'}</div></div>
        </div>
        ${b.notes ? `<div class="fg"><label class="lb">Notes</label><div style="color:var(--t2)">${esc(b.notes)}</div></div>` : ''}
      </div>

      <div class="card" style="padding:0;margin-bottom:12px">
        <table class="tbl">
          <thead><tr><th>Description</th><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">GST</th><th>Tax code</th></tr></thead>
          <tbody>${liRows}</tbody>
        </table>
      </div>

      <div class="card">
        <div style="text-align:right;margin:8px 0">
          <div>Subtotal <b>${fm(subtotal)}</b></div>
          <div style="color:var(--t3)">Tax ${fm(tax)}</div>
          <div style="font-weight:700;font-size:14px">Total ${fm(total)}</div>
          <div style="font-weight:700;font-size:14px;color:${isPaid ? 'var(--g)' : 'var(--r)'}">${isPaid ? 'Paid in full' : 'Balance due ' + fm(b.balance)}</div>
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
// 6. SD BRIDGE — still MOCK (same as v1.3.3)
// ═══════════════════════════════════════
function renderTxSdBridge(){return{tb:`<div class="tb"><div class="tb-t">SD Bridge</div><span style="font-size:var(--fs-xs);color:var(--t3)">Sale Daily → Finance sync</span><div style="flex:1"></div><select class="fl" style="width:140px"><option>Mango Coco</option><option>Flying Tigress</option><option>All Stores</option></select><button class="btn bo">Settings</button></div>`,
ct:`<div style="max-width:1100px;margin:0 auto">
<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:12px;flex-wrap:wrap">
<div style="display:flex;gap:3px"><button class="btn bo" style="padding:6px 16px;font-size:12px;font-weight:600;background:var(--t1);color:#fff;border-color:var(--t1)">All (4)</button><button class="btn bo" style="padding:6px 16px;font-size:12px">Pending (2)</button><button class="btn bo" style="padding:6px 16px;font-size:12px">Done (2)</button></div>
<div style="flex:1"></div>
<div><div class="fl-l">Month</div><input class="fl" type="month" value="2026-03" style="width:150px"></div>
</div>
<div class="kpi"><div class="kpi-c" style="background:#fff"><div class="kpi-v" style="color:var(--g)">$15,680</div><div class="kpi-l">Total Revenue</div></div><div class="kpi-c" style="background:#fff"><div class="kpi-v" style="color:var(--r)">$4,280</div><div class="kpi-l">Total Expenses</div></div><div class="kpi-c" style="background:#fff"><div class="kpi-v">8</div><div class="kpi-l">Pending items</div></div><div class="kpi-c" style="background:#fff"><div class="kpi-v" style="color:var(--g)">12</div><div class="kpi-l">Synced today</div></div></div>

<div style="border:1px solid var(--bd);border-radius:10px;margin-bottom:12px;overflow:hidden;border-left:3px solid var(--o)">
<div style="display:flex;align-items:center;padding:12px 16px;gap:10px;cursor:pointer;background:#fff">
<span style="font-size:12px;color:var(--t3)">▸</span>
<div style="font-size:13px;font-weight:700">13 Mar</div>
<div style="font-size:11px;color:var(--t2);font-weight:600;background:var(--bg3);padding:2px 8px;border-radius:4px">Mango Coco</div>
<div style="display:flex;align-items:center;gap:6px;margin-left:12px"><div style="width:80px;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="width:40%;height:100%;background:var(--o);border-radius:3px"></div></div><span style="font-size:10px;color:var(--o);font-weight:600">2/5</span></div>
<div style="display:flex;gap:8px;margin-left:auto"><span style="font-size:10px;padding:2px 8px;border-radius:4px;background:var(--gbg);color:var(--g)">💰 $5,230</span><span style="font-size:10px;padding:2px 8px;border-radius:4px;background:var(--rbg);color:var(--r)">📦 $1,630</span><span style="font-size:10px;padding:2px 8px;border-radius:4px;background:var(--rbg);color:var(--r);font-weight:600">⚠ 1 issue</span></div>
</div>
<div style="border-top:1px solid var(--bd2)">
<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:var(--rbg);border-bottom:1px solid rgba(220,38,38,.1);font-size:11px;color:var(--r)"><span>⚠</span><span style="flex:1">UberEats amount mismatch: SD $890 vs Bank $870 (diff $20)</span><button style="padding:4px 12px;font-size:11px;font-weight:600;border:1px solid var(--r);border-radius:var(--rd);background:#fff;color:var(--r);cursor:pointer">Fix</button></div>
<div style="display:flex;align-items:center;padding:8px 16px;gap:10px;border-bottom:1px solid var(--bd2);font-size:12px;background:rgba(217,119,6,.03)"><input type="checkbox" style="accent-color:var(--acc)"><span style="font-size:15px;width:22px;text-align:center">💵</span><div style="flex:1"><div style="font-weight:500">In-store Cash</div><div style="font-size:10px;color:var(--t3)">POS closing 12 Mar</div></div><div style="font-weight:700;min-width:80px;text-align:right;color:var(--g)">+$2,340.50</div><div style="min-width:70px;text-align:center"><span class="sts sts-p">Pending</span></div><div style="min-width:80px;text-align:right"><a class="lk" style="font-size:11px">Review</a></div></div>
<div style="display:flex;align-items:center;padding:8px 16px;gap:10px;border-bottom:1px solid var(--bd2);font-size:12px;background:rgba(217,119,6,.03)"><input type="checkbox" style="accent-color:var(--acc)"><span style="font-size:15px;width:22px;text-align:center">💳</span><div style="flex:1"><div style="font-weight:500">Card (Eftpos)</div><div style="font-size:10px;color:var(--t3)">Terminal batch</div></div><div style="font-weight:700;min-width:80px;text-align:right;color:var(--g)">+$1,560.00</div><div style="min-width:70px;text-align:center"><span class="sts sts-p">Pending</span></div><div style="min-width:80px;text-align:right"><a class="lk" style="font-size:11px">Review</a></div></div>
<div style="display:flex;align-items:center;padding:8px 16px;gap:10px;border-bottom:1px solid var(--bd2);font-size:12px;background:rgba(220,38,38,.04)"><input type="checkbox" style="accent-color:var(--acc)"><span style="font-size:15px;width:22px;text-align:center">🛵</span><div style="flex:1"><div style="font-weight:500">UberEats</div><div style="font-size:10px;color:var(--r)">⚠ Amount mismatch</div></div><div style="font-weight:700;min-width:80px;text-align:right;color:var(--g)">+$890.20</div><div style="min-width:70px;text-align:center"><span class="sts sts-r">Issue</span></div><div style="min-width:80px;text-align:right"><a class="lk" style="font-size:11px;color:var(--r)">Fix</a></div></div>
<div style="display:flex;align-items:center;padding:8px 16px;gap:10px;border-bottom:1px solid var(--bd2);font-size:12px;opacity:.7"><input type="checkbox" disabled checked style="accent-color:var(--acc)"><span style="font-size:15px;width:22px;text-align:center">📦</span><div style="flex:1"><div style="font-weight:500">Pro Bros — COGs</div></div><div style="font-weight:700;min-width:80px;text-align:right;color:var(--r)">-$1,200.00</div><div style="min-width:70px;text-align:center"><span class="sts sts-c">✓</span></div><div style="min-width:80px;text-align:right"></div></div>
<div style="display:flex;align-items:center;padding:8px 16px;gap:10px;font-size:12px;opacity:.7"><input type="checkbox" disabled checked style="accent-color:var(--acc)"><span style="font-size:15px;width:22px;text-align:center">📦</span><div style="flex:1"><div style="font-weight:500">Woolworths — COGs</div></div><div style="font-weight:700;min-width:80px;text-align:right;color:var(--r)">-$430.00</div><div style="min-width:70px;text-align:center"><span class="sts sts-c">✓</span></div><div style="min-width:80px;text-align:right"></div></div>
<div style="display:flex;align-items:center;padding:10px 16px;background:var(--bg2);border-top:1px solid var(--bd2);gap:8px"><div style="flex:1;font-size:10px;color:var(--t3)">2 of 5 synced</div><button class="btn bo" style="padding:6px 16px;font-size:12px">Auto-sync revenue</button><button class="bs" style="padding:6px 16px;font-size:12px">Sync selected</button></div>
</div></div>

<div style="border:1px solid var(--bd);border-radius:10px;margin-bottom:12px;overflow:hidden;border-left:3px solid var(--g)">
<div style="display:flex;align-items:center;padding:12px 16px;gap:10px;cursor:pointer;background:#fff">
<span style="font-size:12px;color:var(--t3)">▸</span>
<div style="font-size:13px;font-weight:700">12 Mar</div>
<div style="font-size:11px;color:var(--t2);font-weight:600;background:var(--bg3);padding:2px 8px;border-radius:4px">Mango Coco</div>
<div style="display:flex;align-items:center;gap:6px;margin-left:12px"><div style="width:80px;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="width:100%;height:100%;background:var(--g);border-radius:3px"></div></div><span style="font-size:10px;color:var(--g);font-weight:600">5/5 ✓</span></div>
<div style="display:flex;gap:8px;margin-left:auto"><span style="font-size:10px;padding:2px 8px;border-radius:4px;background:var(--gbg);color:var(--g)">💰 $4,650</span><span style="font-size:10px;padding:2px 8px;border-radius:4px;background:var(--rbg);color:var(--r)">📦 $2,000</span><span class="sts sts-c" style="font-size:10px">All synced</span></div>
</div></div>

<div style="border:1px solid var(--bd);border-radius:10px;margin-bottom:12px;overflow:hidden;border-left:3px solid var(--g)">
<div style="display:flex;align-items:center;padding:12px 16px;gap:10px;cursor:pointer;background:#fff">
<span style="font-size:12px;color:var(--t3)">▸</span>
<div style="font-size:13px;font-weight:700">11 Mar</div>
<div style="font-size:11px;color:var(--t2);font-weight:600;background:var(--bg3);padding:2px 8px;border-radius:4px">Flying Tigress</div>
<div style="display:flex;align-items:center;gap:6px;margin-left:12px"><div style="width:80px;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="width:100%;height:100%;background:var(--g);border-radius:3px"></div></div><span style="font-size:10px;color:var(--g);font-weight:600">4/4 ✓</span></div>
<div style="display:flex;gap:8px;margin-left:auto"><span style="font-size:10px;padding:2px 8px;border-radius:4px;background:var(--gbg);color:var(--g)">💰 $2,800</span><span style="font-size:10px;padding:2px 8px;border-radius:4px;background:var(--rbg);color:var(--r)">📦 $650</span><span class="sts sts-c" style="font-size:10px">All synced</span></div>
</div></div>

</div>`};}

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
    return `<div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:8px">Debit notes paired with linked invoices</div><table class="tbl"><thead><tr><th>Date</th><th>Debit Note</th><th>Linked Invoice</th><th>Supplier</th><th style="text-align:right">Debit ($)</th><th style="text-align:right">Invoice ($)</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
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
    return `<div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:8px">All transactions</div><table class="tbl"><thead><tr><th>Date</th><th>Reference</th><th>Type</th><th>Description</th><th>Contact</th><th style="text-align:right">Amount ($)</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
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
  tx_sd:          { render: renderTxSdBridge },
  tx_find:        { render: renderTxFind, onLoad: _loadFind },
});

// ═══════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════
window.ScrTx = {
  _switchBdView,
  _showDebitDetail,
  _switchFindTab,
  _sortTable,
  _openBillDetail,
  _loadMoreBills,
};

})();
