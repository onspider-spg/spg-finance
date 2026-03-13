/** Version 1.4 | 13 MAR 2026 | Siam Palette Group | Created 12 MAR 2026 */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_input_fin.js
 * Create screens: Sale, Bill, Transfer, Debit Note,
 * Recurring, Upload Create, Import
 * ═══════════════════════════════════════════
 */

(() => {
  const esc = App.esc;
  const today = App.today;

  // ══════════════════════════════════════════
  // MOCK DATA — will be replaced by API later
  // ══════════════════════════════════════════
  const MOCK = {
    brands: ['Mango Coco', 'Flying Tigress', 'Issho Cafe', 'Cheese Cottage', 'Redwork'],
    channels: ['Cash', 'Card (Eftpos1)', 'Card (Eftpos2)', 'UberEats', 'Easi', 'Union Pay', 'Card Prepaid'],
    bankAccounts: [
      { id: '7134', label: '7134 Mango Coco Westpac' },
      { id: '4429', label: '680 Flying Tigress #4429', balance: 22360.99 },
      { id: '1997', label: '682 Flying Tigress (Petty Cash) #1997', balance: -3849.70 },
    ],
    suppliers: ['', 'Pro Bros Providore', 'Siam Pacific Food', 'B&E Food Distributors', 'Dencal Pty Ltd', 'Akipan'],
    unpaidBills: [
      { bill: 'FIN-0048', inv: 'INV00003237', amount: 654.16, status: 'Open' },
      { bill: 'FIN-0046', inv: 'INV1050790', amount: 190.55, status: 'Open' },
      { bill: 'FIN-0045', inv: 'INV1050836', amount: 128.10, status: 'Overdue' },
    ],
    recentSales: [
      { date: '12/03', channel: 'UberEats', brand: 'Mango Coco', amount: 890.20 },
      { date: '12/03', channel: 'Cash', brand: 'Mango Coco', amount: 2340.50 },
    ],
    nextBillNo: 'FIN-0052',
  };

  // ══════════════════════════════════════════
  // SHARED HELPERS (used across Create screens)
  // ══════════════════════════════════════════

  /** Build <option> list from string array */
  function opts(arr, selected) {
    return arr.map(v => `<option${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
  }

  /** Build <option> list from [{id, label}] */
  function optsObj(arr, selectedId) {
    return arr.map(o => `<option value="${esc(o.id)}"${o.id === selectedId ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
  }

  /** Double-submit guard — disable button during save */
  function guardedSave(btnEl, saveFn) {
    if (!btnEl || btnEl.disabled) return;
    const origText = btnEl.textContent;
    btnEl.disabled = true;
    btnEl.textContent = 'Saving...';
    // Mock save delay — replace with real API later
    setTimeout(() => {
      saveFn();
      btnEl.disabled = false;
      btnEl.textContent = origText;
    }, 600);
  }

  // ══════════════════════════════════════════
  // 1. CREATE SALE — Quick Entry for Income
  // ══════════════════════════════════════════
  function renderCreateSale() {
    return {
      tb: '<div class="tb"><div class="tb-t">Create Sale</div></div>',
      ct: `
        <div class="card" style="margin:0 auto;max-width:500px">
          <div style="font-size:var(--fs-sm);color:var(--t3);margin-bottom:8px">Record daily sales income by channel</div>

          <div class="fg">
            <label class="lb">Brand *</label>
            <select class="inp" id="cs_brand" style="font-size:14px;font-weight:600;padding:8px">${opts(MOCK.brands)}</select>
          </div>

          <div class="fg">
            <label class="lb">Channel *</label>
            <select class="inp" id="cs_channel">${opts(MOCK.channels)}</select>
          </div>

          <div class="fa">Auto: Income → Revenue → selected channel</div>

          <div class="fr">
            <div class="fg">
              <label class="lb">Amount ($) *</label>
              <input class="inp" id="cs_amount" style="font-size:15px;font-weight:700;text-align:right;padding:8px" placeholder="0.00" oninput="ScrInput._calcSaleGST()">
            </div>
            <div class="fg">
              <label class="lb">GST</label>
              <input class="inp" id="cs_gst" style="text-align:right;padding:8px;background:var(--bg3);color:var(--t3)" readonly>
            </div>
          </div>

          <div class="fr">
            <div class="fg">
              <label class="lb">Sale Date *</label>
              <input class="inp" id="cs_date" type="date" value="${today()}">
            </div>
            <div class="fg">
              <label class="lb">Bank Account *</label>
              <select class="inp" id="cs_bank">${optsObj(MOCK.bankAccounts)}</select>
            </div>
          </div>

          <div style="background:var(--bg2);border-radius:var(--rd);padding:8px;font-size:var(--fs-xs);color:var(--t2);margin:8px 0">
            Category: Revenue → Cash · Brand: Mango Coco · Status: Received
          </div>

          <div style="display:flex;gap:6px">
            <button class="bs" style="flex:2;padding:10px" onclick="ScrInput._saveSale(this,'next')">Save & Next ↵</button>
            <button class="btn bo" style="flex:1;padding:10px" onclick="ScrInput._saveSale(this,'close')">Save & Close</button>
          </div>

          <div style="font-size:var(--fs-xxs);color:var(--t3);margin-top:6px;text-align:center">
            Note: SD Bridge imports 95% of sales automatically
          </div>
        </div>

        <div class="card" style="margin:10px auto;max-width:500px">
          <div style="font-size:var(--fs-xs);font-weight:600;margin-bottom:6px">Recently saved</div>
          <table class="tbl">
            <thead><tr><th>Date</th><th>Channel</th><th>Brand</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody id="cs_recent">
              ${MOCK.recentSales.map(s => `<tr>
                <td>${esc(s.date)}</td><td>${esc(s.channel)}</td><td>${esc(s.brand)}</td>
                <td style="text-align:right;color:var(--g)">+${App.formatMoney(s.amount)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`,
    };
  }

  function _calcSaleGST() {
    const amtEl = document.getElementById('cs_amount');
    const gstEl = document.getElementById('cs_gst');
    if (!amtEl || !gstEl) return;
    const val = parseFloat(amtEl.value.replace(/,/g, '')) || 0;
    gstEl.value = (val / 11).toFixed(2);
  }

  function _saveSale(btnEl, mode) {
    guardedSave(btnEl, () => {
      App.toast('Sale saved');
      if (mode === 'next') {
        const amt = document.getElementById('cs_amount');
        const gst = document.getElementById('cs_gst');
        if (amt) { amt.value = ''; amt.focus(); }
        if (gst) gst.value = '';
      } else {
        App.go('dashboard');
      }
    });
  }

  // ══════════════════════════════════════════
  // 2. CREATE TRANSFER
  // ══════════════════════════════════════════
  function renderCreateTransfer() {
    return {
      tb: '<div class="tb"><div class="tb-t">Create Transfer</div></div>',
      ct: `
        <div class="card" style="max-width:700px;margin:0 auto">
          <div class="fg">
            <label class="lb">Transfer Type *</label>
            <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
              <label class="cr-radio-card active" onclick="ScrInput._pickTransferType(this)">
                <input type="radio" name="ttype" checked style="accent-color:var(--acc)"> Internal (Same Brand)
              </label>
              <label class="cr-radio-card" onclick="ScrInput._pickTransferType(this)">
                <input type="radio" name="ttype" style="accent-color:var(--acc)"> Intercompany (Cross Brand)
              </label>
              <label class="cr-radio-card" onclick="ScrInput._pickTransferType(this)">
                <input type="radio" name="ttype" style="accent-color:var(--acc)"> Cash Transfer
              </label>
            </div>
          </div>

          <div class="fr">
            <div class="fg">
              <label class="lb">Amount ($) *</label>
              <input class="inp" id="ct_amount" style="font-size:16px;font-weight:700" placeholder="0.00">
            </div>
            <div class="fg">
              <label class="lb">Reference Number *</label>
              <input class="inp" id="ct_ref" value="TR000092">
            </div>
          </div>

          <div class="fr">
            <div class="fg">
              <label class="lb">Description of transaction</label>
              <textarea class="inp" id="ct_desc" style="min-height:50px;resize:vertical"></textarea>
            </div>
            <div class="fg">
              <label class="lb">Date *</label>
              <input class="inp" id="ct_date" type="date" value="${today()}">
            </div>
          </div>

          <hr style="border:none;border-top:1px solid var(--bd2);margin:12px 0">

          <div class="fr">
            <div class="fg">
              <label class="lb">Bank account from *</label>
              <select class="inp" id="ct_from" onchange="ScrInput._updateTransferBal()">${optsObj(MOCK.bankAccounts)}</select>
              <div id="ct_from_bal" style="font-size:var(--fs-xs);margin-top:4px"></div>
            </div>
            <div class="fg">
              <label class="lb">Bank account to *</label>
              <select class="inp" id="ct_to" onchange="ScrInput._updateTransferBal()">${optsObj(MOCK.bankAccounts)}</select>
              <div id="ct_to_bal" style="font-size:var(--fs-xs);margin-top:4px"></div>
            </div>
          </div>

          <div style="display:flex;gap:6px;margin-top:16px;justify-content:flex-end">
            <button class="btn bo" onclick="App.go('dashboard')">Cancel</button>
            <button class="btn bo">Record and new ▾</button>
            <button class="bs" onclick="ScrInput._saveTransfer(this)">Record</button>
          </div>
        </div>`,
    };
  }

  function _pickTransferType(labelEl) {
    document.querySelectorAll('.cr-radio-card').forEach(el => el.classList.remove('active'));
    labelEl.classList.add('active');
    const radio = labelEl.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  }

  function _updateTransferBal() {
    // Show balance info for selected bank accounts
    const fromEl = document.getElementById('ct_from');
    const toEl = document.getElementById('ct_to');
    const fromBal = document.getElementById('ct_from_bal');
    const toBal = document.getElementById('ct_to_bal');
    if (!fromEl || !toEl) return;

    const fromAcc = MOCK.bankAccounts.find(b => b.id === fromEl.value);
    const toAcc = MOCK.bankAccounts.find(b => b.id === toEl.value);

    if (fromBal && fromAcc?.balance != null) {
      fromBal.innerHTML = `Current balance <b>${App.formatMoney(fromAcc.balance)}</b>`;
    }
    if (toBal && toAcc?.balance != null) {
      toBal.innerHTML = `Current balance <b>${App.formatMoney(toAcc.balance)}</b>`;
    }
  }

  function _saveTransfer(btnEl) {
    guardedSave(btnEl, () => {
      App.toast('Transfer recorded');
      App.go('tx_log');
    });
  }

  // ══════════════════════════════════════════
  // 3. CREATE DEBIT NOTE
  // ══════════════════════════════════════════
  function renderCreateDebit() {
    const billOpts = MOCK.unpaidBills.map(b =>
      `<option value="${esc(b.bill)}">${esc(b.bill)} · ${esc(b.inv)} · ${App.formatMoney(b.amount)} · ${esc(b.status)}</option>`
    ).join('');

    return {
      tb: '<div class="tb"><div class="tb-t">Create Debit Note</div></div>',
      ct: `
        <div class="card" style="max-width:560px;margin:0 auto">
          <div style="font-size:var(--fs-sm);color:var(--t3);margin-bottom:8px">
            Select a supplier and their invoice to create a debit note
          </div>

          <div class="fg">
            <label class="lb">Supplier *</label>
            <select class="inp" id="cd_supplier" style="font-size:14px;padding:8px">${opts(MOCK.suppliers)}</select>
          </div>

          <div class="fg">
            <label class="lb">Select Invoice to Debit *</label>
            <select class="inp" id="cd_invoice">
              <option></option>
              ${billOpts}
            </select>
          </div>

          <hr style="border:none;border-top:1px solid var(--bd2);margin:12px 0">

          <div class="fr">
            <div class="fg">
              <label class="lb">Debit Amount ($) *</label>
              <input class="inp" id="cd_amount" style="font-size:15px;font-weight:700;text-align:right;padding:8px" placeholder="0.00">
            </div>
            <div class="fg">
              <label class="lb">Bill Number *</label>
              <input class="inp" value="${esc(MOCK.nextBillNo)}" readonly style="background:var(--bg3);color:var(--t3)">
            </div>
          </div>

          <div class="fr">
            <div class="fg">
              <label class="lb">Supplier Invoice No</label>
              <input class="inp" id="cd_inv_no" style="color:var(--b)" placeholder="e.g. INV00003237-CR">
            </div>
            <div class="fg">
              <label class="lb">Date *</label>
              <input class="inp" id="cd_date" type="date" value="${today()}">
            </div>
          </div>

          <div class="fg">
            <label class="lb">Reason / Notes</label>
            <textarea class="inp" id="cd_notes" style="min-height:50px;resize:vertical" placeholder="e.g. Damaged goods credit"></textarea>
          </div>

          <div style="background:var(--bbg);border-radius:var(--rd);padding:8px;font-size:var(--fs-xs);color:var(--b);margin:8px 0">
            Status: <b>Debit</b> · Will be available to offset against future payments
          </div>

          <div style="display:flex;gap:6px;justify-content:flex-end">
            <button class="btn bo" onclick="App.go('dashboard')">Cancel</button>
            <button class="bs" onclick="ScrInput._saveDebit(this)">Create Debit Note</button>
          </div>
        </div>`,
    };
  }

  function _saveDebit(btnEl) {
    guardedSave(btnEl, () => {
      App.toast('Debit note created');
      App.go('tx_return');
    });
  }

  // ══════════════════════════════════════════
  // SHARED: TAX CODE DROPDOWN (used by Bill, Recurring, Upload)
  // ══════════════════════════════════════════
  function taxCodeDropdownHTML(rowIdx) {
    const codes = App.S.taxCodes || [];
    const rows = codes.map(tc =>
      `<div class="tc-row" onclick="ScrInput._pickTaxCode(this,'tcw_${rowIdx}')">`
      + `<span class="tc-code">${esc(tc.code)}</span>`
      + `<span class="tc-name">${esc(tc.name)}</span>`
      + `<span class="tc-rate">${tc.rate}%</span></div>`
    ).join('');
    return `<div class="tc-wrap" id="tcw_${rowIdx}">`
      + `<input class="tc-val" readonly onclick="ScrInput._toggleTaxDD('tcw_${rowIdx}')" value="" data-rate="0">`
      + `<span class="tc-arr">▾</span>`
      + `<div class="tc-dd">${rows}</div></div>`;
  }

  function _toggleTaxDD(wrapId) {
    const w = document.getElementById(wrapId);
    if (!w) return;
    // Close others first
    document.querySelectorAll('.tc-wrap.open').forEach(x => { if (x.id !== wrapId) x.classList.remove('open'); });
    w.classList.toggle('open');
  }

  function _pickTaxCode(rowEl, wrapId) {
    const w = document.getElementById(wrapId);
    if (!w) return;
    const code = rowEl.querySelector('.tc-code').textContent;
    const rate = rowEl.querySelector('.tc-rate').textContent.replace('%', '');
    const inp = w.querySelector('.tc-val');
    if (inp) { inp.value = code; inp.dataset.rate = rate; }
    w.classList.remove('open');
    // Recalculate GST for this row
    _recalcBillRow(wrapId);
  }

  // Close tax dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tc-wrap')) {
      document.querySelectorAll('.tc-wrap.open').forEach(x => x.classList.remove('open'));
    }
  });

  // ══════════════════════════════════════════
  // SHARED: CATEGORIES (used by Bill, Recurring, Upload)
  // ══════════════════════════════════════════
  const MOCK_CATS = ['', '27002 Purchases-GST Free', '27010 Packaging', '42700 Rent', '43000 Utilities', '46000 Wages'];

  /** Get categories — prefer S.categories from API, fallback to MOCK */
  function _getCats() {
    const cats = App.S.categories;
    if (cats && cats.length > 0) return ['', ...cats.map(c => c.code + ' ' + c.name)];
    return MOCK_CATS;
  }

  /** Get vendor options — prefer S.vendors from API, fallback to MOCK */
  function _vendorOpts() {
    const vendors = App.S.vendors;
    if (vendors && vendors.length > 0) {
      return '<option value=""></option>' + vendors.map(v =>
        `<option value="${esc(v.id)}" data-name="${esc(v.name)}">${esc(v.name)}</option>`
      ).join('');
    }
    return opts(MOCK.suppliers);
  }

  // ══════════════════════════════════════════
  // SHARED: ALLOCATION LAYOUT POPUP
  // ══════════════════════════════════════════
  let _billAllocMode = 'self'; // 'self' or 'ob'

  function _toggleAllocPopup() {
    const p = document.getElementById('al_pop');
    if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
  }

  function _setAllocMode(mode) {
    _billAllocMode = mode;
    const p = document.getElementById('al_pop');
    if (p) p.style.display = 'none';
    _rebuildLineItems();
  }

  // ══════════════════════════════════════════
  // 4. CREATE BILL — Full form with line items
  // ══════════════════════════════════════════
  let _billRows = 2; // start with 2 empty rows

  function renderCreateBill() {
    _billAllocMode = 'self';
    _billRows = 2;

    return {
      tb: '<div class="tb"><div class="tb-t">Create Bill</div></div>',
      ct: `
        <div style="max-width:860px;margin:0 auto">
          <!-- Prefill card -->
          <div class="card" style="padding:10px 16px">
            <div style="display:flex;gap:16px">
              <div style="font-size:var(--fs-body);color:var(--acc);cursor:pointer">📄 Prefill from a source document</div>
              <div style="font-size:var(--fs-body);color:var(--acc);cursor:pointer">↻ Prefill from recurring</div>
            </div>
          </div>

          <!-- Main form card -->
          <div class="card">
            <!-- 2-column header fields -->
            <div style="display:flex;gap:30px">
              <!-- Left column -->
              <div style="width:300px">
                <div class="fg">
                  <label class="lb">Transaction Type</label>
                  <select class="inp" id="cb_type" style="width:280px">
                    <option>Expense / Bill</option>
                    <option>Asset Purchase</option>
                  </select>
                </div>
                <div class="fg">
                  <label class="lb">Supplier *</label>
                  <select class="inp" id="cb_supplier" style="width:280px">${_vendorOpts()}</select>
                </div>
                <div class="fg">
                  <label class="lb">Supplier Invoice Number</label>
                  <input class="inp" id="cb_inv_no" style="width:280px" placeholder="e.g. INV1052323">
                </div>
              </div>

              <!-- Right column -->
              <div style="flex:1">
                <div style="display:flex;align-items:flex-start;margin-bottom:10px;justify-content:flex-end;gap:10px">
                  <span class="lb" style="padding-top:8px;margin:0">Bill Number *</span>
                  <div style="width:180px">
                    <input class="inp" value="(auto)" readonly style="background:var(--bg3);color:var(--t3)">
                    <div style="font-size:var(--fs-xxs);color:var(--t4)">Auto — DB generates T-000001</div>
                  </div>
                </div>
                <div style="display:flex;align-items:center;margin-bottom:10px;justify-content:flex-end;gap:10px">
                  <span class="lb" style="margin:0">Issue Date *</span>
                  <input class="inp" id="cb_issue_date" type="date" value="${today()}" style="width:180px">
                </div>
                <div style="display:flex;align-items:center;margin-bottom:10px;justify-content:flex-end;gap:10px">
                  <span class="lb" style="margin:0">Due Date *</span>
                  <input class="inp" id="cb_due_date" type="date" style="width:180px">
                </div>
                <div style="display:flex;align-items:center;margin-bottom:10px;justify-content:flex-end;gap:10px">
                  <span class="lb" style="margin:0">Accrual Month</span>
                  <input class="inp" id="cb_accrual" type="month" value="${today().substring(0,7)}" style="width:180px">
                </div>
              </div>
            </div>

            <!-- Allocation Layout divider -->
            <div style="position:relative;margin:12px 0 0">
              <div style="display:flex;align-items:center;gap:0">
                <hr style="border:none;border-top:1px solid #eee;flex:1;margin:0">
                <div style="padding:0 8px;display:flex;align-items:center;gap:4px;flex-shrink:0">
                  <span style="font-size:var(--fs-xs);color:var(--t4)">Allocation Layout</span>
                  <button class="bg" style="font-size:16px;color:var(--acc);padding:2px" onclick="ScrInput._toggleAllocPopup()">⚙</button>
                  <div id="al_pop" style="display:none;position:absolute;right:0;top:28px;background:#fff;border:1px solid var(--bd);border-radius:8px;box-shadow:var(--sh2);padding:10px 14px;z-index:20;min-width:180px">
                    <div style="font-size:var(--fs-xs);font-weight:600;margin-bottom:4px">Allocation Layout</div>
                    <label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);padding:2px 0;cursor:pointer">
                      <input type="radio" name="al_bill" checked style="accent-color:var(--acc)" onchange="ScrInput._setAllocMode('self')"> Self
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);padding:2px 0;cursor:pointer">
                      <input type="radio" name="al_bill" style="accent-color:var(--acc)" onchange="ScrInput._setAllocMode('ob')"> On Behalf / Split
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Line Items Table -->
            <div id="cb_lines">${_buildLineItemsHTML()}</div>

            <!-- Add row button -->
            <div style="margin-top:4px">
              <button class="bg" style="color:var(--acc);font-size:var(--fs-sm)" onclick="ScrInput._addBillRow()">+ Add line</button>
            </div>

            <!-- Notes + Totals -->
            <div style="display:flex;gap:16px;margin-top:12px">
              <div style="flex:1">
                <div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:2px">Notes</div>
                <textarea id="cb_notes" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--rd);font-size:var(--fs-body);font-family:inherit;min-height:60px;resize:vertical"></textarea>
              </div>
              <div style="width:240px;text-align:right;font-size:var(--fs-body)" id="cb_totals">
                ${_buildTotalsHTML(0, 0)}
              </div>
            </div>
          </div>

          <!-- Action buttons -->
          <div style="display:flex;align-items:center;gap:6px;padding:8px 0">
            <button class="btn bo">View PDF</button>
            <button class="btn bo" onclick="App.go('cr_recurring')">Save as recurring</button>
            <div style="flex:1"></div>
            <button class="btn bo" onclick="App.go('dashboard')">Cancel</button>
            <!-- Save and... dropdown -->
            <div style="position:relative;display:inline-block">
              <button class="btn bo" onclick="ScrInput._toggleSaveDD()">Save and... ▾</button>
              <div id="cb_save_dd" style="display:none;position:absolute;bottom:100%;right:0;background:#fff;border:1px solid var(--bd);border-radius:8px;box-shadow:var(--sh2);padding:4px 0;min-width:160px;z-index:20">
                <div class="sg-item" onclick="ScrInput._saveBill('new')">Save and Create new</div>
                <div class="sg-item" onclick="ScrInput._saveBill('dup')">Save and Duplicate</div>
              </div>
            </div>
            <button class="bs" onclick="ScrInput._saveBill('close',this)">Save</button>
          </div>

          <!-- Attachments -->
          <div style="border:1.5px dashed #ddd;border-radius:10px;padding:16px;margin-top:6px">
            <div style="font-size:var(--fs-body);font-weight:600;margin-bottom:8px">More information</div>
            <div style="background:#333;color:#fff;padding:8px 10px;border-radius:8px 8px 0 0;font-size:var(--fs-body);font-weight:600">Attachments</div>
            <div style="border:1.5px dashed #ddd;border-top:none;border-radius:0 0 8px 8px;padding:16px;text-align:center">
              <div style="font-size:var(--fs-sm);color:var(--t3)">Drag files here, or <a style="color:var(--acc);font-weight:600;cursor:pointer">browse</a></div>
            </div>
          </div>
        </div>`,
    };
  }

  // ── Line Items HTML builder ──
  function _buildLineItemsHTML() {
    const isOB = _billAllocMode === 'ob';
    let cols;
    if (isOB) {
      cols = '<tr><th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:14%">Cost Owner</th>'
        + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:22%">Description</th>'
        + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:22%">Category *</th>'
        + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:16%">Amount ($) *</th>'
        + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:10%">GST</th>'
        + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:14%">Tax code *</th>'
        + '<th style="width:2%"></th></tr>';
    } else {
      cols = '<tr><th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:30%">Description</th>'
        + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:26%">Category *</th>'
        + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:18%">Amount ($) *</th>'
        + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:10%">GST</th>'
        + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:14%">Tax code *</th>'
        + '<th style="width:2%"></th></tr>';
    }

    let rows = '';
    for (let i = 0; i < _billRows; i++) {
      rows += _buildOneRow(i, isOB);
    }

    return `<table style="width:100%;border-collapse:collapse;font-size:var(--fs-body);margin-top:10px"><thead>${cols}</thead><tbody id="cb_tbody">${rows}</tbody></table>`;
  }

  function _buildOneRow(idx, isOB) {
    const C = 'padding:0;border:1px solid #e5e7eb';
    const ST = 'width:100%;padding:8px 10px;border:none;font-size:var(--fs-body);font-family:inherit';
    const catOpts = _getCats().map(c => `<option>${esc(c)}</option>`).join('');
    const brands = App.S.brands && App.S.brands.length > 0 ? App.S.brands : MOCK.brands;
    const brandOpts = brands.map(b => `<option>${esc(b)}</option>`).join('');

    let ownerCol = '';
    if (isOB) {
      ownerCol = `<td style="${C}"><select style="${ST}"><option></option>${brandOpts}</select></td>`;
    }

    return `<tr data-row="${idx}">`
      + ownerCol
      + `<td style="${C}"><div contenteditable style="padding:8px 10px;min-height:36px;outline:none;font-size:var(--fs-body)"></div></td>`
      + `<td style="${C}"><select style="${ST}">${catOpts}</select></td>`
      + `<td style="${C}"><input id="cb_amt_${idx}" style="width:100%;padding:8px 10px;border:none;text-align:right;font-size:var(--fs-body)" oninput="ScrInput._recalcBillRow('tcw_${idx}')"></td>`
      + `<td style="${C};background:#fafafa"><input id="cb_gst_${idx}" readonly style="width:100%;padding:8px 10px;border:none;text-align:right;background:#fafafa;color:var(--t3);font-size:var(--fs-body)"></td>`
      + `<td style="${C}">${taxCodeDropdownHTML(idx)}</td>`
      + `<td style="${C};text-align:center;cursor:pointer;color:var(--t4)" onclick="ScrInput._removeBillRow(${idx})">×</td>`
      + '</tr>';
  }

  function _rebuildLineItems() {
    const el = document.getElementById('cb_lines');
    if (el) el.innerHTML = _buildLineItemsHTML();
  }

  function _addBillRow() {
    _billRows++;
    _rebuildLineItems();
  }

  function _removeBillRow(idx) {
    if (_billRows <= 1) return; // keep at least 1 row
    const row = document.querySelector(`tr[data-row="${idx}"]`);
    if (row) row.remove();
    _billRows--;
    _recalcBillTotals();
  }

  // ── GST + Totals calculation ──
  function _recalcBillRow(wrapId) {
    // Extract row index from wrapId (format: tcw_0, tcw_1, ...)
    const idx = wrapId.replace('tcw_', '');
    const amtEl = document.getElementById('cb_amt_' + idx);
    const gstEl = document.getElementById('cb_gst_' + idx);
    const tcWrap = document.getElementById(wrapId);
    if (!amtEl || !gstEl || !tcWrap) return;

    const amount = parseFloat(amtEl.value.replace(/,/g, '')) || 0;
    const tcInput = tcWrap.querySelector('.tc-val');
    const rate = parseFloat(tcInput?.dataset.rate || '0');

    // GST = amount * rate / 100
    const gst = amount * rate / 100;
    gstEl.value = gst.toFixed(2);

    _recalcBillTotals();
  }

  function _recalcBillTotals() {
    let totalExGST = 0;
    let totalTax = 0;

    // Sum all rows
    for (let i = 0; i < 100; i++) {
      const amtEl = document.getElementById('cb_amt_' + i);
      const gstEl = document.getElementById('cb_gst_' + i);
      if (!amtEl) continue;
      totalExGST += parseFloat(amtEl.value.replace(/,/g, '')) || 0;
      totalTax += parseFloat(gstEl?.value || '0');
    }

    const totalsEl = document.getElementById('cb_totals');
    if (totalsEl) totalsEl.innerHTML = _buildTotalsHTML(totalExGST, totalTax);
  }

  function _buildTotalsHTML(exGST, tax) {
    const total = exGST + tax;
    return `<div style="display:flex;justify-content:flex-end;gap:16px;padding:4px 0"><b>Total Amount ex GST</b><b>${App.formatMoney(exGST)}</b></div>`
      + `<div style="display:flex;justify-content:flex-end;gap:16px;padding:4px 0;color:var(--t2)">Tax <span>${App.formatMoney(tax)}</span></div>`
      + `<div style="display:flex;justify-content:flex-end;gap:16px;padding:4px 0"><b>Total</b><b>${App.formatMoney(total)}</b></div>`
      + `<div style="display:flex;justify-content:flex-end;gap:16px;padding:4px 0">Amount paid <input id="cb_paid" value="0.00" style="width:70px;text-align:right;padding:3px 6px;border:1px solid var(--bd);border-radius:4px;font-size:var(--fs-body)" oninput="ScrInput._recalcBillBalance()"></div>`
      + `<div style="display:flex;justify-content:flex-end;gap:16px;padding:6px 0;font-weight:700" id="cb_balance">Balance due <span>${App.formatMoney(total)}</span></div>`;
  }

  function _recalcBillBalance() {
    const paidEl = document.getElementById('cb_paid');
    const balEl = document.getElementById('cb_balance');
    if (!paidEl || !balEl) return;
    const paid = parseFloat(paidEl.value.replace(/,/g, '')) || 0;

    let totalExGST = 0, totalTax = 0;
    for (let i = 0; i < 100; i++) {
      const amtEl = document.getElementById('cb_amt_' + i);
      const gstEl = document.getElementById('cb_gst_' + i);
      if (!amtEl) continue;
      totalExGST += parseFloat(amtEl.value.replace(/,/g, '')) || 0;
      totalTax += parseFloat(gstEl?.value || '0');
    }
    const balance = totalExGST + totalTax - paid;
    balEl.innerHTML = `Balance due <span>${App.formatMoney(balance)}</span>`;
  }

  // ── Save and... dropdown ──
  function _toggleSaveDD() {
    const dd = document.getElementById('cb_save_dd');
    if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  }

  async function _saveBill(mode, btnEl) {
    const saveBtn = btnEl || document.querySelector('.bs');
    if (!saveBtn || saveBtn.disabled) return;
    const origText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      // Collect form data
      const supplierEl = document.getElementById('cb_supplier');
      const supplierOpt = supplierEl?.selectedOptions[0];
      const vendor_id = supplierOpt?.value || null;
      const vendor_name = supplierOpt?.dataset?.name || supplierOpt?.textContent || '';

      // Collect line items
      const lineItems = [];
      for (let i = 0; i < 100; i++) {
        const amtEl = document.getElementById('cb_amt_' + i);
        if (!amtEl) continue;
        const amount = parseFloat(amtEl.value.replace(/,/g, '')) || 0;
        if (amount === 0) continue;

        const gstEl = document.getElementById('cb_gst_' + i);
        const tcWrap = document.getElementById('tcw_' + i);
        const tcInput = tcWrap?.querySelector('.tc-val');
        const row = amtEl.closest('tr');
        const descEl = row?.querySelector('[contenteditable]');
        const catEl = row?.querySelector('select');

        lineItems.push({
          description: descEl?.textContent?.trim() || '',
          category_display: catEl?.value || '',
          amount: amount,
          gst: parseFloat(gstEl?.value || '0'),
          tax_code: tcInput?.value || 'FRE',
          cost_owner: null,
        });
      }

      // Calculate total
      const totalExGst = lineItems.reduce((s, li) => s + li.amount, 0);
      const totalGst = lineItems.reduce((s, li) => s + li.gst, 0);

      const data = {
        vendor_id: vendor_id && vendor_id !== '' ? vendor_id : null,
        vendor_name: vendor_name,
        supplier_inv_no: document.getElementById('cb_inv_no')?.value || '',
        issue_date: document.getElementById('cb_issue_date')?.value || App.today(),
        due_date: document.getElementById('cb_due_date')?.value || null,
        accrual_month: document.getElementById('cb_accrual')?.value || null,
        brand: null, // TODO: from allocation
        allocation: _billAllocMode,
        notes: document.getElementById('cb_notes')?.value || '',
        total: totalExGst + totalGst,
        lineItems: lineItems,
      };

      const result = await API.createBill(data);

      // Close save dropdown
      const dd = document.getElementById('cb_save_dd');
      if (dd) dd.style.display = 'none';

      if (mode === 'new') {
        App.toast('Bill saved — ' + (result.bill?.bill_no || ''));
        App.go('cr_bill');
      } else if (mode === 'dup') {
        App.toast('Bill saved — edit duplicate');
      } else {
        // Save & Close → go to Bill Detail (data already in memory)
        App.toast('Bill saved — ' + (result.bill?.bill_no || ''));
        App.go('tx_bill_detail');
      }

    } catch (e) {
      App.toast('Error: ' + e.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = origText;
    }
  }

  // ══════════════════════════════════════════
  // 5. CREATE RECURRING TRANSACTION
  // ══════════════════════════════════════════
  function renderCreateRecurring() {
    const catOpts = MOCK_CATS.map(c => `<option>${esc(c)}</option>`).join('');
    const tcOpts = (App.S.taxCodes || []).map(tc => `<option>${esc(tc.code)}</option>`).join('');

    return {
      tb: '<div class="tb"><div class="tb-t">Create Recurring Transaction</div></div>',
      ct: `
        <div style="max-width:800px;margin:0 auto">
          <!-- Schedule Details card -->
          <div class="card">
            <div style="font-size:var(--fs-body);font-weight:700;margin-bottom:10px">Schedule Details</div>
            <div class="fg">
              <label class="lb">Transaction Type *</label>
              <select class="inp" style="max-width:280px">
                <option>Bill</option><option>Invoice</option><option>Receive money</option>
                <option>Spend money</option><option>General Journal</option>
              </select>
            </div>
            <div class="fg">
              <label class="lb">Schedule Name *</label>
              <input class="inp" placeholder="e.g. Rent — Macquarie" style="max-width:280px">
            </div>
            <div class="fg">
              <label class="lb">Frequency *</label>
              <select class="inp" style="max-width:280px">
                <option>Never</option><option>Daily</option><option>Weekly</option>
                <option>Fortnightly</option><option>Monthly</option><option>Quarterly</option><option>Yearly</option>
              </select>
            </div>
          </div>

          <!-- Transaction Details card -->
          <div class="card">
            <div style="font-size:var(--fs-body);font-weight:700;margin-bottom:10px">Create a transaction with this information</div>
            <div class="fr">
              <div class="fg" style="flex:2">
                <label class="lb">Supplier *</label>
                <select class="inp">${opts(MOCK.suppliers)}</select>
              </div>
              <div class="fg">
                <label class="lb">Payment *</label>
                <div style="padding:5px 10px;background:var(--acc2);color:var(--acc);border-radius:var(--rd);font-size:var(--fs-sm);font-weight:600;text-align:center">In a given no. of days</div>
              </div>
            </div>

            <div style="display:flex;gap:12px;margin:8px 0;font-size:var(--fs-sm)">
              <label><input type="checkbox"> Report to ATO via TPAR</label>
              <div style="flex:1"></div>
              <span>Amounts are</span>
              <label style="margin-left:6px"><input type="radio" name="taxinc" checked style="accent-color:var(--acc)"> Tax inclusive</label>
              <label style="margin-left:6px"><input type="radio" name="taxinc" style="accent-color:var(--acc)"> Tax exclusive</label>
            </div>

            <!-- Allocation divider -->
            <div style="position:relative;margin:8px 0">
              <div style="display:flex;align-items:center">
                <hr style="border:none;border-top:1px solid #eee;flex:1">
                <div style="padding:0 8px"><button class="bg" style="font-size:16px;color:var(--acc)">⚙</button></div>
              </div>
            </div>

            <!-- Simple line items (no dynamic add/remove for recurring) -->
            <table style="width:100%;border-collapse:collapse;font-size:var(--fs-body);margin-top:6px">
              <thead><tr>
                <th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:35%">Description</th>
                <th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:30%">Category *</th>
                <th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:15%">Amount ($) *</th>
                <th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:6%">Job</th>
                <th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:14%">Tax code *</th>
              </tr></thead>
              <tbody>
                <tr>
                  <td style="padding:0;border:1px solid #e5e7eb"><div contenteditable style="padding:8px 10px;min-height:34px;outline:none;font-size:var(--fs-body)"></div></td>
                  <td style="padding:0;border:1px solid #e5e7eb"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm);font-family:inherit">${catOpts}</select></td>
                  <td style="padding:0;border:1px solid #e5e7eb"><input style="width:100%;padding:8px;border:none;text-align:right;font-size:var(--fs-body)"></td>
                  <td style="padding:0;border:1px solid #e5e7eb"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm)"><option></option></select></td>
                  <td style="padding:0;border:1px solid #e5e7eb"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm)"><option></option>${tcOpts}</select></td>
                </tr>
                <tr>
                  <td style="padding:0;border:1px solid #e5e7eb"><div contenteditable style="padding:8px 10px;min-height:34px;outline:none;font-size:var(--fs-body)"></div></td>
                  <td style="padding:0;border:1px solid #e5e7eb"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm);font-family:inherit">${catOpts}</select></td>
                  <td style="padding:0;border:1px solid #e5e7eb"><input style="width:100%;padding:8px;border:none;text-align:right;font-size:var(--fs-body)"></td>
                  <td style="padding:0;border:1px solid #e5e7eb"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm)"><option></option></select></td>
                  <td style="padding:0;border:1px solid #e5e7eb"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm)"><option></option>${tcOpts}</select></td>
                </tr>
              </tbody>
            </table>

            <div class="fg" style="margin-top:10px">
              <label class="lb">Notes</label>
              <textarea class="inp" style="min-height:50px;resize:vertical"></textarea>
            </div>

            <div style="text-align:right;font-size:var(--fs-body);margin:8px 0">
              <div>Subtotal <b>$0.00</b></div>
              <div>Tax <b>$0.00</b></div>
              <div>Total <b>$0.00</b></div>
              <div style="font-weight:700;margin-top:4px">Balance due <b>$0.00</b></div>
            </div>

            <div style="display:flex;gap:6px;justify-content:flex-end">
              <button class="btn bo" onclick="App.go('dashboard')">Cancel</button>
              <button class="bs" onclick="ScrInput._saveRecurring(this)">Save</button>
            </div>
          </div>
        </div>`,
    };
  }

  function _saveRecurring(btnEl) {
    guardedSave(btnEl, () => {
      App.toast('Recurring transaction saved');
      App.go('rv_recurring');
    });
  }

  // ══════════════════════════════════════════
  // 6. CREATE FROM UPLOAD (Scan→Create split view)
  // ══════════════════════════════════════════
  function renderCreateUpload() {
    const catOpts = MOCK_CATS.map(c => `<option>${esc(c)}</option>`).join('');
    const tcOpts = (App.S.taxCodes || []).map(tc => `<option>${esc(tc.code)}</option>`).join('');

    return {
      tb: '<div class="tb"><button class="bg" onclick="App.go(\'tx_bill\')">← Bills</button><div class="tb-t">Create from Upload</div></div>',
      ct: `
        <div class="card" style="max-width:1100px;margin:0 auto;padding:0;overflow:hidden">
          <div style="display:grid;grid-template-columns:1fr 1.2fr;min-height:600px">
            <!-- Left: Document preview -->
            <div style="background:var(--bg3);border-right:1px solid var(--bd2);padding:16px">
              <div style="border:2px dashed var(--bd);border-radius:10px;padding:20px;text-align:center;margin-bottom:12px;background:#fff">
                <div style="font-size:22px;color:var(--t4)">☁️</div>
                <div style="font-size:var(--fs-sm);color:var(--t3)">Drag invoice here, or <a style="color:var(--acc);font-weight:600;cursor:pointer">browse</a></div>
              </div>
              <div style="background:#fff;border-radius:8px;box-shadow:var(--sh);padding:16px;text-align:center">
                <div style="font-size:28px;margin-bottom:6px">📄</div>
                <div style="font-weight:600">TAX INVOICE</div>
                <div style="font-size:var(--fs-xs);color:var(--t3)">Pro Bros · INV1052323</div>
                <div style="font-size:16px;font-weight:700;margin-top:6px">$303.20</div>
                <div style="display:flex;gap:6px;justify-content:center;margin-top:10px">
                  <button class="bg" style="font-size:16px">🔍</button>
                  <button class="bg" style="font-size:16px">↻</button>
                  <button class="bg" style="font-size:16px">⬇</button>
                  <button class="bg" style="font-size:16px">🖨</button>
                </div>
              </div>
            </div>

            <!-- Right: AI-filled form -->
            <div style="padding:16px;overflow-y:auto">
              <div style="background:var(--acc2);border-radius:var(--rd);padding:6px 8px;font-size:var(--fs-xs);color:var(--acc);margin-bottom:10px">
                AI filled fields highlighted in purple. Check & confirm.
              </div>

              <div class="fg">
                <label class="lb">Supplier</label>
                <input class="inp" value="Pro Bros Providore" style="background:var(--acc2);border-color:var(--acc)">
              </div>
              <div class="fa">✓ Vendor Rule: COGs → Food · Mango Coco · Self · 14 days</div>

              <div class="fr">
                <div class="fg"><label class="lb">Supplier Inv No</label><input class="inp" value="INV1052323" style="background:var(--acc2);border-color:var(--acc)"></div>
                <div class="fg"><label class="lb">Bill Number *</label><input class="inp" value="${esc(MOCK.nextBillNo)}" readonly style="background:var(--bg3);color:var(--t3)"></div>
              </div>
              <div class="fr">
                <div class="fg"><label class="lb">Issue Date *</label><input class="inp" type="date" value="2026-03-10"></div>
                <div class="fg"><label class="lb">Due Date *</label><input class="inp" type="date" value="2026-03-24"></div>
              </div>
              <div class="fr">
                <div class="fg"><label class="lb">Accrual Month</label><input class="inp" type="month" value="2026-03"></div>
                <div class="fg"><label class="lb">Transaction Type</label><select class="inp"><option>Expense / Bill</option><option>Asset Purchase</option></select></div>
              </div>

              <!-- Allocation divider -->
              <div style="display:flex;align-items:center;margin:8px 0">
                <hr style="border:none;border-top:1px solid #eee;flex:1">
                <div style="padding:0 6px;font-size:var(--fs-xs);color:var(--t4)">Allocation Layout</div>
                <button class="bg" style="font-size:14px;color:var(--acc)">⚙</button>
              </div>

              <!-- Single line item -->
              <table style="width:100%;border-collapse:collapse;font-size:var(--fs-sm);margin-top:4px">
                <thead><tr>
                  <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">Description</th>
                  <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">Category *</th>
                  <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">Amount *</th>
                  <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">GST</th>
                  <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">Tax code</th>
                </tr></thead>
                <tbody><tr>
                  <td style="padding:0;border:1px solid #e5e7eb"><div contenteditable style="padding:6px 8px;min-height:30px;font-size:var(--fs-sm);outline:none"></div></td>
                  <td style="padding:0;border:1px solid #e5e7eb"><select style="width:100%;padding:6px;border:none;font-size:var(--fs-xs)">${catOpts}</select></td>
                  <td style="padding:0;border:1px solid #e5e7eb"><input style="width:100%;padding:6px;border:none;text-align:right;font-size:var(--fs-sm);font-weight:600;background:var(--acc2)" value="303.20"></td>
                  <td style="padding:0;border:1px solid #e5e7eb;background:#fafafa"><input readonly style="width:100%;padding:6px;border:none;text-align:right;font-size:var(--fs-sm);background:#fafafa;color:var(--t3)" value="0.00"></td>
                  <td style="padding:0;border:1px solid #e5e7eb"><select style="width:100%;padding:6px;border:none;font-size:var(--fs-xs)"><option>FRE</option>${tcOpts}</select></td>
                </tr></tbody>
              </table>

              <div class="fg" style="margin-top:8px"><label class="lb">Notes</label><textarea class="inp" style="min-height:40px;resize:vertical;font-size:var(--fs-sm)"></textarea></div>

              <div style="text-align:right;font-size:var(--fs-body);margin:6px 0">
                <div>Subtotal <b>$303.20</b></div>
                <div>Tax <b>$0.00</b></div>
                <div style="font-weight:700;margin-top:4px">Total <b>$303.20</b></div>
              </div>

              <div style="display:flex;gap:6px;margin-top:8px">
                <button class="btn bo" onclick="App.go('tx_bill')">Cancel</button>
                <button class="btn bo">Save and... ▾</button>
                <button class="bs" onclick="ScrInput._saveUploadBill(this)">Save</button>
              </div>
            </div>
          </div>
        </div>`,
    };
  }

  function _saveUploadBill(btnEl) {
    guardedSave(btnEl, () => {
      App.toast('Bill created from upload');
      App.go('tx_bill');
    });
  }

  // ══════════════════════════════════════════
  // 7. IMPORT
  // ══════════════════════════════════════════
  function renderImport() {
    return {
      tb: '<div class="tb"><div class="tb-t">Import</div></div>',
      ct: `
        <div class="card" style="max-width:720px;margin:0 auto">
          <div style="display:flex;gap:6px;margin-bottom:10px">
            <select class="fl" style="padding:6px 10px">
              <option>Invoices / Bills</option><option>Bank Statement</option>
              <option>MYOB Export</option><option>Payroll CSV</option>
            </select>
            <button class="btn bo">Download template</button>
          </div>
          <div style="border:2px dashed var(--bd);border-radius:10px;padding:16px;text-align:center">
            <div style="font-size:18px;color:var(--t4)">📋</div>
            <div style="font-size:var(--fs-sm);color:var(--t3)">Drop CSV/Excel here, or <a style="color:var(--acc);font-weight:600;cursor:pointer">browse</a></div>
          </div>
        </div>

        <!-- Preview table (mock data) -->
        <div class="card" style="max-width:720px;margin:0 auto;padding:0;overflow:hidden">
          <div style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--bg2);border-bottom:1px solid var(--bd2);font-size:var(--fs-xs)">
            <b>invoices_mar.csv</b>
            <div>
              <span style="color:var(--g);font-weight:600">✓43</span>
              <span style="color:var(--o);font-weight:600">⚠2</span>
              <span style="color:var(--r);font-weight:600">✗3</span>
            </div>
          </div>
          <table class="tbl" style="margin:0">
            <thead><tr><th></th><th>Date</th><th>Supplier</th><th>Invoice</th><th style="text-align:right">Amount</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td style="color:var(--g)">✓</td><td>09/03</td><td>Pro Bros</td><td>INV1050790</td><td style="text-align:right">190.55</td><td><span class="sts sts-c" style="font-size:9px">Ready</span></td></tr>
              <tr><td style="color:var(--o)">⚠</td><td>08/03</td><td>Unknown Vendor</td><td>INV9999</td><td style="text-align:right">55.00</td><td><span class="sts sts-p" style="font-size:9px">Warning</span></td></tr>
              <tr><td style="color:var(--r)">✗</td><td></td><td></td><td></td><td style="text-align:right"></td><td><span class="sts sts-r" style="font-size:9px">Error</span></td></tr>
            </tbody>
          </table>
        </div>
        <div style="text-align:right;margin:8px auto;max-width:720px">
          <button class="bs" onclick="ScrInput._saveImport(this)">Import 45 transactions</button>
        </div>`,
    };
  }

  function _saveImport(btnEl) {
    guardedSave(btnEl, () => {
      App.toast('45 transactions imported');
    });
  }

  // ══════════════════════════════════════════
  // REGISTER ROUTES
  // ══════════════════════════════════════════
  App.registerRoutes({
    cr_sale:      { render: renderCreateSale },
    cr_transfer:  { render: renderCreateTransfer },
    cr_debit:     { render: renderCreateDebit },
    cr_bill:      { render: renderCreateBill },
    cr_recurring: { render: renderCreateRecurring },
    cr_upload:    { render: renderCreateUpload },
    cr_import:    { render: renderImport },
  });

  // ══════════════════════════════════════════
  // PUBLIC API — functions called from onclick
  // ══════════════════════════════════════════
  window.ScrInput = {
    // P2a
    _calcSaleGST,
    _saveSale,
    _pickTransferType,
    _updateTransferBal,
    _saveTransfer,
    _saveDebit,
    // P2b — shared
    _toggleTaxDD,
    _pickTaxCode,
    _toggleAllocPopup,
    _setAllocMode,
    // P2b — bill
    _addBillRow,
    _removeBillRow,
    _recalcBillRow,
    _recalcBillBalance,
    _toggleSaveDD,
    _saveBill,
    // P2c
    _saveRecurring,
    _saveUploadBill,
    _saveImport,
  };

})();
