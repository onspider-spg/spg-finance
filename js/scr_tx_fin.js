/** Version 1.1.1 | 12 MAR 2026 | Siam Palette Group | Created 12 MAR 2026 */
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
  // 5. BILL DETAIL — 3 allocation views
  // ══════════════════════════════════════════
  let _bdView = 'self';

  function renderTxBillDetail() {
    _bdView = 'self';
    return {
      tb: `<div class="tb"><button class="bg" onclick="App.go('tx_bill')">← Bills</button><div class="tb-t">Bill Detail</div><div style="font-size:var(--fs-xs);color:var(--t3);margin-left:8px">Allocation ตอน Create กำหนดว่า Bill Detail จะแสดงแบบไหน</div></div>`,
      ct: _buildBillDetailContent(),
    };
  }

  function _buildBillDetailContent() {
    return `<div style="max-width:1060px;margin:0 auto">
      <div style="background:var(--acc2);border:1px solid rgba(124,58,237,.15);border-radius:var(--rd);padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <span style="font-size:14px">ℹ</span>
        <div>
          <div style="font-size:var(--fs-sm);font-weight:600;color:var(--acc)">Bill Detail แสดงต่างกันขึ้นอยู่กับ Allocation ที่เลือกตอน Create Bill</div>
          <div style="font-size:var(--fs-xs);color:var(--t2)">กดดูตัวอย่างแต่ละแบบ — ระบบจริงจะแสดงตาม allocation ที่บันทึกไว้โดยอัตโนมัติ</div>
        </div>
      </div>
      <div style="display:flex;gap:4px;margin-bottom:12px" id="bd_tabs">
        <button class="btn bo" style="padding:6px 14px;font-size:var(--fs-sm);background:var(--t1);color:#fff;border-color:var(--t1)" onclick="ScrTx._switchBdView('self',this)">Self (FIN-0048)</button>
        <button class="btn bo" style="padding:6px 14px;font-size:var(--fs-sm)" onclick="ScrTx._switchBdView('ob',this)">On Behalf (FIN-0050)</button>
        <button class="btn bo" style="padding:6px 14px;font-size:var(--fs-sm)" onclick="ScrTx._switchBdView('split',this)">Split (FIN-0052)</button>
      </div>
      <div id="bd_content">${_bdSelfView()}</div>
    </div>`;
  }

  function _switchBdView(view, btnEl) {
    _bdView = view;
    // Update tab buttons
    document.querySelectorAll('#bd_tabs button').forEach(b => {
      b.style.background = '#fff'; b.style.color = 'var(--t2)'; b.style.borderColor = 'var(--bd)';
    });
    if (btnEl) { btnEl.style.background = 'var(--t1)'; btnEl.style.color = '#fff'; btnEl.style.borderColor = 'var(--t1)'; }
    // Update content
    const ct = document.getElementById('bd_content');
    if (!ct) return;
    if (view === 'self') ct.innerHTML = _bdSelfView();
    else if (view === 'ob') ct.innerHTML = _bdOnBehalfView();
    else ct.innerHTML = _bdSplitView();
  }

  // ── Shared bill detail components ──
  function _bdPaymentSection(status) {
    const isPaid = status === 'paid';
    return `<div style="margin-top:10px;border:1px solid var(--bd);border-radius:var(--rd);overflow:hidden">
      <div style="background:#333;color:#fff;padding:6px 10px;font-size:var(--fs-sm);font-weight:600;display:flex;justify-content:space-between">Payment <span style="font-size:9px;padding:1px 8px;border-radius:8px;background:${isPaid ? 'var(--gbg)' : 'var(--obg)'};color:${isPaid ? 'var(--g)' : 'var(--o)'}">${isPaid ? 'Paid' : 'Unpaid'}</span></div>
      <div style="padding:8px;font-size:var(--fs-sm);text-align:center;color:var(--t3)">${isPaid ? 'Paid in full on 10/03/2026' : 'No payment recorded · <a class="lk" style="font-size:var(--fs-sm)">Record Payment →</a>'}</div>
    </div>`;
  }

  function _bdAttachments(files) {
    const fileList = files.map(f => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;padding:4px 8px;background:var(--bg3);border-radius:4px;font-size:var(--fs-sm)"><span>📄</span><span style="flex:1">${esc(f)}</span><a class="lk" style="font-size:var(--fs-xs)">View</a><a class="lk" style="font-size:var(--fs-xs);color:var(--r)">Remove</a></div>`).join('');
    return `<div style="margin-top:8px;border:1.5px dashed #ddd;border-radius:8px;padding:10px">
      <div style="background:#333;color:#fff;padding:5px 10px;border-radius:5px 5px 0 0;font-size:var(--fs-sm);font-weight:600">Attachments (${files.length})</div>
      <div style="border:1.5px dashed #ddd;border-top:none;border-radius:0 0 5px 5px;padding:10px">${fileList}<div style="text-align:center;font-size:var(--fs-sm);color:var(--t3)">Drag files here, or <a style="color:var(--acc);font-weight:600;cursor:pointer">browse</a></div></div>
    </div>`;
  }

  function _bdSourceDoc(linked) {
    if (linked) {
      return `<div class="card" style="margin:0;min-height:300px;background:var(--bg3)">
        <div style="display:flex;justify-content:space-between;margin-bottom:10px"><b style="font-size:var(--fs-sm)">Source document</b><div style="display:flex;gap:8px"><a class="lk" style="font-size:var(--fs-xs)">Close split view</a><a class="lk" style="font-size:var(--fs-xs);color:var(--r)">Unlink</a></div></div>
        <div style="background:#fff;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.1);padding:24px 20px;min-height:320px">
          <div style="border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:10px;display:flex;justify-content:space-between">
            <div><div style="font-size:16px;font-weight:800">PRO BROS</div><div style="font-size:8px;color:var(--t3)">PROVIDORE PTY LTD</div></div>
            <div style="text-align:right"><div style="font-size:14px;font-weight:700">TAX INVOICE</div><div style="font-size:8px;color:var(--t3)">INV1050790</div></div>
          </div>
          <div style="font-size:8px;color:var(--t2);margin-bottom:8px">To: Mango Coco Pty Ltd · Date: 01/03/2026 · Due: 15/03/2026</div>
          <table style="width:100%;border-collapse:collapse;font-size:8px"><tbody>
            <tr style="border-bottom:1px solid var(--bd2)"><td>Chicken breast 5kg ×4</td><td style="text-align:right">$180.00</td></tr>
            <tr style="border-bottom:1px solid var(--bd2)"><td>Salmon fillet 2kg ×3</td><td style="text-align:right">$205.50</td></tr>
            <tr style="border-bottom:1px solid var(--bd2)"><td>Mixed vegetables ×6</td><td style="text-align:right">$192.00</td></tr>
            <tr style="border-bottom:1px solid var(--bd2)"><td>Milk 2L×12 ×3</td><td style="text-align:right">$140.55</td></tr>
            <tr><td>Rice 10kg ×2 + Oil 5L ×2</td><td style="text-align:right">$172.50</td></tr>
          </tbody></table>
          <div style="text-align:right;font-size:10px;font-weight:700;margin-top:6px;border-top:1px solid #333;padding-top:4px">TOTAL: $890.55</div>
        </div>
        <div style="display:flex;gap:6px;justify-content:center;margin-top:8px">
          <button class="btn bo" style="font-size:var(--fs-sm);padding:3px 6px">🔍 Zoom</button>
          <button class="btn bo" style="font-size:var(--fs-sm);padding:3px 6px">⬇ Download</button>
          <button class="btn bo" style="font-size:var(--fs-sm);padding:3px 6px">🖨 Print</button>
        </div>
      </div>`;
    }
    return `<div class="card" style="margin:0;min-height:300px;background:var(--bg3)">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px"><b style="font-size:var(--fs-sm)">Source document</b><a class="lk" style="font-size:var(--fs-xs)">Close split view</a></div>
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:280px;text-align:center">
        <div style="width:60px;height:60px;border-radius:50%;background:var(--bd2);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--t4);margin-bottom:10px">📄</div>
        <div style="font-size:var(--fs-body);font-weight:600;color:var(--t3);margin-bottom:4px">No document linked</div>
        <div style="font-size:var(--fs-xs);color:var(--t4);margin-bottom:12px">Upload or link an existing document from Uploads</div>
        <div style="display:flex;gap:6px"><button class="bs" style="font-size:var(--fs-sm);padding:6px 14px">Upload new</button><button class="btn bo" style="font-size:var(--fs-sm);padding:6px 14px">Link from Uploads</button></div>
      </div>
    </div>`;
  }

  // ── View 1: Self ──
  function _bdSelfView() {
    return `<div style="display:grid;grid-template-columns:1.1fr 1fr;gap:16px">
      ${_bdSourceDoc(true)}
      <div class="card" style="margin:0">
        <div style="margin-bottom:8px"><span style="font-size:var(--fs-xs);font-weight:600;padding:2px 8px;border-radius:4px;background:var(--gbg);color:var(--g)">● Self — Mango Coco</span></div>
        <div class="fg"><label class="lb">Transaction Type</label><div style="font-size:var(--fs-body);font-weight:600">Expense / Bill</div></div>
        <div class="fr"><div class="fg"><label class="lb">Supplier</label><div style="font-size:var(--fs-body);font-weight:600">Pro Bros Providore</div></div><div class="fg"><label class="lb">Bill Number</label><div style="font-size:var(--fs-body)">FIN-0048</div></div></div>
        <div class="fr"><div class="fg"><label class="lb">Supplier Inv No</label><div style="font-size:var(--fs-body)">INV1050790</div></div><div class="fg"><label class="lb">Issue Date</label><div style="font-size:var(--fs-body)">01/03/2026</div></div></div>
        <div class="fr"><div class="fg"><label class="lb">Due Date</label><div style="font-size:var(--fs-body)">15/03/2026</div></div><div class="fg"><label class="lb">Accrual Month</label><div style="font-size:var(--fs-body)">Mar 2026</div></div></div>
        <div style="margin-top:8px;border:1px solid var(--bd);border-radius:var(--rd);overflow:hidden"><table class="tbl"><thead><tr><th>Description</th><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">GST</th><th>Tax</th></tr></thead><tbody>
          <tr><td>Food supplies</td><td style="font-size:var(--fs-sm)">27002 Purchases-GST Free</td><td style="text-align:right">$750.00</td><td style="text-align:right">$0.00</td><td>FRE</td></tr>
          <tr><td>Beverage supplies</td><td style="font-size:var(--fs-sm)">27002 Purchases-GST Free</td><td style="text-align:right">$140.55</td><td style="text-align:right">$0.00</td><td>FRE</td></tr>
        </tbody></table></div>
        <div style="text-align:right;font-size:var(--fs-body);margin:8px 0"><div style="padding:2px 0">Subtotal <b>$890.55</b></div><div style="padding:2px 0;color:var(--t3)">Tax $0.00</div><div style="padding:2px 0;font-weight:700;font-size:14px">Total $890.55</div><div style="padding:2px 0">Amount paid <b>$0.00</b></div><div style="padding:3px 0;font-weight:700;font-size:14px;color:var(--r)">Balance due $890.55</div></div>
        <div style="background:var(--bg2);border-radius:var(--rd);padding:8px;font-size:var(--fs-sm)"><div style="font-weight:600;margin-bottom:3px">P&L Impact</div><div style="display:flex;justify-content:space-between"><span>Mango Coco → COGs → Food</span><b>$890.55</b></div></div>
        ${_bdPaymentSection('unpaid')}
        ${_bdAttachments(['inv_probros_mar.pdf · 0.45 MB'])}
      </div>
    </div>`;
  }

  // ── View 2: On Behalf ──
  function _bdOnBehalfView() {
    return `<div style="display:grid;grid-template-columns:1.1fr 1fr;gap:16px">
      ${_bdSourceDoc(true)}
      <div class="card" style="margin:0">
        <div style="margin-bottom:8px"><span style="font-size:var(--fs-xs);font-weight:600;padding:2px 8px;border-radius:4px;background:var(--obg);color:var(--o)">● On Behalf — Mango pays for Flying</span></div>
        <div class="fg"><label class="lb">Transaction Type</label><div style="font-size:var(--fs-body);font-weight:600">Expense / Bill</div></div>
        <div class="fr"><div class="fg"><label class="lb">Supplier</label><div style="font-size:var(--fs-body);font-weight:600">Attakor Trading</div></div><div class="fg"><label class="lb">Bill Number</label><div style="font-size:var(--fs-body)">FIN-0050</div></div></div>
        <div class="fr"><div class="fg"><label class="lb">Supplier Inv No</label><div style="font-size:var(--fs-body)">ATK-2026-088</div></div><div class="fg"><label class="lb">Issue Date</label><div style="font-size:var(--fs-body)">10/03/2026</div></div></div>
        <div style="margin-top:8px;border:1px solid var(--bd);border-radius:var(--rd);overflow:hidden"><table class="tbl"><thead><tr><th style="color:var(--acc)">Cost Owner</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th><th>Tax</th></tr></thead><tbody>
          <tr style="border-left:3px solid var(--o)"><td style="font-weight:600;font-size:var(--fs-sm)">Flying Tigress</td><td>Kitchen equipment</td><td style="font-size:var(--fs-sm)">46000 Equipment</td><td style="text-align:right">$200.00</td><td>GST</td></tr>
        </tbody></table></div>
        <div style="text-align:right;font-size:var(--fs-body);margin:8px 0"><div style="padding:2px 0">Subtotal <b>$200.00</b></div><div style="padding:2px 0;color:var(--t3)">Tax $20.00</div><div style="padding:2px 0;font-weight:700;font-size:14px">Total $220.00</div></div>
        <div style="background:var(--bg2);border-radius:var(--rd);padding:8px;font-size:var(--fs-sm);margin-bottom:4px"><div style="font-weight:600;margin-bottom:3px">P&L Impact</div><div style="display:flex;justify-content:space-between"><span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--o);margin-right:3px"></span>Flying → Equipment</span><b>$200</b></div></div>
        <div style="background:var(--bbg);border-radius:var(--rd);padding:8px;font-size:var(--fs-sm)"><div style="font-weight:600;margin-bottom:3px;color:var(--b)">Intercompany Loan (auto)</div><div style="display:flex;justify-content:space-between"><span>Flying owes Mango</span><b>$220</b></div></div>
        ${_bdPaymentSection('paid')}
        ${_bdAttachments(['atk_invoice_088.pdf · 0.32 MB'])}
      </div>
    </div>`;
  }

  // ── View 3: Split ──
  function _bdSplitView() {
    return `<div style="display:grid;grid-template-columns:1.1fr 1fr;gap:16px">
      ${_bdSourceDoc(false)}
      <div class="card" style="margin:0">
        <div style="margin-bottom:8px;padding:8px 10px;background:var(--acc2);border:1px solid rgba(124,58,237,.15);border-radius:var(--rd)">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="font-size:var(--fs-xs);font-weight:600;padding:2px 8px;border-radius:4px;background:var(--acc);color:#fff">Split</span><span style="font-size:var(--fs-sm);font-weight:600">ค่าไฟ office แบ่ง 3 brands</span></div>
          <div style="display:flex;gap:6px;font-size:var(--fs-xs)">
            <div style="flex:1;padding:3px 6px;background:#fff;border-radius:4px;text-align:center"><div style="font-weight:700">Mango</div><div style="color:var(--acc);font-weight:600">$550 (50%)</div></div>
            <div style="flex:1;padding:3px 6px;background:#fff;border-radius:4px;text-align:center"><div style="font-weight:700">Flying</div><div style="color:var(--acc);font-weight:600">$330 (30%)</div></div>
            <div style="flex:1;padding:3px 6px;background:#fff;border-radius:4px;text-align:center"><div style="font-weight:700">Issho</div><div style="color:var(--acc);font-weight:600">$220 (20%)</div></div>
          </div>
        </div>
        <div class="fg"><label class="lb">Transaction Type</label><div style="font-size:var(--fs-body);font-weight:600">Expense / Bill</div></div>
        <div class="fr"><div class="fg"><label class="lb">Supplier</label><div style="font-size:var(--fs-body);font-weight:600">AGL Energy</div></div><div class="fg"><label class="lb">Bill Number</label><div style="font-size:var(--fs-body)">FIN-0052</div></div></div>
        <div class="fr"><div class="fg"><label class="lb">Supplier Inv No</label><div style="font-size:var(--fs-body)">AGL-MAR-2026</div></div><div class="fg"><label class="lb">Issue Date</label><div style="font-size:var(--fs-body)">10/03/2026</div></div></div>
        <div style="margin-top:8px;border:1px solid var(--bd);border-radius:var(--rd);overflow:hidden"><table class="tbl"><thead><tr><th style="color:var(--acc)">Cost Owner</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th><th>Tax</th></tr></thead><tbody>
          <tr style="border-left:3px solid var(--g)"><td style="font-weight:600;font-size:var(--fs-sm)">Mango Coco</td><td>Electricity 50%</td><td style="font-size:var(--fs-sm)">43000 Utilities</td><td style="text-align:right">$550.00</td><td>GST</td></tr>
          <tr style="border-left:3px solid var(--o)"><td style="font-weight:600;font-size:var(--fs-sm)">Flying Tigress</td><td>Electricity 30%</td><td style="font-size:var(--fs-sm)">43000 Utilities</td><td style="text-align:right">$330.00</td><td>GST</td></tr>
          <tr style="border-left:3px solid var(--b)"><td style="font-weight:600;font-size:var(--fs-sm)">Issho Cafe</td><td>Electricity 20%</td><td style="font-size:var(--fs-sm)">43000 Utilities</td><td style="text-align:right">$220.00</td><td>GST</td></tr>
        </tbody></table></div>
        <div style="text-align:right;font-size:var(--fs-body);margin:8px 0"><div style="padding:2px 0">Subtotal <b>$1,000.00</b></div><div style="padding:2px 0;color:var(--t3)">Tax $100.00</div><div style="padding:2px 0;font-weight:700;font-size:14px">Total $1,100.00</div><div style="padding:2px 0">Amount paid <b>$0.00</b></div><div style="padding:3px 0;font-weight:700;font-size:14px;color:var(--r)">Balance due $1,100.00</div></div>
        <div style="background:var(--bg2);border-radius:var(--rd);padding:8px;font-size:var(--fs-sm);margin-bottom:4px"><div style="font-weight:600;margin-bottom:3px">P&L Impact (by brand)</div>
          <div style="display:flex;justify-content:space-between;padding:1px 0"><span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--g);margin-right:3px"></span>Mango → Utilities</span><b>$550</b></div>
          <div style="display:flex;justify-content:space-between;padding:1px 0"><span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--o);margin-right:3px"></span>Flying → Utilities</span><b>$330</b></div>
          <div style="display:flex;justify-content:space-between;padding:1px 0"><span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--b);margin-right:3px"></span>Issho → Utilities</span><b>$220</b></div>
        </div>
        <div style="background:var(--bbg);border-radius:var(--rd);padding:8px;font-size:var(--fs-sm);margin-bottom:8px"><div style="font-weight:600;margin-bottom:3px;color:var(--b)">Intercompany Loan (auto)</div><div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:3px">Mango จ่าย $1,100 — brands อื่นติดหนี้:</div>
          <div style="display:flex;justify-content:space-between;padding:1px 0"><span>Flying owes Mango</span><b>$330</b></div>
          <div style="display:flex;justify-content:space-between;padding:1px 0"><span>Issho owes Mango</span><b>$220</b></div>
        </div>
        ${_bdPaymentSection('unpaid')}
        ${_bdAttachments(['agl_mar2026.pdf · 0.52 MB', 'split_approval.pdf · 0.18 MB'])}
      </div>
    </div>`;
  }

  // ══════════════════════════════════════════
  // 6. SD BRIDGE
  // ══════════════════════════════════════════
  function renderTxSdBridge() {
    return {
      tb: '<div class="tb"><div class="tb-t">SD Bridge</div></div>',
      ct: `
        <div class="card" style="max-width:1000px;margin:0 auto">
          <div class="tabs">
            <div class="tab a">Revenue Sync</div>
            <div class="tab">Expense Sync</div>
            <div class="tab">Cash Collection</div>
            <div class="tab">Synced History</div>
          </div>
          <div class="kpi">
            <div class="kpi-c"><div class="kpi-v" style="color:var(--g)">${fm(12450)}</div><div class="kpi-l">SD Revenue (today)</div></div>
            <div class="kpi-c"><div class="kpi-v" style="color:var(--r)">${fm(3280)}</div><div class="kpi-l">SD Expenses (today)</div></div>
            <div class="kpi-c"><div class="kpi-v">5</div><div class="kpi-l">Pending sync</div></div>
          </div>
          <table class="tbl">
            <thead><tr><th>Date</th><th>Store</th><th>Channel</th><th style="text-align:right">Revenue</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>12/03</td><td>Mango Coco Mac</td><td>In-store</td><td style="text-align:right">2,340.50</td><td>${sb('pending')}</td></tr>
              <tr><td>12/03</td><td>Mango Coco Mac</td><td>UberEats</td><td style="text-align:right">890.20</td><td>${sb('pending')}</td></tr>
              <tr><td>11/03</td><td>Flying Tigress</td><td>In-store</td><td style="text-align:right">1,560.00</td><td>${sb('closed')}</td></tr>
            </tbody>
          </table>
          <div style="margin-top:10px"><button class="bs">Sync Selected</button></div>
        </div>`,
    };
  }

  // ══════════════════════════════════════════
  // 7. FIND TRANSACTIONS
  // ══════════════════════════════════════════
  function renderTxFind() {
    const dr = dateRange();
    return {
      tb: '<div class="tb"><div class="tb-t">Find Transactions</div></div>',
      ct: `
        <div class="card" style="max-width:1000px;margin:0 auto">
          <div class="tabs">
            <div class="tab">Debits and credits</div>
            <div class="tab a">Transactions</div>
            <div class="tab">Find and replace</div>
          </div>
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px">
            <div><div class="fl-l">Period</div><select class="fl"><option>This month</option><option>Last month</option><option>This quarter</option></select></div>
            <div><div class="fl-l">Date from *</div><input class="fl" type="date" value="${dr.from}" style="width:130px"></div>
            <div><div class="fl-l">Date to *</div><input class="fl" type="date" value="${dr.to}" style="width:130px"></div>
            <div><div class="fl-l">Transaction type</div><select class="fl" style="width:110px"><option>Select type</option><option>Bill</option><option>Bill payment</option><option>Pay run</option><option>Invoice</option></select></div>
            <div><div class="fl-l">Contact</div><select class="fl" style="width:100px"><option>All</option></select></div>
            <div><div class="fl-l">Category</div><select class="fl" style="width:80px"><option>All</option></select></div>
            <div><div class="fl-l">Search</div><input class="fl" placeholder="" style="width:100px"></div>
            <div style="flex:1"></div>
            <button class="bg" style="color:var(--acc)">Reset</button>
          </div>
          <table class="tbl">
            <thead><tr><th>Date <span class="s">▼</span></th><th>Reference no</th><th>Type</th><th>Description</th><th>Contact</th><th style="text-align:right">Amount ($)</th></tr></thead>
            <tbody>
              <tr><td>11/03</td><td><a class="lk">1277</a></td><td>Pay run</td><td>Wage Mar W2</td><td>Watcharapol D.</td><td style="text-align:right">609.00</td></tr>
              <tr><td>11/03</td><td><a class="lk">1284</a></td><td>Bill payment</td><td>Mind.RBuakl</td><td>Mind.RBuakl xx_M...</td><td style="text-align:right">582.82</td></tr>
              <tr><td>11/03</td><td><a class="lk">1282</a></td><td>Bill payment</td><td>Rental Mar 2026</td><td>Dencal Pty Ltd</td><td style="text-align:right">23,558.32</td></tr>
            </tbody>
          </table>
        </div>`,
    };
  }

  // ══════════════════════════════════════════
  // REGISTER ROUTES
  // ══════════════════════════════════════════
  App.registerRoutes({
    tx_log:         { render: renderTxLog },
    tx_sale:        { render: renderTxSale },
    tx_bill:        { render: renderTxBill },
    tx_return:      { render: renderTxReturn },
    tx_bill_detail: { render: renderTxBillDetail },
    tx_sd:          { render: renderTxSdBridge },
    tx_find:        { render: renderTxFind },
  });

  // ══════════════════════════════════════════
  // PUBLIC API — functions called from onclick
  // ══════════════════════════════════════════
  window.ScrTx = {
    _switchBdView,
  };

})();
