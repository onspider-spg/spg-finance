/** Version 1.1 | 12 MAR 2026 | Siam Palette Group | Created 12 MAR 2026 */
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
  // REGISTER ROUTES
  // ══════════════════════════════════════════
  App.registerRoutes({
    cr_sale:     { render: renderCreateSale },
    cr_transfer: { render: renderCreateTransfer },
    cr_debit:    { render: renderCreateDebit },
  });

  // ══════════════════════════════════════════
  // PUBLIC API — functions called from onclick
  // ══════════════════════════════════════════
  window.ScrInput = {
    _calcSaleGST,
    _saveSale,
    _pickTransferType,
    _updateTransferBal,
    _saveTransfer,
    _saveDebit,
  };

})();
