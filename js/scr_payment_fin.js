/** Version 1.0 | 14 MAR 2026 | Siam Palette Group */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_payment_fin.js
 * Payment: Record Payment, Payment History, Remittance Advice
 * Lazy-loaded by app_fin.js on first visit to py_* routes
 * ═══════════════════════════════════════════
 */

(() => {
  const esc = App.esc;
  const fm = App.formatMoney;
  const fd = App.formatDate;

  // ── Local state ──
  let _pyType = 'bills';        // bills | emp | super | payg
  let _pyBills = [];             // unpaid bills for selection
  let _pySelected = new Set();   // selected bill IDs
  let _pyBankId = '';
  let _pySaving = false;

  let _phType = 'all';           // all | bills | emp | super | payg
  let _phRows = [];
  let _phKpi = {};
  let _phFilters = {};

  let _remitRows = [];
  let _remitFilter = 'todo';     // todo | sent | all

  // ══════════════════════════════════════════
  // SHARED HELPERS
  // ══════════════════════════════════════════
  function _skeleton(cols) {
    return `<tr><td colspan="${cols}" style="text-align:center;padding:20px;color:var(--t3)"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</td></tr>`;
  }

  function _today() { return new Date().toISOString().substring(0, 10); }

  function _bankOptions() {
    return (App.S.bankAccounts || []).map(b =>
      `<option value="${esc(b.id)}">${esc(b.account_name || b.name)} #${esc(b.account_number || '')}</option>`
    ).join('');
  }

  function _brandOptions() {
    return '<option value="">All Brands</option>' + (App.S.brands || []).map(b =>
      `<option value="${esc(b.brand_id || b.id)}">${esc(b.brand_name || b.name)}</option>`
    ).join('');
  }

  // ══════════════════════════════════════════
  // 1. RECORD PAYMENT (py_record) — 4 tabs: Bills / Employees / Super / PAYG
  // ══════════════════════════════════════════
  function renderRecord() {
    return {
      tb: '<div class="tb"><div class="tb-t">Record Payment</div></div>',
      ct: `<div style="max-width:1000px;margin:0 auto">
        <!-- Top filters -->
        <div class="card">
          <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
            <div>
              <div class="lb">Payment type</div>
              <select class="fl" style="font-weight:600" id="py_type" onchange="ScrPayment._switchType(this.value)">
                <option value="bills">Pay Bills</option>
                <option value="emp">Pay Employees</option>
                <option value="super">Pay Super (ATO)</option>
                <option value="payg">Pay PAYG (ATO)</option>
              </select>
            </div>
            <div>
              <div class="lb">Brand</div>
              <select class="fl" id="py_brand" onchange="ScrPayment._reloadItems()">${_brandOptions()}</select>
            </div>
            <div>
              <div class="lb">From</div>
              <input class="fl" type="date" id="py_from" style="padding:6px 10px">
            </div>
            <div>
              <div class="lb">To</div>
              <input class="fl" type="date" id="py_to" value="${_today()}" style="padding:6px 10px">
            </div>
            <div style="flex:1"></div>
            <a class="lk" onclick="ScrPayment._resetFilters()">Reset</a>
          </div>
        </div>

        <!-- Bank + Reference card -->
        <div class="card">
          <div style="display:flex;gap:20px;flex-wrap:wrap">
            <div style="flex:1;min-width:250px">
              <div class="fg">
                <label class="lb">Bank account *</label>
                <select class="inp" id="py_bank" style="max-width:300px">${_bankOptions()}</select>
              </div>
              <div style="display:flex;justify-content:space-between;max-width:300px;margin-bottom:10px">
                <span style="font-size:var(--fs-sm);font-weight:600">Balance</span>
                <span style="font-size:var(--fs-sm);font-weight:700" id="py_balance">—</span>
              </div>
              <div class="fg">
                <label class="lb">Description of transaction</label>
                <input class="inp" id="py_desc" value="Electronic Payment" style="max-width:300px">
              </div>
            </div>
            <div style="min-width:250px">
              <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-bottom:10px">
                <span class="lb" style="margin:0;white-space:nowrap">Reference *</span>
                <input class="inp" id="py_ref" style="width:160px;text-align:right">
              </div>
              <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-bottom:10px">
                <span class="lb" style="margin:0;white-space:nowrap">Date *</span>
                <input class="inp" type="date" id="py_date" value="${_today()}" style="width:160px">
              </div>
            </div>
          </div>
        </div>

        <!-- Bills table (shown for "bills" type) -->
        <div id="py_items_bills">
          <div class="card" style="padding:0;overflow:hidden">
            <table class="tbl"><thead><tr>
              <th style="width:30px"><input type="checkbox" id="py_checkall" onchange="ScrPayment._toggleAll(this.checked)"></th>
              <th>Date</th><th>Bill no</th><th>Supplier</th><th>Supplier inv no</th>
              <th style="text-align:right">Balance due</th>
              <th style="text-align:right">Discount</th>
              <th style="text-align:right">Amount paid</th>
            </tr></thead>
            <tbody id="py_bills_body">${_skeleton(8)}</tbody>
            </table>
            <div style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--bd)">
              <span style="font-size:var(--fs-xs);color:var(--t3)" id="py_bills_count">0 bills</span>
              <div style="font-size:var(--fs-h1);font-weight:700" id="py_bills_total">Total $0.00</div>
            </div>
          </div>
        </div>

        <!-- Placeholder for emp/super/payg types -->
        <div id="py_items_other" style="display:none">
          <div class="card" style="text-align:center;padding:30px;color:var(--t3)">
            Employee / Super / PAYG payment — available after Payroll module (E6a)
          </div>
        </div>

        <!-- Remittance option -->
        <div class="card" id="py_remit_sec">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <input type="checkbox" id="py_send_remit" checked style="accent-color:var(--acc)">
            <span style="font-size:var(--fs-sm)">Send remittance advice</span>
          </div>
        </div>

        <!-- Action buttons -->
        <div style="display:flex;justify-content:flex-end;gap:6px">
          <button class="btn bo" onclick="App.go('py_history')">Cancel</button>
          <button class="bs" id="py_save_btn" onclick="ScrPayment._savePayment()">Save</button>
        </div>
      </div>`,
    };
  }

  async function onLoadRecord() {
    _pyType = 'bills';
    _pySelected = new Set();
    _pySaving = false;
    await _loadUnpaidBills();
    _renderBillsTable();
    _loadNextRef();
  }

  async function _loadUnpaidBills() {
    try {
      App.showLoader();
      const brand = document.getElementById('py_brand')?.value || '';
      const data = await API.call('fin_get_unpaid_for_payment', {
        payment_type: _pyType,
        brand: brand || undefined,
      });
      _pyBills = data.bills || [];
    } catch (e) {
      console.warn('Load unpaid bills failed:', e.message);
      // Fallback to existing getUnpaidBills
      try {
        const bills = await API.getUnpaidBills();
        _pyBills = Array.isArray(bills) ? bills : [];
      } catch (e2) {
        _pyBills = [];
      }
    } finally {
      App.hideLoader();
    }
  }

  async function _loadNextRef() {
    try {
      const data = await API.call('fin_get_next_payment_ref', { payment_type: _pyType });
      const refEl = document.getElementById('py_ref');
      if (refEl && data.ref) refEl.value = data.ref;
    } catch (e) { /* silent — user can type manually */ }
  }

  function _renderBillsTable() {
    const tbody = document.getElementById('py_bills_body');
    if (!tbody) return;

    if (_pyBills.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--t3)">No unpaid bills found</td></tr>`;
      _updateBillsTotal();
      return;
    }

    // Auto-select all
    _pyBills.forEach(b => _pySelected.add(b.id));

    tbody.innerHTML = _pyBills.map(b => {
      const isCredit = (b.balance || 0) < 0;
      const rowBg = isCredit ? 'background:var(--bbg)' : '';
      const textColor = isCredit ? 'color:var(--b)' : '';
      const checked = _pySelected.has(b.id) ? 'checked' : '';

      return `<tr style="${rowBg}">
        <td><input type="checkbox" ${checked} style="accent-color:${isCredit ? 'var(--b)' : 'var(--acc)'}" onchange="ScrPayment._toggleBill('${b.id}',this.checked)"></td>
        <td style="${textColor}">${fd(b.date || b.transaction_date)}</td>
        <td><a class="lk" ${textColor ? 'style="' + textColor + '"' : ''} onclick="App.go('tx_bill_detail',{id:'${b.id}'})">${esc(b.ref || b.reference_no || '')}</a></td>
        <td style="${textColor}">${esc(b.vendor_name || b.payee || '')}</td>
        <td style="${textColor}">${esc(b.supplier_inv || b.external_ref || '')}</td>
        <td style="text-align:right;${textColor}">${fm(Math.abs(b.balance || 0))}</td>
        <td style="text-align:right"><input style="width:55px;text-align:right;padding:3px 5px;border:1px solid var(--bd);border-radius:4px;font-size:var(--fs-xs)" value="0.00" data-bill="${b.id}" data-field="discount" onchange="ScrPayment._updateBillsTotal()"></td>
        <td style="text-align:right;${textColor};font-weight:600"><input style="width:70px;text-align:right;padding:3px 5px;border:1px solid var(--bd);border-radius:4px;font-size:var(--fs-sm);font-weight:600" value="${Math.abs(b.balance || 0).toFixed(2)}" data-bill="${b.id}" data-field="amount" onchange="ScrPayment._updateBillsTotal()"></td>
      </tr>`;
    }).join('');

    _updateBillsTotal();
  }

  function _toggleBill(id, checked) {
    if (checked) _pySelected.add(id);
    else _pySelected.delete(id);
    _updateBillsTotal();
  }

  function _toggleAll(checked) {
    _pyBills.forEach(b => {
      if (checked) _pySelected.add(b.id);
      else _pySelected.delete(b.id);
    });
    document.querySelectorAll('#py_bills_body input[type="checkbox"]').forEach(cb => cb.checked = checked);
    _updateBillsTotal();
  }

  function _updateBillsTotal() {
    let total = 0;
    let count = 0;
    _pySelected.forEach(id => {
      const amtInput = document.querySelector(`input[data-bill="${id}"][data-field="amount"]`);
      const discInput = document.querySelector(`input[data-bill="${id}"][data-field="discount"]`);
      if (amtInput) {
        total += parseFloat(amtInput.value) || 0;
        total -= parseFloat(discInput?.value) || 0;
        count++;
      }
    });
    const countEl = document.getElementById('py_bills_count');
    const totalEl = document.getElementById('py_bills_total');
    if (countEl) countEl.textContent = `${count} bill${count !== 1 ? 's' : ''}`;
    if (totalEl) totalEl.textContent = 'Total ' + fm(total);
  }

  function _switchType(type) {
    _pyType = type;
    const billsDiv = document.getElementById('py_items_bills');
    const otherDiv = document.getElementById('py_items_other');
    if (type === 'bills') {
      if (billsDiv) billsDiv.style.display = '';
      if (otherDiv) otherDiv.style.display = 'none';
      _reloadItems();
    } else {
      if (billsDiv) billsDiv.style.display = 'none';
      if (otherDiv) otherDiv.style.display = '';
    }
    _loadNextRef();
  }

  async function _reloadItems() {
    await _loadUnpaidBills();
    _renderBillsTable();
  }

  function _resetFilters() {
    const brand = document.getElementById('py_brand');
    const from = document.getElementById('py_from');
    const to = document.getElementById('py_to');
    if (brand) brand.value = '';
    if (from) from.value = '';
    if (to) to.value = _today();
    _reloadItems();
  }

  async function _savePayment() {
    if (_pySaving) return;

    const ref = document.getElementById('py_ref')?.value.trim();
    const date = document.getElementById('py_date')?.value;
    const bankId = document.getElementById('py_bank')?.value;
    const desc = document.getElementById('py_desc')?.value.trim();
    const sendRemit = document.getElementById('py_send_remit')?.checked;

    if (!ref) return App.toast('Reference is required');
    if (!date) return App.toast('Date is required');
    if (_pySelected.size === 0) return App.toast('Select at least one bill');

    // Build allocations
    const allocations = [];
    let totalAmount = 0;
    let totalDiscount = 0;

    _pySelected.forEach(id => {
      const bill = _pyBills.find(b => b.id === id);
      const amtInput = document.querySelector(`input[data-bill="${id}"][data-field="amount"]`);
      const discInput = document.querySelector(`input[data-bill="${id}"][data-field="discount"]`);
      const amount = parseFloat(amtInput?.value) || 0;
      const discount = parseFloat(discInput?.value) || 0;
      allocations.push({
        transaction_id: id,
        payee_name: bill?.vendor_name || bill?.payee || '',
        reference: bill?.ref || bill?.reference_no || '',
        amount_paid: amount,
        discount: discount,
      });
      totalAmount += amount;
      totalDiscount += discount;
    });

    _pySaving = true;
    const btn = document.getElementById('py_save_btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    try {
      App.showLoader();
      await API.call('fin_record_payment', {
        payment_ref: ref,
        payment_type: _pyType,
        payment_date: date,
        description: desc,
        bank_account_id: bankId || null,
        brand_id: document.getElementById('py_brand')?.value || null,
        total_amount: totalAmount,
        total_discount: totalDiscount,
        net_amount: totalAmount - totalDiscount,
        send_remittance: sendRemit,
        allocations,
      });
      App.toast('Payment recorded');
      App.go('py_history');
    } catch (e) {
      App.toast('Error: ' + e.message, 2000);
    } finally {
      _pySaving = false;
      App.hideLoader();
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
    }
  }

  // ══════════════════════════════════════════
  // 2. PAYMENT HISTORY (py_history) — KPI + filter + expandable rows
  // ══════════════════════════════════════════
  function renderHistory() {
    return {
      tb: '<div class="tb"><div class="tb-t">Payment History</div><button class="bs" onclick="App.go(\'py_record\')">+ Record Payment</button></div>',
      ct: `<div style="max-width:1060px;margin:0 auto">
        <!-- Filters -->
        <div class="card">
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
            <div>
              <div class="lb">Payment Type</div>
              <select class="fl" style="font-weight:600" id="ph_type" onchange="ScrPayment._filterHistory()">
                <option value="all">All Types</option>
                <option value="bills">Pay Bills</option>
                <option value="emp">Pay Employees</option>
                <option value="super">Pay Super (ATO)</option>
                <option value="payg">Pay PAYG (ATO)</option>
              </select>
            </div>
            <div>
              <div class="lb">Payee</div>
              <select class="fl" id="ph_payee" style="width:150px" onchange="ScrPayment._filterHistory()"><option value="">All</option></select>
            </div>
            <div>
              <div class="lb">Brand</div>
              <select class="fl" id="ph_brand" style="width:120px" onchange="ScrPayment._filterHistory()">${_brandOptions()}</select>
            </div>
            <div>
              <div class="lb">Bank Account</div>
              <select class="fl" id="ph_bank" style="width:150px" onchange="ScrPayment._filterHistory()">
                <option value="">All</option>${_bankOptions()}
              </select>
            </div>
            <div>
              <div class="lb">Date from</div>
              <input class="fl" type="date" id="ph_from" style="width:125px" onchange="ScrPayment._filterHistory()">
            </div>
            <div>
              <div class="lb">Date to</div>
              <input class="fl" type="date" id="ph_to" value="${_today()}" style="width:125px" onchange="ScrPayment._filterHistory()">
            </div>
            <div style="flex:1"></div>
            <button class="bg" style="color:var(--acc)" onclick="ScrPayment._resetHistoryFilters()">Reset</button>
          </div>
        </div>

        <!-- KPI bar -->
        <div style="display:flex;gap:8px;margin-bottom:10px" id="ph_kpi">
          <div class="card" style="flex:1;margin:0;text-align:center;padding:8px">
            <div style="font-size:var(--fs-xs);color:var(--t3)">Total Paid</div>
            <div style="font-size:var(--fs-kpi-md);font-weight:700" id="ph_kpi_total">—</div>
          </div>
          <div class="card" style="flex:1;margin:0;text-align:center;padding:8px;cursor:pointer" onclick="ScrPayment._setHistType('bills')">
            <div style="font-size:var(--fs-xs);color:var(--t3)">Bills</div>
            <div style="font-size:var(--fs-kpi-md);font-weight:700" id="ph_kpi_bills">—</div>
            <div style="font-size:var(--fs-xxs);color:var(--t3)" id="ph_kpi_bills_ct"></div>
          </div>
          <div class="card" style="flex:1;margin:0;text-align:center;padding:8px;cursor:pointer" onclick="ScrPayment._setHistType('emp')">
            <div style="font-size:var(--fs-xs);color:var(--t3)">Wages</div>
            <div style="font-size:var(--fs-kpi-md);font-weight:700" id="ph_kpi_emp">—</div>
            <div style="font-size:var(--fs-xxs);color:var(--t3)" id="ph_kpi_emp_ct"></div>
          </div>
          <div class="card" style="flex:1;margin:0;text-align:center;padding:8px;cursor:pointer" onclick="ScrPayment._setHistType('super')">
            <div style="font-size:var(--fs-xs);color:var(--t3)">Super</div>
            <div style="font-size:var(--fs-kpi-md);font-weight:700" id="ph_kpi_super">—</div>
          </div>
          <div class="card" style="flex:1;margin:0;text-align:center;padding:8px;cursor:pointer" onclick="ScrPayment._setHistType('payg')">
            <div style="font-size:var(--fs-xs);color:var(--t3)">PAYG</div>
            <div style="font-size:var(--fs-kpi-md);font-weight:700" id="ph_kpi_payg">—</div>
          </div>
        </div>

        <!-- History table -->
        <div class="card" style="padding:0;overflow:hidden">
          <table class="tbl"><thead><tr>
            <th style="width:24px"></th><th>Date</th><th>Ref</th><th>Type</th>
            <th>Payee</th><th>Brand</th><th>Bank</th>
            <th style="text-align:right">Amount ($)</th><th>Items</th>
          </tr></thead>
          <tbody id="ph_body">${_skeleton(9)}</tbody>
          </table>
        </div>
      </div>`,
    };
  }

  async function onLoadHistory() {
    try {
      App.showLoader();
      const data = await API.call('fin_get_payment_history', {
        date_from: document.getElementById('ph_from')?.value || undefined,
        date_to: document.getElementById('ph_to')?.value || undefined,
      });
      _phRows = data.payments || [];
      _phKpi = data.kpi || {};
      _updateHistoryKpi();
      _renderHistoryRows();

      // Populate payee filter
      _populatePayeeFilter();
    } catch (e) {
      console.warn('Load payment history failed:', e.message);
    } finally {
      App.hideLoader();
    }
  }

  function _updateHistoryKpi() {
    const k = _phKpi;
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setText('ph_kpi_total', fm(k.total || 0));
    setText('ph_kpi_bills', fm(k.bills_total || 0));
    setText('ph_kpi_bills_ct', k.bills_count ? k.bills_count + ' payments' : '');
    setText('ph_kpi_emp', fm(k.emp_total || 0));
    setText('ph_kpi_emp_ct', k.emp_count ? k.emp_count + ' pay' : '');
    setText('ph_kpi_super', fm(k.super_total || 0));
    setText('ph_kpi_payg', fm(k.payg_total || 0));
  }

  function _renderHistoryRows() {
    const tbody = document.getElementById('ph_body');
    if (!tbody) return;

    // Apply client-side filters
    let rows = _phRows;
    const typeFilter = document.getElementById('ph_type')?.value || 'all';
    const payeeFilter = document.getElementById('ph_payee')?.value || '';
    const brandFilter = document.getElementById('ph_brand')?.value || '';
    const bankFilter = document.getElementById('ph_bank')?.value || '';

    if (typeFilter !== 'all') rows = rows.filter(r => r.payment_type === typeFilter);
    if (payeeFilter) rows = rows.filter(r => (r.payee_display || '').includes(payeeFilter));
    if (brandFilter) rows = rows.filter(r => r.brand_id === brandFilter);
    if (bankFilter) rows = rows.filter(r => r.bank_account_id === bankFilter);

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--t3)">No payment records found</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r, idx) => {
      // Type badge
      const typeBadges = {
        bills: '<span class="sts sts-c" style="font-size:var(--fs-xs)">Bill</span>',
        emp: '<span class="sts sts-d" style="font-size:var(--fs-xs)">Wage</span>',
        super: '<span class="sts sts-o" style="font-size:var(--fs-xs)">Super</span>',
        payg: '<span class="sts sts-r" style="font-size:var(--fs-xs)">PAYG</span>',
      };

      const allocs = r.allocations || [];
      const hasAllocs = allocs.length > 0;
      const expandId = 'ph_exp_' + idx;

      // Parent row
      let html = `<tr style="background:var(--bg2);cursor:pointer" onclick="ScrPayment._toggleExpand('${expandId}')">
        <td style="color:var(--acc)">${hasAllocs ? '▶' : ''}</td>
        <td>${fd(r.payment_date)}</td>
        <td><a class="lk">${esc(r.payment_ref)}</a></td>
        <td>${typeBadges[r.payment_type] || esc(r.payment_type)}</td>
        <td>${esc(r.payee_display || '—')}</td>
        <td>${esc(r.brand_name || '—')}</td>
        <td style="font-size:var(--fs-xs)">${esc(r.bank_display || '—')}</td>
        <td style="text-align:right;font-weight:600">${fm(r.net_amount || r.total_amount || 0)}</td>
        <td>${allocs.length > 0 ? allocs.length + ' bill' + (allocs.length > 1 ? 's' : '') : '—'}</td>
      </tr>`;

      // Child rows (hidden by default)
      allocs.forEach(a => {
        const isCredit = (a.amount_paid || 0) < 0;
        html += `<tr class="${expandId}" style="display:none${isCredit ? ';background:rgba(37,99,235,.04)' : ''}">
          <td></td>
          <td style="padding-left:20px;font-size:var(--fs-xs);color:var(--t3)">${fd(r.payment_date)}</td>
          <td><a class="lk" style="font-size:var(--fs-xs)${isCredit ? ';color:var(--b)' : ''}">${esc(a.reference || '—')}</a></td>
          <td></td>
          <td style="font-size:var(--fs-xs)${isCredit ? ';color:var(--b)' : ''}">${esc(a.payee_name || '')}</td>
          <td></td><td></td>
          <td style="text-align:right;font-size:var(--fs-xs)${isCredit ? ';color:var(--b);font-weight:600' : ''}">${isCredit ? '-' : ''}${fm(Math.abs(a.amount_paid || 0))}</td>
          <td>${isCredit ? '<span class="sts sts-d" style="font-size:var(--fs-xxs)">Credit</span>' : '<span class="sts sts-c" style="font-size:var(--fs-xxs)">Closed</span>'}</td>
        </tr>`;
      });

      return html;
    }).join('');
  }

  function _toggleExpand(cls) {
    document.querySelectorAll('.' + cls).forEach(el => {
      el.style.display = el.style.display === 'none' ? 'table-row' : 'none';
    });
  }

  function _setHistType(type) {
    const sel = document.getElementById('ph_type');
    if (sel) sel.value = type;
    _filterHistory();
  }

  function _filterHistory() {
    _renderHistoryRows();
  }

  function _resetHistoryFilters() {
    ['ph_type', 'ph_payee', 'ph_brand', 'ph_bank'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = el.options ? el.options[0].value : '';
    });
    const from = document.getElementById('ph_from');
    const to = document.getElementById('ph_to');
    if (from) from.value = '';
    if (to) to.value = _today();
    onLoadHistory();
  }

  function _populatePayeeFilter() {
    const sel = document.getElementById('ph_payee');
    if (!sel) return;
    const payees = [...new Set(_phRows.map(r => r.payee_display).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">All</option>' + payees.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  }

  // ══════════════════════════════════════════
  // 3. REMITTANCE ADVICE (py_remit)
  // ══════════════════════════════════════════
  function renderRemittance() {
    return {
      tb: '<div class="tb"><div class="tb-t">Remittance Advice</div></div>',
      ct: `<div class="card" style="max-width:1000px;margin:0 auto">
        <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:10px;flex-wrap:wrap">
          <div>
            <div class="lb">Status</div>
            <select class="fl" id="rm_status" style="width:80px" onchange="ScrPayment._filterRemit()">
              <option value="todo">To do</option><option value="sent">Sent</option><option value="all">All</option>
            </select>
          </div>
          <div>
            <div class="lb">Supplier</div>
            <select class="fl" id="rm_supplier" style="width:140px" onchange="ScrPayment._filterRemit()"><option value="">All</option></select>
          </div>
          <div>
            <div class="lb">Bills paid from</div>
            <input class="fl" type="date" id="rm_from" style="width:130px" onchange="ScrPayment._filterRemit()">
          </div>
          <div>
            <div class="lb">Bills paid to</div>
            <input class="fl" type="date" id="rm_to" value="${_today()}" style="width:130px" onchange="ScrPayment._filterRemit()">
          </div>
          <div>
            <div class="lb">Search</div>
            <input class="fl" id="rm_search" placeholder="" style="width:100px" oninput="ScrPayment._filterRemit()">
          </div>
          <div style="flex:1"></div>
          <button class="bg" style="color:var(--acc)" onclick="ScrPayment._resetRemitFilters()">Reset</button>
        </div>
        <table class="tbl"><thead><tr>
          <th style="width:30px"><input type="checkbox" id="rm_checkall" onchange="ScrPayment._toggleRemitAll(this.checked)"></th>
          <th>Payment Date</th><th>Reference no.</th><th>Supplier</th>
          <th>Email</th><th style="text-align:right">Amount paid ($)</th>
        </tr></thead>
        <tbody id="rm_body">${_skeleton(6)}</tbody>
        </table>
        <div style="margin-top:10px;display:flex;gap:6px">
          <button class="bs" onclick="ScrPayment._sendRemittance()">Send selected</button>
          <button class="btn bo" onclick="ScrPayment._downloadRemitPdf()">Download PDF</button>
        </div>
      </div>`,
    };
  }

  async function onLoadRemittance() {
    try {
      App.showLoader();
      const data = await API.call('fin_get_remittance_list', {});
      _remitRows = data.remittances || [];
      _renderRemitRows();
      _populateRemitSupplier();
    } catch (e) {
      console.warn('Load remittance failed:', e.message);
    } finally {
      App.hideLoader();
    }
  }

  function _renderRemitRows() {
    const tbody = document.getElementById('rm_body');
    if (!tbody) return;

    let rows = _remitRows;
    const status = document.getElementById('rm_status')?.value || 'todo';
    const supplier = document.getElementById('rm_supplier')?.value || '';
    const search = (document.getElementById('rm_search')?.value || '').toLowerCase();

    if (status === 'todo') rows = rows.filter(r => !r.remittance_sent);
    else if (status === 'sent') rows = rows.filter(r => r.remittance_sent);
    if (supplier) rows = rows.filter(r => r.payee_display === supplier);
    if (search) rows = rows.filter(r => (r.payee_display || '').toLowerCase().includes(search) || (r.payment_ref || '').toLowerCase().includes(search));

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--t3)">No remittance advice ${status === 'todo' ? 'pending' : 'found'}</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => {
      return `<tr>
        <td><input type="checkbox" data-rmid="${r.id}" style="accent-color:var(--acc)"></td>
        <td>${fd(r.payment_date)}</td>
        <td><a class="lk">${esc(r.payment_ref)}</a></td>
        <td>${esc(r.payee_display || '—')}</td>
        <td style="font-size:var(--fs-xs)">${esc(r.payee_email || '')}</td>
        <td style="text-align:right">${fm(r.net_amount || 0)}</td>
      </tr>`;
    }).join('');
  }

  function _populateRemitSupplier() {
    const sel = document.getElementById('rm_supplier');
    if (!sel) return;
    const suppliers = [...new Set(_remitRows.map(r => r.payee_display).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">All</option>' + suppliers.map(s => `<option>${esc(s)}</option>`).join('');
  }

  function _filterRemit() { _renderRemitRows(); }

  function _resetRemitFilters() {
    ['rm_status', 'rm_supplier'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.selectedIndex = 0;
    });
    const from = document.getElementById('rm_from');
    const to = document.getElementById('rm_to');
    const search = document.getElementById('rm_search');
    if (from) from.value = '';
    if (to) to.value = _today();
    if (search) search.value = '';
    _renderRemitRows();
  }

  function _toggleRemitAll(checked) {
    document.querySelectorAll('#rm_body input[type="checkbox"]').forEach(cb => cb.checked = checked);
  }

  async function _sendRemittance() {
    const ids = [];
    document.querySelectorAll('#rm_body input[type="checkbox"]:checked').forEach(cb => {
      if (cb.dataset.rmid) ids.push(cb.dataset.rmid);
    });
    if (ids.length === 0) return App.toast('Select at least one to send');

    try {
      App.showLoader();
      await API.call('fin_send_remittance', { payment_ids: ids });
      App.toast('Remittance sent');
      await onLoadRemittance();
    } catch (e) {
      App.toast('Error: ' + e.message, 2000);
    } finally {
      App.hideLoader();
    }
  }

  function _downloadRemitPdf() {
    App.toast('Download PDF — coming soon');
  }

  // ══════════════════════════════════════════
  // REGISTER ROUTES
  // ══════════════════════════════════════════
  App.registerRoutes({
    py_record:  { render: renderRecord,     onLoad: onLoadRecord },
    py_history: { render: renderHistory,    onLoad: onLoadHistory },
    py_remit:   { render: renderRemittance, onLoad: onLoadRemittance },
  });

  // ══════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════
  window.ScrPayment = {
    _switchType,
    _reloadItems,
    _resetFilters,
    _toggleBill,
    _toggleAll,
    _updateBillsTotal,
    _savePayment,
    _toggleExpand,
    _setHistType,
    _filterHistory,
    _resetHistoryFilters,
    _filterRemit,
    _resetRemitFilters,
    _toggleRemitAll,
    _sendRemittance,
    _downloadRemitPdf,
  };

})();
