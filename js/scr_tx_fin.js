/** Version 1.1 | 12 MAR 2026 | Siam Palette Group | Created 12 MAR 2026 */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_tx_fin.js
 * Transaction screens: Log, Sale, Bills, SD Bridge,
 * Return & Debit, Find, Bill Detail
 * ═══════════════════════════════════════════
 */

(() => {
  const esc = App.esc;
  const fm = App.formatMoney;
  const sb = App.statusBadge;

  // ══════════════════════════════════════════
  // MOCK DATA — Transaction lists
  // ══════════════════════════════════════════
  const TX_MOCK = {
    log: [
      { date: '12/03', ref: '1277', type: 'Pay run', desc: 'Wage Mar W2', brand: 'Mango Coco', contact: 'Watcharapol D.', amount: 609.00 },
      { date: '11/03', ref: '1284', type: 'Bill payment', desc: 'Mind.RBuakl', brand: 'Mango Coco', contact: 'Mind.RBuakl xx_M...', amount: 582.82 },
      { date: '11/03', ref: '1282', type: 'Bill payment', desc: 'Rental Mar 2026', brand: 'Mango Coco', contact: 'Dencal Pty Ltd', amount: 23558.32 },
      { date: '11/03', ref: 'FIN-0050', type: 'Bill', desc: 'Purchase; Dencal', brand: 'Mango Coco', contact: 'Dencal Pty Ltd', amount: 23558.32 },
      { date: '10/03', ref: 'FIN-0049', type: 'Bill', desc: 'Siam Pacific Food', brand: 'Flying Tigress', contact: 'Siam Pacific Food', amount: 86.44 },
    ],
    sales: [
      { date: '12/03', brand: 'Mango Coco', channel: 'Cash', amount: 2340.50, gst: 234.05, status: 'Received' },
      { date: '12/03', brand: 'Mango Coco', channel: 'UberEats', amount: 890.20, gst: 89.02, status: 'Received' },
      { date: '11/03', brand: 'Flying Tigress', channel: 'Card', amount: 1560.00, gst: 156.00, status: 'Received' },
      { date: '11/03', brand: 'Mango Coco', channel: 'Easi', amount: 340.00, gst: 34.00, status: 'Received' },
    ],
    bills: [
      { date: '10/03', bill: 'FIN-0050', supplier: 'Attakor Trading', inv: '', amount: 200.00, balance: 0, due: '10/03', file: false, status: 'Closed' },
      { date: '09/03', bill: 'FIN-0049', supplier: 'Siam Pacific Food', inv: 'INV00003255', amount: 86.44, balance: 86.44, due: '23/03', file: true, status: 'Open' },
      { date: '09/03', bill: 'FIN-0048', supplier: 'Siam Pacific Food', inv: 'INV00003237', amount: 654.16, balance: 654.16, due: '23/03', file: true, status: 'Open' },
      { date: '09/03', bill: 'FIN-0047', supplier: 'Siam Pacific Food', inv: 'INV00003237-CR', amount: -50.00, balance: -50.00, due: '23/03', file: true, status: 'Debit' },
      { date: '07/03', bill: 'FIN-0045', supplier: 'Pro Bros Providore', inv: 'INV1050836', amount: 128.10, balance: 128.10, due: '04/03', file: true, status: 'Overdue' },
    ],
    returns: [
      { date: '09/03', bill: 'FIN-0047', supplier: 'Siam Pacific Food', inv: 'INV00003237-CR', amount: -50.00, balance: -50.00 },
    ],
  };

  /** Date range helper — 30 days ago to today */
  function dateRange() {
    const t = new Date(), f = new Date(t);
    f.setDate(f.getDate() - 30);
    return { from: f.toISOString().split('T')[0], to: t.toISOString().split('T')[0] };
  }

  // ══════════════════════════════════════════
  // 1. TRANSACTION LOG
  // ══════════════════════════════════════════
  function renderTxLog() {
    const dr = dateRange();
    const rows = TX_MOCK.log.map(r => `
      <tr>
        <td>${esc(r.date)}</td>
        <td><a class="lk">${esc(r.ref)}</a></td>
        <td>${esc(r.type)}</td>
        <td>${esc(r.desc)}</td>
        <td>${esc(r.brand)}</td>
        <td>${esc(r.contact)}</td>
        <td style="text-align:right">${fm(r.amount)}</td>
      </tr>`).join('');

    return {
      tb: '<div class="tb"><div class="tb-t">Transaction Log</div></div>',
      ct: `
        <div class="card">
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px">
            <div><div class="fl-l">Type</div><select class="fl" style="width:100px"><option>All</option><option>Income</option><option>Expense</option><option>Asset Purchase</option><option>Transfer</option><option>Loan</option></select></div>
            <div><div class="fl-l">Brand</div><select class="fl" style="width:120px"><option>All</option><option>Mango Coco</option><option>Flying Tigress</option></select></div>
            <div><div class="fl-l">Status</div><select class="fl" style="width:80px"><option>All</option><option>Paid</option><option>Unpaid</option><option>Received</option></select></div>
            <div><div class="fl-l">Date from</div><input class="fl" type="date" value="${dr.from}" style="width:130px"></div>
            <div><div class="fl-l">Date to</div><input class="fl" type="date" value="${dr.to}" style="width:130px"></div>
            <div><div class="fl-l">Search</div><input class="fl" placeholder="" style="width:100px"></div>
            <div style="flex:1"></div>
            <button class="bg" style="color:var(--acc)">Reset</button>
          </div>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <table class="tbl">
            <thead><tr>
              <th>Date <span class="s">▼</span></th><th>Ref no</th><th>Type</th>
              <th>Description</th><th>Brand</th><th>Contact</th>
              <th style="text-align:right">Amount ($)</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="text-align:center;padding:10px">
            <a class="lk" style="padding:5px 14px;border:1px solid var(--bd);border-radius:var(--rd);display:inline-block;font-size:var(--fs-sm)">Load more</a>
          </div>
        </div>`,
    };
  }

  // ══════════════════════════════════════════
  // 2. SALES LIST
  // ══════════════════════════════════════════
  function renderTxSale() {
    const dr = dateRange();
    const total = TX_MOCK.sales.reduce((s, r) => s + r.amount, 0);
    const rows = TX_MOCK.sales.map(r => `
      <tr>
        <td>${esc(r.date)}</td>
        <td>${esc(r.brand)}</td>
        <td>${esc(r.channel)}</td>
        <td style="text-align:right;color:var(--g)">+${fm(r.amount)}</td>
        <td style="text-align:right">${fm(r.gst)}</td>
        <td>${sb(r.status)}</td>
      </tr>`).join('');

    return {
      tb: `<div class="tb"><div class="tb-t">Sales</div><button class="bs" onclick="App.go('cr_sale')">+ Record Sale</button></div>`,
      ct: `
        <div class="card">
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px">
            <div><div class="fl-l">Brand</div><select class="fl" style="width:120px"><option>All</option><option>Mango Coco</option><option>Flying Tigress</option></select></div>
            <div><div class="fl-l">Channel</div><select class="fl" style="width:100px"><option>All</option><option>Cash</option><option>Card</option><option>UberEats</option><option>Easi</option></select></div>
            <div><div class="fl-l">Date from</div><input class="fl" type="date" value="${dr.from}" style="width:130px"></div>
            <div><div class="fl-l">Date to</div><input class="fl" type="date" value="${dr.to}" style="width:130px"></div>
            <div style="flex:1"></div>
            <button class="bg" style="color:var(--acc)">Reset</button>
          </div>
          <div style="text-align:right;font-size:var(--fs-sm);color:var(--t2)">Total Revenue <b style="color:var(--g)">${fm(total)}</b></div>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <table class="tbl">
            <thead><tr>
              <th>Date <span class="s">▼</span></th><th>Brand</th><th>Channel</th>
              <th style="text-align:right">Amount ($)</th><th style="text-align:right">GST</th><th>Status</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`,
    };
  }

  // ══════════════════════════════════════════
  // 3. BILLS LIST
  // ══════════════════════════════════════════
  function renderTxBill() {
    const dr = dateRange();
    const totalAmt = TX_MOCK.bills.reduce((s, r) => s + Math.abs(r.amount), 0);
    const totalBal = TX_MOCK.bills.reduce((s, r) => s + r.balance, 0);
    const overdue = TX_MOCK.bills.filter(r => r.status === 'Overdue').reduce((s, r) => s + r.balance, 0);

    const rows = TX_MOCK.bills.map(r => {
      const isDebit = r.status === 'Debit';
      const dColor = isDebit ? 'color:var(--b)' : '';
      const dueColor = r.status === 'Overdue' ? 'color:var(--r)' : '';
      return `
      <tr onclick="App.go('tx_bill_detail')" style="cursor:pointer">
        <td>${esc(r.date)}</td>
        <td style="${dColor}"><a class="lk">${esc(r.bill)}</a></td>
        <td style="${dColor}">${esc(r.supplier)}</td>
        <td style="${dColor}">${esc(r.inv)}</td>
        <td style="text-align:right;${dColor}">${fm(r.amount)}</td>
        <td style="text-align:right;${dColor}">${fm(r.balance)}</td>
        <td style="${dueColor}">${esc(r.due)}</td>
        <td>${r.file ? '📄' : ''}</td>
        <td>${sb(r.status)}</td>
      </tr>`;
    }).join('');

    return {
      tb: `<div class="tb"><div class="tb-t">Bills</div><button class="btn bo">⊕ Record supplier payment</button><button class="btn bo" onclick="App.go('cr_import')">Import</button><button class="bs" onclick="App.go('cr_bill')">Create bill</button></div>`,
      ct: `
        <div class="card">
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px">
            <div><div class="fl-l">Status</div><select class="fl" style="width:75px"><option>All</option><option>Open</option><option>Overdue</option><option>Closed</option><option>Debit</option></select></div>
            <div><div class="fl-l">Supplier</div><select class="fl" style="width:140px"><option>All</option><option>Pro Bros Providore</option><option>Siam Pacific Food</option></select></div>
            <div><div class="fl-l">Brand</div><select class="fl" style="width:110px"><option>All</option><option>Mango Coco</option><option>Flying Tigress</option></select></div>
            <div><div class="fl-l">Issue from</div><input class="fl" type="date" value="${dr.from}" style="width:130px"></div>
            <div><div class="fl-l">Issue to</div><input class="fl" type="date" value="${dr.to}" style="width:130px"></div>
            <div><div class="fl-l">Search</div><input class="fl" placeholder="" style="width:100px"></div>
            <div style="flex:1"></div>
            <button class="bg" style="color:var(--acc)">Reset</button>
          </div>
          <div style="text-align:right;font-size:var(--fs-sm);color:var(--t2)">
            Total <b>${fm(totalAmt)}</b> · Balance due <b>${fm(totalBal)}</b> · <span style="color:var(--r);font-weight:600">Overdue ${fm(overdue)}</span>
          </div>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <table class="tbl">
            <thead><tr>
              <th class="on">Issue date <span class="s">▼</span></th><th>Bill no</th><th>Supplier</th>
              <th>Supplier inv no</th><th style="text-align:right">Amount ($)</th>
              <th style="text-align:right">Balance due</th><th>Due date</th><th>File</th><th>Status</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="text-align:center;padding:10px">
            <a class="lk" style="padding:5px 14px;border:1px solid var(--bd);border-radius:var(--rd);display:inline-block;font-size:var(--fs-sm)">Load more</a>
          </div>
        </div>`,
    };
  }

  // ══════════════════════════════════════════
  // 4. RETURN AND DEBIT
  // ══════════════════════════════════════════
  function renderTxReturn() {
    const totalAmt = TX_MOCK.returns.reduce((s, r) => s + r.amount, 0);
    const totalBal = TX_MOCK.returns.reduce((s, r) => s + r.balance, 0);

    const rows = TX_MOCK.returns.map(r => `
      <tr>
        <td>${esc(r.date)}</td>
        <td style="color:var(--b)"><a class="lk">${esc(r.bill)}</a></td>
        <td style="color:var(--b)">${esc(r.supplier)}</td>
        <td style="color:var(--b)">${esc(r.inv)}</td>
        <td style="text-align:right;color:var(--b)">${fm(r.amount)}</td>
        <td style="text-align:right;color:var(--b)">${fm(r.balance)}</td>
        <td><a class="lk" style="font-size:var(--fs-xs)">Record</a></td>
        <td><a class="lk" style="font-size:var(--fs-xs)">Apply</a></td>
      </tr>`).join('');

    return {
      tb: `<div class="tb"><div class="tb-t">Purchase Returns and Debits</div><button class="bs" onclick="App.go('cr_debit')">Create debit note</button></div>`,
      ct: `
        <div class="card">
          <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:6px">
            <div><div class="fl-l">Supplier</div><select class="fl" style="width:160px"><option>All</option><option>Akipan</option><option>Siam Pacific Food</option></select></div>
            <div><div class="fl-l">Search</div><input class="fl" placeholder="Search..." style="width:140px"></div>
            <div style="flex:1"></div>
            <button class="bg" style="color:var(--acc)">Reset</button>
          </div>
          <div style="text-align:right;font-size:var(--fs-sm);color:var(--t2)">
            Total amount: <b>${fm(totalAmt)}</b> · Total debit amount: <b>${fm(totalBal)}</b>
          </div>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <table class="tbl">
            <thead><tr>
              <th>Issue date <span class="s">▲</span></th><th>Bill number</th><th>Supplier</th>
              <th>Supplier invoice no</th><th style="text-align:right">Amount ($)</th>
              <th style="text-align:right">Balance due ($)</th><th>Record refund</th><th>Apply to purchase</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`,
    };
  }

  // ══════════════════════════════════════════
  // REGISTER ROUTES
  // ══════════════════════════════════════════
  App.registerRoutes({
    tx_log:    { render: renderTxLog },
    tx_sale:   { render: renderTxSale },
    tx_bill:   { render: renderTxBill },
    tx_return: { render: renderTxReturn },
  });

})();
