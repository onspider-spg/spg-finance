/** Version 1.5 | 14 MAR 2026 | Siam Palette Group */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_accounting_fin.js
 * Accounting screens: COA List, Create, Edit, Tax Codes,
 * Bank Rules, Banking Hub
 * ═══════════════════════════════════════════
 *
 * SCREENS:
 *   ac_coa        — Categories (Chart of Accounts) full list
 *   ac_coa_create — Create Category form
 *   ac_coa_edit   — Edit Category form (+ bank details if type=Bank)
 *   ac_tax        — Tax Codes list + inline edit
 *   ac_rules      — Bank Rules list + Create/Edit modal (E3a)
 *   ac_hub        — Banking Hub — accounts + balance overview (E3a)
 *
 * ALL screens connect to DB via API (no MOCK fallback needed).
 * Concurrency: 4 ACC simultaneous — list views always fresh, save has stale check.
 * ═══════════════════════════════════════════
 */

(() => {
  const esc = App.esc;
  const fm = App.formatMoney;

  // ── Local state ──
  let _coaRows = [];
  let _coaFilter = 'All';
  let _coaSearch = '';
  let _coaShowInactive = false;
  let _editingCat = null;  // category being edited (full object)
  let _taxRows = [];

  // Tab filter options — match transaction_type values in category_master
  const COA_TABS = ['All', 'Income', 'Expense', 'Asset Purchase', 'Transfer', 'Loan'];

  // ══════════════════════════════════════════
  // SHARED: Skeleton
  // ══════════════════════════════════════════
  function _skeleton(cols) {
    return `<tr><td colspan="${cols}" style="text-align:center;padding:20px;color:var(--t3)"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</td></tr>`;
  }

  // ══════════════════════════════════════════
  // 1. COA LIST — ★ CONNECTED TO DB
  // ══════════════════════════════════════════

  function renderCOA() {
    _coaFilter = 'All';
    _coaSearch = '';
    _coaShowInactive = false;
    return {
      tb: `<div class="tb"><div class="tb-t">Categories (Chart of Accounts)</div><div style="display:flex;gap:6px"><button class="btn bo" onclick="ScrAccounting._goLinked()">Edit linked</button><button class="bs" onclick="App.go('ac_coa_create')">Create category</button></div></div>`,
      ct: `<div style="max-width:1060px;margin:0 auto">
        <div id="coa_tabs" style="display:flex;gap:8px;margin-bottom:10px;border-bottom:2px solid var(--bd2);padding-bottom:0;flex-wrap:wrap"></div>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
          <input class="fl" id="coa_search" placeholder="Search..." style="width:180px;padding:6px 10px" oninput="ScrAccounting._onSearch(this.value)">
          <label style="font-size:var(--fs-xs);color:var(--t3);display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="coa_inactive" onchange="ScrAccounting._toggleInactive(this.checked)"> Show inactive</label>
          <div style="flex:1"></div>
          <a class="lk" style="font-size:var(--fs-xs);cursor:pointer" onclick="ScrAccounting._resetCoaFilters()">Reset</a>
        </div>
        <div class="card" style="padding:0;overflow:hidden;margin:0">
          <table class="tbl" id="coa_tbl">
            <thead><tr>
              <th style="width:28px"><input type="checkbox" style="accent-color:var(--acc)" onclick="ScrAccounting._toggleAllCoa(this.checked)"></th>
              <th>Code</th><th>Name</th><th>Type</th><th>Tax</th><th>Linked</th><th>Level</th><th style="text-align:right">Balance ($)</th>
            </tr></thead>
            <tbody id="coa_tbody">${_skeleton(8)}</tbody>
          </table>
        </div>
        <div id="coa_count" style="font-size:var(--fs-xs);color:var(--t3);margin-top:6px"></div>
      </div>`,
    };
  }

  async function _loadCOA() {
    _buildCoaTabs();
    try {
      const result = await API.getCoa({
        type_filter: _coaFilter,
        search: _coaSearch,
        show_inactive: _coaShowInactive,
      });
      _coaRows = result.rows || [];
      _renderCoaRows();
    } catch (e) {
      const tbody = document.getElementById('coa_tbody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--r)">Error: ${esc(e.message)}</td></tr>`;
    }
  }

  function _buildCoaTabs() {
    const el = document.getElementById('coa_tabs');
    if (!el) return;
    el.innerHTML = COA_TABS.map(t =>
      `<div style="padding:6px 2px;font-size:var(--fs-sm);cursor:pointer;margin-bottom:-2px;${t === _coaFilter ? 'font-weight:600;color:var(--acc);border-bottom:2px solid var(--acc)' : 'color:var(--t3)'};margin-left:${t === 'All' ? '0' : '8px'}" onclick="ScrAccounting._setCoaTab('${t}')">${esc(t === 'All' ? 'All categories' : t)}</div>`
    ).join('');
  }

  function _renderCoaRows() {
    const tbody = document.getElementById('coa_tbody');
    const countEl = document.getElementById('coa_count');
    if (!tbody) return;

    if (_coaRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--t3)">No categories found</td></tr>';
      if (countEl) countEl.textContent = '0 categories';
      return;
    }

    // Group by main_category (P&L sections: Revenue, COGs, Payroll, etc.)
    let lastMain = '';
    let html = '';

    _coaRows.forEach(r => {
      const mainCat = r.main_category || r.transaction_type || 'Other';

      // Insert header row when main_category changes
      if (mainCat !== lastMain) {
        lastMain = mainCat;
        const groupTotal = _coaRows
          .filter(x => (x.main_category || x.transaction_type) === mainCat)
          .reduce((s, x) => s + (x.current_balance || 0), 0);
        html += `<tr style="background:var(--bg2)">
          <td></td>
          <td></td>
          <td style="font-weight:700;color:var(--acc);font-size:var(--fs-body)">${esc(mainCat)}</td>
          <td style="font-size:var(--fs-xs);color:var(--t3)">${esc(r.transaction_type)}</td>
          <td></td><td></td><td></td>
          <td style="text-align:right;font-weight:700">${fm(groupTotal)}</td>
        </tr>`;
      }

      const balColor = r.current_balance < 0 ? 'color:var(--r)' : '';
      const inactive = !r.is_active ? 'opacity:0.45' : '';
      const linked = r.is_linked ? `<span class="sts sts-p" style="font-size:9px">Linked</span>` : '';

      html += `<tr style="cursor:pointer;${inactive}" onclick="ScrAccounting._editCategory('${r.id}')">
        <td onclick="event.stopPropagation()"><input type="checkbox" data-coa-id="${r.id}" style="accent-color:var(--acc)"></td>
        <td>${esc(r.account_code || '')}</td>
        <td style="padding-left:24px"><a class="lk">${esc(r.sub_category)}</a></td>
        <td style="font-size:var(--fs-xs)">${esc(r.transaction_type)}</td>
        <td>${esc(r.tax_code || '')}</td>
        <td>${linked}</td>
        <td style="font-size:var(--fs-xxs);color:var(--t3)">Level ${r.level || 2}</td>
        <td style="text-align:right;${balColor}">${fm(r.current_balance || 0)}</td>
      </tr>`;
    });

    tbody.innerHTML = html;
    if (countEl) countEl.textContent = `Showing ${_coaRows.length} categories`;
  }

  function _setCoaTab(t) {
    _coaFilter = t;
    _loadCOA();
  }

  function _onSearch(v) {
    _coaSearch = v;
    // Debounce 300ms
    clearTimeout(_onSearch._t);
    _onSearch._t = setTimeout(() => _loadCOA(), 300);
  }

  function _toggleInactive(checked) {
    _coaShowInactive = checked;
    _loadCOA();
  }

  function _resetCoaFilters() {
    _coaFilter = 'All';
    _coaSearch = '';
    _coaShowInactive = false;
    const se = document.getElementById('coa_search');
    const ie = document.getElementById('coa_inactive');
    if (se) se.value = '';
    if (ie) ie.checked = false;
    _loadCOA();
  }

  function _toggleAllCoa(checked) {
    document.querySelectorAll('[data-coa-id]').forEach(cb => { cb.checked = checked; });
  }

  function _editCategory(id) {
    _editingCat = _coaRows.find(r => r.id === id) || null;
    if (_editingCat) App.go('ac_coa_edit');
  }

  function _goLinked() {
    App.go('ac_linked');
  }

  // ══════════════════════════════════════════
  // 2. CREATE CATEGORY — ★ CONNECTED TO DB
  // ══════════════════════════════════════════

  function renderCreateCategory() {
    return {
      tb: `<div class="tb"><button class="bg" onclick="App.go('ac_coa')">← Categories</button><div class="tb-t">Create category</div></div>`,
      ct: _categoryForm(null),
    };
  }

  // ══════════════════════════════════════════
  // 3. EDIT CATEGORY — ★ CONNECTED TO DB
  // ══════════════════════════════════════════

  function renderEditCategory() {
    const cat = _editingCat;
    if (!cat) {
      return {
        tb: `<div class="tb"><button class="bg" onclick="App.go('ac_coa')">← Categories</button><div class="tb-t">Edit category</div></div>`,
        ct: '<div class="empty" style="padding:40px">No category selected. <a class="lk" onclick="App.go(\'ac_coa\')">Go back</a></div>',
      };
    }
    return {
      tb: `<div class="tb"><button class="bg" onclick="App.go('ac_coa')">← Categories</button><div class="tb-t">Edit category</div></div>`,
      ct: _categoryForm(cat),
    };
  }

  // ── Shared form for Create + Edit ──
  function _categoryForm(cat) {
    const isEdit = !!cat;
    const c = cat || {};

    // Transaction type options (Income, Expense, Asset Purchase, Transfer, Loan)
    const TX_TYPES = ['Income', 'Expense', 'Asset Purchase', 'Transfer', 'Loan'];
    const txTypeOpts = TX_TYPES.map(t =>
      `<option value="${t}"${t === c.transaction_type ? ' selected' : ''}>${t}</option>`
    ).join('');

    // Tax code options
    const taxCodes = App.S.taxCodes || [];
    const tcOpts = taxCodes.map(t =>
      `<option value="${t.code}"${t.code === (c.tax_code || '') ? ' selected' : ''}>${t.code}</option>`
    ).join('');

    // Balance + linked info bar (edit only)
    const infoBar = isEdit ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg3);border-radius:var(--rd);margin-bottom:14px"><div><div style="font-size:var(--fs-xs);font-weight:600">Main Category</div><div style="font-size:var(--fs-xs);color:var(--t3)">${esc(c.main_category || '—')}</div></div><div style="text-align:right"><div style="font-size:var(--fs-xs);font-weight:600">Current balance</div><div style="font-size:var(--fs-h1);font-weight:700">${fm(c.current_balance || 0)}</div></div></div>` : '';

    // Form row helper
    const frow = (label, req, content) =>
      `<div style="display:flex;align-items:center;margin-bottom:10px"><div style="width:150px;text-align:right;padding-right:14px;font-size:var(--fs-sm);color:var(--t2)">${label}${req ? ' <span style="color:var(--acc)">*</span>' : ''}</div><div style="max-width:340px;flex:1">${content}</div></div>`;

    let html = `<div class="card" style="max-width:660px;margin:0 auto">
      ${infoBar}
      <div style="font-size:var(--fs-body);font-weight:700;margin-bottom:2px">Category details</div>
      <div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:14px">Transaction Type → Main Category → Account Name (Sub Category)</div>

      ${frow('Transaction Type', true, `<select class="inp" id="cat_txtype" onchange="ScrAccounting._onTxTypeChange(this.value)"><option value="">Select an option</option>${txTypeOpts}</select>`)}
      ${frow('Main Category', true, `<select class="inp" id="cat_main"><option value="">Select an option</option></select>`)}
      ${frow('Account Name', true, `<input class="inp" id="cat_name" value="${esc(c.sub_category || '')}" placeholder="e.g. Packaging, Rent, Electricity">`)}
      ${frow('Account Code', false, `<input class="inp" id="cat_code" value="${esc(c.account_code || '')}" placeholder="e.g. 27010 (optional)" style="max-width:140px">`)}
      ${frow('Tax code', true, `<select class="inp" id="cat_tax" style="max-width:100px"><option value=""></option>${tcOpts}</select>`)}
      ${frow('Opening balance ($)', false, `<input class="inp" id="cat_balance" value="${(c.current_balance || 0).toFixed(2)}" style="text-align:right">`)}

      <div style="display:flex;align-items:flex-start;margin-bottom:10px">
        <div style="width:150px;text-align:right;padding-right:14px;font-size:var(--fs-sm);color:var(--t2);padding-top:6px">Notes</div>
        <div style="max-width:340px;flex:1"><textarea class="inp" id="cat_notes" style="min-height:50px;resize:vertical">${esc(c.notes || '')}</textarea></div>
      </div>`;

    // Footer buttons
    if (isEdit) {
      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:10px;border-top:1px solid var(--bd2)">
        <button class="btn bo" style="color:var(--r);border-color:var(--r)" onclick="ScrAccounting._deleteCat('${c.id}')">Delete</button>
        <div style="display:flex;gap:6px">
          <button class="btn bo" onclick="App.go('ac_coa')">Cancel</button>
          <button class="btn bo" onclick="ScrAccounting._toggleActive('${c.id}', ${!c.is_active})">${c.is_active ? 'Mark as inactive' : 'Mark as active'}</button>
          <button class="bs" id="cat_save_btn" onclick="ScrAccounting._saveCat('${c.id}', this)">Save</button>
        </div>
      </div>`;
    } else {
      html += `<div style="display:flex;justify-content:flex-end;gap:6px;margin-top:14px;padding-top:10px;border-top:1px solid var(--bd2)">
        <button class="btn bo" onclick="App.go('ac_coa')">Cancel</button>
        <button class="bs" id="cat_save_btn" onclick="ScrAccounting._saveCat(null, this)">Save</button>
      </div>`;
    }

    html += '</div>';
    return html;
  }

  function _onCreateLoad() {
    // Ensure COA data is available for main_category dropdown
    if (_coaRows.length === 0) {
      API.getCoa({ show_inactive: false }).then(res => {
        _coaRows = res.rows || [];
        _populateMainCategories();
      });
    } else {
      _populateMainCategories();
    }
  }

  function _onEditLoad() {
    if (_coaRows.length === 0) {
      API.getCoa({ show_inactive: false }).then(res => {
        _coaRows = res.rows || [];
        _populateMainCategories();
      });
    } else {
      _populateMainCategories();
    }
  }

  /** When transaction_type changes → update main_category dropdown */
  function _onTxTypeChange(val) {
    _populateMainCategories();
  }

  /** Populate main_category dropdown from existing unique main_categories matching transaction_type */
  function _populateMainCategories() {
    const sel = document.getElementById('cat_main');
    if (!sel) return;
    const txTypeEl = document.getElementById('cat_txtype');
    const selectedTxType = txTypeEl ? txTypeEl.value : '';

    // Collect unique main_categories that match this transaction_type
    const seen = new Set();
    const mains = [];
    _coaRows.forEach(r => {
      if (selectedTxType && r.transaction_type !== selectedTxType) return;
      if (r.main_category && !seen.has(r.main_category)) {
        seen.add(r.main_category);
        mains.push(r.main_category);
      }
    });

    const editMain = _editingCat ? _editingCat.main_category : '';
    let opts = '<option value="">Select or type new...</option>';
    mains.forEach(m => {
      const selected = m === editMain ? ' selected' : '';
      opts += `<option value="${esc(m)}"${selected}>${esc(m)}</option>`;
    });
    // If editing and current main not in list, add it
    if (editMain && !seen.has(editMain)) {
      opts += `<option value="${esc(editMain)}" selected>${esc(editMain)}</option>`;
    }

    sel.innerHTML = opts;
  }

  /** Save category (create or update) */
  async function _saveCat(id, btnEl) {
    if (!btnEl || btnEl.disabled) return;
    const origText = btnEl.textContent;
    btnEl.disabled = true;
    btnEl.textContent = 'Saving...';

    try {
      const transaction_type = document.getElementById('cat_txtype')?.value || '';
      const main_category = document.getElementById('cat_main')?.value || '';
      const sub_category = document.getElementById('cat_name')?.value?.trim() || '';
      const account_code = document.getElementById('cat_code')?.value?.trim() || '';
      const tax_code = document.getElementById('cat_tax')?.value || 'FRE';
      const current_balance = parseFloat(document.getElementById('cat_balance')?.value) || 0;

      if (!transaction_type) { App.toast('Transaction Type is required'); return; }
      if (!main_category) { App.toast('Main Category is required'); return; }
      if (!sub_category) { App.toast('Account Name is required'); return; }

      const data = {
        transaction_type,
        main_category,
        sub_category,
        account_code: account_code || null,
        tax_code,
        current_balance,
      };

      if (id) {
        data.id = id;
        if (_editingCat) data.expected_updated_at = _editingCat.updated_at;
        await API.updateCategory(data);
        App.toast('Category updated');
      } else {
        await API.createCategory(data);
        App.toast('Category created');
      }
      App.go('ac_coa');
    } catch (e) {
      App.toast(e.message || 'Save failed');
    } finally {
      btnEl.disabled = false;
      btnEl.textContent = origText;
    }
  }

  /** Toggle active/inactive */
  async function _toggleActive(id, newActive) {
    try {
      await API.updateCategory({ id, is_active: newActive });
      App.toast(newActive ? 'Category activated' : 'Category deactivated');
      App.go('ac_coa');
    } catch (e) {
      App.toast(e.message || 'Update failed');
    }
  }

  /** Delete category */
  function _deleteCat(id) {
    App.showDialog({
      title: 'Delete Category',
      message: 'Delete this category permanently? If it\'s used in transactions, it will be marked as inactive instead.',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await API.deleteCategory(id, true);
          App.toast('Category deleted');
          App.go('ac_coa');
        } catch (e) {
          if (e.message && e.message.includes('IN_USE')) {
            // Fallback to soft delete
            try {
              await API.deleteCategory(id, false);
              App.toast('Category marked as inactive (in use)');
              App.go('ac_coa');
            } catch (e2) {
              App.toast(e2.message || 'Delete failed');
            }
          } else {
            App.toast(e.message || 'Delete failed');
          }
        }
      },
    });
  }

  // ══════════════════════════════════════════
  // 4. TAX CODES — ★ CONNECTED TO DB
  // ══════════════════════════════════════════

  function renderTaxCodes() {
    return {
      tb: `<div class="tb"><div class="tb-t">Tax Codes</div></div>`,
      ct: `<div class="card" style="max-width:700px;margin:0 auto">
        <table class="tbl" id="tax_tbl">
          <thead><tr><th>Code</th><th>Name</th><th style="text-align:right">Rate</th><th>Description</th><th>Status</th><th style="width:60px"></th></tr></thead>
          <tbody id="tax_tbody">${_skeleton(6)}</tbody>
        </table>
      </div>`,
    };
  }

  async function _loadTax() {
    try {
      _taxRows = await API.getTaxCodes();
      _renderTaxRows();
    } catch (e) {
      const tbody = document.getElementById('tax_tbody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--r)">Error: ${esc(e.message)}</td></tr>`;
    }
  }

  function _renderTaxRows() {
    const tbody = document.getElementById('tax_tbody');
    if (!tbody) return;

    if (!_taxRows || _taxRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--t3)">No tax codes found</td></tr>';
      return;
    }

    tbody.innerHTML = _taxRows.map(r => `<tr>
      <td style="font-weight:700">${esc(r.code)}</td>
      <td>${esc(r.name)}</td>
      <td style="text-align:right">${Number(r.rate)}%</td>
      <td style="font-size:var(--fs-xxs);color:var(--t3)">${esc(r.description || '')}</td>
      <td><span class="sts ${r.is_active !== false ? 'sts-c' : 'sts-o'}">${r.is_active !== false ? 'Active' : 'Inactive'}</span></td>
      <td><button class="bg" style="color:var(--acc);font-size:var(--fs-xs)" onclick="ScrAccounting._editTax('${r.id || r.code}')">Edit</button></td>
    </tr>`).join('');
  }

  function _editTax(idOrCode) {
    const row = _taxRows.find(r => r.id === idOrCode || r.code === idOrCode);
    if (!row) return;

    App.showDialog({
      title: 'Edit Tax Code: ' + (row.code || ''),
      message: `
        <div style="text-align:left">
          <div class="fg"><label class="lb">Name</label><input class="inp" id="dlg_tax_name" value="${esc(row.name || '')}"></div>
          <div class="fg"><label class="lb">Rate (%)</label><input class="inp" id="dlg_tax_rate" type="number" step="0.1" value="${row.rate || 0}" style="max-width:100px"></div>
          <div class="fg"><label class="lb">Description</label><input class="inp" id="dlg_tax_desc" value="${esc(row.description || '')}"></div>
        </div>`,
      confirmText: 'Save',
      onConfirm: async () => {
        const name = document.getElementById('dlg_tax_name')?.value?.trim();
        const rate = parseFloat(document.getElementById('dlg_tax_rate')?.value) || 0;
        const description = document.getElementById('dlg_tax_desc')?.value?.trim() || '';
        try {
          await API.updateTaxCode({ id: row.id, code: row.code, name, rate, description });
          App.toast('Tax code updated');
          _loadTax();
        } catch (e) {
          App.toast(e.message || 'Update failed');
        }
      },
    });
  }

  // ══════════════════════════════════════════
  // 5. BANK RULES (ac_rules) — ★ E3a
  // ══════════════════════════════════════════

  let _brRows = [];
  let _brStats = {};
  let _brTypeFilter = 'all';
  let _brBankFilter = '';
  let _brSearch = '';
  let _brShowInactive = false;
  let _brEditing = null; // rule being edited (null = create mode)
  let _brSaving = false;

  function renderBankRules() {
    _brTypeFilter = 'all';
    _brBankFilter = '';
    _brSearch = '';
    _brShowInactive = false;
    return {
      tb: `<div class="tb"><div class="tb-t">Bank Rules <span style="font-size:var(--fs-xs);color:var(--t3);font-weight:400">Auto-match rules for bank reconciliation</span></div><div style="position:relative;display:inline-block" id="br_cr_wrap"><button class="bs" onclick="ScrAccounting._brToggleMenu()" style="display:flex;align-items:center;gap:4px">+ Create Rule <span style="font-size:10px">▾</span></button><div class="br-cr-menu" id="br_cr_menu"><div class="br-cr-item" onclick="ScrAccounting._brOpenModal('receive')"><span class="br-tt br-tt-recv">IN</span> Receive money</div><div class="br-cr-item" onclick="ScrAccounting._brOpenModal('spend')"><span class="br-tt br-tt-spend">OUT</span> Spend money</div><div class="br-cr-item" onclick="ScrAccounting._brOpenModal('bill')"><span class="br-tt br-tt-bill">BILL</span> Bill / Invoice</div></div></div></div>`,
      ct: `<div style="max-width:1100px;margin:0 auto">
        <div class="br-info">💡 <b>Bank Rules คืออะไร?</b> — เมื่อ bank statement เข้ามา description ของแบงค์จะไม่ตรงกับชื่อ vendor ในระบบ เช่น แบงค์เขียน <code style="background:rgba(124,58,237,.1);padding:1px 4px;border-radius:3px">PRO BROS PTY LTD DD</code> แต่ในระบบชื่อ "Pro Bros Providore" — Bank Rules ช่วยบอกว่า <b>"ถ้าเห็นคำนี้ใน description → match กับ contact นี้ + category นี้"</b> เพื่อให้ reconciliation ทำงานอัตโนมัติ</div>
        <div class="br-stats" id="br_stats"></div>
        <div class="br-fbar">
          <div class="fg"><div class="fl-l">Transaction Type</div><select class="fl" style="width:140px" id="br_ftype" onchange="ScrAccounting._brSetFilter('type',this.value)"><option value="all">All</option><option value="receive">Receive money</option><option value="spend">Spend money</option><option value="bill">Bill</option></select></div>
          <div class="fg"><div class="fl-l">Bank Account</div><select class="fl" style="width:180px" id="br_fbank" onchange="ScrAccounting._brSetFilter('bank',this.value)"><option value="">All accounts</option></select></div>
          <div class="fg"><div class="fl-l">Search</div><input class="fl" placeholder="Search rule name..." style="width:160px" id="br_search" oninput="ScrAccounting._brSetFilter('search',this.value)"></div>
          <div class="fg" style="align-self:flex-end"><label style="font-size:var(--fs-xxs);color:var(--t3);display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="br_inactive" onchange="ScrAccounting._brSetFilter('inactive',this.checked)"> Show inactive</label></div>
          <div style="flex:1"></div>
          <button class="bg" style="color:var(--acc)" onclick="ScrAccounting._brResetFilters()">Reset</button>
        </div>
        <div class="card" style="padding:0;overflow:hidden"><table class="br-tbl"><thead><tr><th style="width:22%">Rule Name</th><th style="width:15%">Bank Account</th><th style="width:10%">Type</th><th style="width:17%">Contact</th><th style="width:12%">Main Category</th><th style="width:11%">Sub Category</th><th style="width:8%">Active</th><th style="width:5%"></th></tr></thead><tbody id="br_tbody">${_skeleton(8)}</tbody></table></div>
        <div id="br_count" style="font-size:var(--fs-xxs);color:var(--t3);display:flex;gap:12px;align-items:center;margin-top:8px"></div>
      </div>`,
    };
  }

  async function _brLoad() {
    // Populate bank account filter dropdown
    const bankSel = document.getElementById('br_fbank');
    if (bankSel && App.S.bankAccounts) {
      let opts = '<option value="">All accounts</option>';
      App.S.bankAccounts.forEach(b => { opts += `<option value="${b.id}">${esc(b.label)}</option>`; });
      bankSel.innerHTML = opts;
    }

    try {
      const result = await API.call('fin_get_bank_rules', {
        type_filter: _brTypeFilter,
        bank_account_id: _brBankFilter || null,
        search: _brSearch,
        show_inactive: _brShowInactive,
      });
      _brRows = result.rows || [];
      _brStats = result.stats || {};
      _brRenderStats();
      _brRenderRows();
    } catch (e) {
      const tbody = document.getElementById('br_tbody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--r)">Error: ${esc(e.message)}</td></tr>`;
    }
  }

  function _brRenderStats() {
    const el = document.getElementById('br_stats');
    if (!el) return;
    const s = _brStats;
    el.innerHTML = `<div class="br-stat"><span class="br-dot br-dot-g"></span> <b>${s.active_count || 0}</b> active rules</div><div class="br-stat"><span class="br-dot br-dot-b"></span> <b>${s.receive_count || 0}</b> receive money</div><div class="br-stat"><span class="br-dot br-dot-r"></span> <b>${s.spend_count || 0}</b> spend money</div><div class="br-stat"><span class="br-dot br-dot-o"></span> <b>${s.bill_count || 0}</b> bill</div><div class="br-stat" style="color:var(--t4)"><b>${s.inactive_count || 0}</b> inactive</div>`;
  }

  function _brRenderRows() {
    const tbody = document.getElementById('br_tbody');
    const countEl = document.getElementById('br_count');
    if (!tbody) return;

    if (_brRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--t3)">No rules found. Create your first rule above.</td></tr>';
      if (countEl) countEl.textContent = '';
      return;
    }

    // Bank account label lookup
    const bankMap = {};
    (App.S.bankAccounts || []).forEach(b => { bankMap[b.id] = b.label; });

    tbody.innerHTML = _brRows.map(r => {
      const typeCls = r.transaction_type === 'receive' ? 'br-tt-recv' : r.transaction_type === 'spend' ? 'br-tt-spend' : 'br-tt-bill';
      const typeLabel = r.transaction_type === 'receive' ? 'Receive money' : r.transaction_type === 'spend' ? 'Spend money' : 'Bill';
      const bankLabel = r.bank_account_id ? (bankMap[r.bank_account_id] || '—') : 'All accounts';
      const inactive = !r.is_active ? ' br-inactive' : '';
      const kws = (r.keywords || []).map(k => `<span class="br-kw">${esc(k)}</span>`).join('');
      return `<tr class="${inactive}" onclick="ScrAccounting._brOpenModal('${r.transaction_type}','edit','${r.id}')">
        <td><div class="br-rn">${esc(r.rule_name)}</div><div class="br-kws">${kws}</div></td>
        <td style="font-size:var(--fs-xs)">${esc(bankLabel)}</td>
        <td><span class="br-tt ${typeCls}">${typeLabel}</span></td>
        <td style="font-size:var(--fs-xs);font-weight:${r.vendor_name ? '500' : '400'}">${esc(r.vendor_name || '—')}</td>
        <td style="font-size:var(--fs-xxs);color:var(--t2)">${esc(r.main_category || '')}</td>
        <td style="font-size:var(--fs-xxs);color:var(--t2)">${esc(r.sub_category || '')}</td>
        <td onclick="event.stopPropagation()"><label class="br-tgl"><input type="checkbox" ${r.is_active ? 'checked' : ''} onchange="ScrAccounting._brToggleActive('${r.id}',this.checked)"><span class="br-sl"></span></label></td>
        <td><button class="bg" style="font-size:14px" title="Edit">✎</button></td>
      </tr>`;
    }).join('');

    if (countEl) countEl.innerHTML = `<span>Showing ${_brRows.length} rules</span>`;
  }

  function _brSetFilter(key, val) {
    if (key === 'type') _brTypeFilter = val;
    else if (key === 'bank') _brBankFilter = val;
    else if (key === 'search') { _brSearch = val; clearTimeout(_brSetFilter._t); _brSetFilter._t = setTimeout(() => _brLoad(), 300); return; }
    else if (key === 'inactive') _brShowInactive = val;
    _brLoad();
  }

  function _brResetFilters() {
    _brTypeFilter = 'all'; _brBankFilter = ''; _brSearch = ''; _brShowInactive = false;
    const ft = document.getElementById('br_ftype'); if (ft) ft.value = 'all';
    const fb = document.getElementById('br_fbank'); if (fb) fb.value = '';
    const fs = document.getElementById('br_search'); if (fs) fs.value = '';
    const fi = document.getElementById('br_inactive'); if (fi) fi.checked = false;
    _brLoad();
  }

  async function _brToggleActive(id, checked) {
    try {
      await API.call('fin_update_bank_rule', { id, is_active: checked });
    } catch (e) {
      App.toast(e.message || 'Update failed');
      _brLoad(); // revert on fail
    }
  }

  // ── Bank Rules Modal ──
  function _brToggleMenu() {
    const m = document.getElementById('br_cr_menu');
    if (m) m.classList.toggle('open');
  }

  function _brOpenModal(type, mode, ruleId) {
    // Close create dropdown
    const menu = document.getElementById('br_cr_menu');
    if (menu) menu.classList.remove('open');

    _brEditing = null;
    if (mode === 'edit' && ruleId) {
      _brEditing = _brRows.find(r => r.id === ruleId) || null;
    }

    // Remove existing modal
    let ov = document.getElementById('br_modal_ov');
    if (ov) ov.remove();

    const isEdit = !!_brEditing;
    const r = _brEditing || {};
    const editType = isEdit ? r.transaction_type : type;
    const title = isEdit ? 'Edit Bank Rule' : ('Create Bank Rule — ' + (type === 'receive' ? 'Receive Money' : type === 'spend' ? 'Spend Money' : 'Bill'));

    // Bank account options
    let bankOpts = '<option value="">All bank accounts</option>';
    (App.S.bankAccounts || []).forEach(b => {
      bankOpts += `<option value="${b.id}" ${b.id === r.bank_account_id ? 'selected' : ''}>${esc(b.label)}</option>`;
    });

    // Vendor options from S.vendors
    let vendorOpts = '<option value="">— Select —</option>';
    (App.S.vendors || []).forEach(v => {
      vendorOpts += `<option value="${v.id}" ${v.id === r.vendor_id ? 'selected' : ''}>${esc(v.name)}</option>`;
    });

    // Main category options (unique from S.categories)
    const mainSet = new Set();
    (App.S.categories || []).forEach(c => { if (c.main_category) mainSet.add(c.main_category); });
    let mainOpts = '<option value="">— Select —</option>';
    [...mainSet].sort().forEach(m => {
      mainOpts += `<option value="${esc(m)}" ${m === r.main_category ? 'selected' : ''}>${esc(m)}</option>`;
    });

    // Keywords as comma-separated
    const kwStr = (r.keywords || []).join(', ');

    ov = document.createElement('div');
    ov.className = 'br-modal-ov open';
    ov.id = 'br_modal_ov';
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    ov.innerHTML = `<div class="br-modal">
      <div class="br-mh"><div class="br-mt">${esc(title)}</div><button class="br-mx" onclick="document.getElementById('br_modal_ov').remove()">✕</button></div>
      <div class="br-mb">
        <div class="br-fs"><div class="br-fst">Rule Details</div>
          <div class="br-fr"><div class="fg" style="flex:1"><label>Transaction Type *</label><select class="fl" id="brm_type" style="width:100%"><option value="receive" ${editType==='receive'?'selected':''}>Receive money</option><option value="spend" ${editType==='spend'?'selected':''}>Spend money</option><option value="bill" ${editType==='bill'?'selected':''}>Bill</option></select></div><div class="fg" style="flex:2"><label>Rule Name *</label><input class="fl" id="brm_name" value="${esc(r.rule_name || '')}" placeholder="e.g. PRO BROS, UBER EATS" style="width:100%"></div></div>
          <div class="br-fr"><div class="fg"><label>Applies to</label><select class="fl" id="brm_bank" style="width:100%">${bankOpts}</select></div></div>
        </div>
        <div class="br-fs"><div class="br-fst">Keywords (comma-separated)</div>
          <input class="fl" id="brm_keywords" value="${esc(kwStr)}" placeholder="e.g. PRO BROS, PRO BRO" style="width:100%">
          <div style="font-size:var(--fs-xxs);color:var(--t3);margin-top:4px">ใส่ keywords ที่ปรากฏใน bank statement description คั่นด้วย comma (match = ตรงอย่างน้อย 1 keyword)</div>
        </div>
        <div class="br-fs"><div class="br-fst">Then auto-fill with</div>
          <div class="br-fr"><div class="fg"><label>Contact / Supplier</label><select class="fl" id="brm_vendor" style="width:100%" onchange="ScrAccounting._brOnVendorChange()">${vendorOpts}</select></div><div class="fg"><label>Main Category</label><select class="fl" id="brm_main" style="width:100%" onchange="ScrAccounting._brUpdateSubCats()">${mainOpts}</select></div><div class="fg"><label>Sub Category</label><select class="fl" id="brm_sub" style="width:100%"><option value="">— Select main first —</option></select></div></div>
        </div>
      </div>
      <div class="br-mf">
        <button class="btn bo" onclick="document.getElementById('br_modal_ov').remove()">Cancel</button>
        ${isEdit ? `<button class="btn bo" style="color:var(--r);border-color:var(--r)" onclick="ScrAccounting._brDelete('${r.id}')">Delete Rule</button>` : ''}
        <button class="bs" id="brm_save" onclick="ScrAccounting._brSave()">${isEdit ? 'Save Changes' : 'Create Rule'}</button>
      </div>
    </div>`;

    document.body.appendChild(ov);

    // Populate sub-cats if main is set
    if (r.main_category) {
      requestAnimationFrame(() => _brUpdateSubCats(r.sub_category));
    }

    // Ensure master data is ready for vendor/category dropdowns
    if (!App.S._masterReady) {
      API.waitMaster().then(() => {
        // Re-populate vendor dropdown
        const vSel = document.getElementById('brm_vendor');
        if (vSel && App.S.vendors) {
          let opts2 = '<option value="">— Select —</option>';
          App.S.vendors.forEach(v => { opts2 += `<option value="${v.id}" ${v.id === r.vendor_id ? 'selected' : ''}>${esc(v.name)}</option>`; });
          vSel.innerHTML = opts2;
        }
      });
    }
  }

  function _brOnVendorChange() {
    const vSel = document.getElementById('brm_vendor');
    if (!vSel) return;
    const vid = vSel.value;
    const vendor = (App.S.vendors || []).find(v => v.id === vid);
    // No auto-fill needed — vendor name stored separately
  }

  function _brUpdateSubCats(preselect) {
    const mainSel = document.getElementById('brm_main');
    const subSel = document.getElementById('brm_sub');
    if (!mainSel || !subSel) return;
    const mainVal = mainSel.value;
    const subs = (App.S.categories || []).filter(c => c.main_category === mainVal).map(c => c.sub_category).filter(Boolean);
    const unique = [...new Set(subs)];
    let opts = '<option value="">— Select —</option>';
    unique.forEach(s => { opts += `<option value="${esc(s)}" ${s === preselect ? 'selected' : ''}>${esc(s)}</option>`; });
    subSel.innerHTML = opts;
  }

  async function _brSave() {
    if (_brSaving) return;
    const btn = document.getElementById('brm_save');
    const name = document.getElementById('brm_name')?.value?.trim();
    const kwRaw = document.getElementById('brm_keywords')?.value?.trim();

    if (!name) { App.toast('Rule Name is required'); return; }
    if (!kwRaw) { App.toast('At least 1 keyword is required'); return; }

    const keywords = kwRaw.split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
    if (keywords.length === 0) { App.toast('At least 1 keyword is required'); return; }

    _brSaving = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    try {
      const vendorSel = document.getElementById('brm_vendor');
      const vendorId = vendorSel?.value || null;
      const vendorName = vendorId ? vendorSel.options[vendorSel.selectedIndex]?.text : null;

      const data = {
        rule_name: name,
        keywords,
        transaction_type: document.getElementById('brm_type')?.value || 'spend',
        bank_account_id: document.getElementById('brm_bank')?.value || null,
        vendor_id: vendorId,
        vendor_name: vendorName,
        main_category: document.getElementById('brm_main')?.value || null,
        sub_category: document.getElementById('brm_sub')?.value || null,
      };

      if (_brEditing) {
        data.id = _brEditing.id;
        await API.call('fin_update_bank_rule', data);
        App.toast('Rule updated');
      } else {
        await API.call('fin_create_bank_rule', data);
        App.toast('Rule created');
      }

      document.getElementById('br_modal_ov')?.remove();
      _brLoad();
    } catch (e) {
      App.toast(e.message || 'Save failed');
    } finally {
      _brSaving = false;
      if (btn) { btn.disabled = false; btn.textContent = _brEditing ? 'Save Changes' : 'Create Rule'; }
    }
  }

  function _brDelete(id) {
    App.showDialog({
      title: 'Delete Bank Rule',
      message: 'Delete this rule permanently? This will not affect past reconciled transactions.',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await API.call('fin_delete_bank_rule', { id });
          App.toast('Rule deleted');
          document.getElementById('br_modal_ov')?.remove();
          _brLoad();
        } catch (e) {
          App.toast(e.message || 'Delete failed');
        }
      },
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#br_cr_wrap')) {
      const m = document.getElementById('br_cr_menu');
      if (m) m.classList.remove('open');
    }
  });

  // ══════════════════════════════════════════
  // 6. BANKING HUB (ac_hub) — ★ E3a
  // ══════════════════════════════════════════

  let _hubAccounts = [];

  function renderBankingHub() {
    return {
      tb: `<div class="tb"><div class="tb-t">Banking Hub</div><button class="bs" onclick="App.go('ac_coa_create')">+ Add Bank Account</button></div>`,
      ct: `<div style="max-width:1000px;margin:0 auto" id="hub_content">${_skeleton(1).replace('<tr><td', '<div style="text-align:center;padding:40px;color:var(--t3)"><div class="fin-spinner" style="margin:0 auto 8px"></div>').replace('</td></tr>', '</div>')}</div>`,
    };
  }

  async function _hubLoad() {
    const el = document.getElementById('hub_content');
    if (!el) return;

    try {
      const result = await API.call('fin_get_banking_hub', {});
      _hubAccounts = result.accounts || [];
      _hubRender(el);
    } catch (e) {
      el.innerHTML = `<div style="padding:20px;color:var(--r)">Error: ${esc(e.message)}</div>`;
    }
  }

  function _hubRender(el) {
    if (_hubAccounts.length === 0) {
      el.innerHTML = '<div class="empty" style="padding:40px">No bank accounts found. Add one in Categories (COA).</div>';
      return;
    }

    const active = _hubAccounts.filter(a => a.is_active !== false);
    const inactive = _hubAccounts.filter(a => a.is_active === false);

    let html = '';
    if (active.length > 0) {
      html += `<div style="font-size:var(--fs-sm);font-weight:600;margin-bottom:8px">Accounts${active.length > 0 ? ` (${active.length})` : ''}</div>`;
      html += active.map(a => _hubCard(a)).join('');
    }
    if (inactive.length > 0) {
      html += `<div style="font-size:var(--fs-sm);font-weight:600;margin:16px 0 8px">Inactive accounts</div>`;
      html += inactive.map(a => _hubCard(a, true)).join('');
    }

    el.innerHTML = html;
  }

  function _hubCard(a, dimmed) {
    const style = dimmed ? 'opacity:.6' : '';
    const diff = a.bank_balance != null ? (a.spg_balance - a.bank_balance) : null;
    const diffHtml = diff != null
      ? `<span style="color:${diff === 0 ? 'var(--g)' : 'var(--r)'};font-size:var(--fs-xs)">(${fm(diff)})</span>`
      : '';
    const bankBalHtml = a.bank_balance != null
      ? `<div style="font-size:var(--fs-kpi-md);font-weight:800">${fm(a.bank_balance)} ${diffHtml}</div><div style="font-size:var(--fs-xxs);color:var(--t3)">Bank updated ${a.bank_balance_date || '—'}</div>`
      : `<div style="font-size:var(--fs-kpi-md);font-weight:800;color:var(--t3)">N/A</div><div style="font-size:var(--fs-xxs);color:var(--t3)">No bank connection</div>`;

    return `<div class="card" style="display:flex;justify-content:space-between;align-items:center;${style}">
      <div>
        <div style="font-size:var(--fs-body);font-weight:700">${esc(a.label)}${!a.is_active ? ' <span class="sts sts-o" style="font-size:9px">Inactive</span>' : ''}</div>
        <div style="font-size:var(--fs-xxs);color:var(--t3)">${a.bsb ? 'BSB ' + esc(a.bsb) + ' · ' : ''}${a.account_number ? 'ACC ' + esc(a.account_number) : ''}</div>
        <div style="display:flex;gap:20px;margin-top:6px">
          <div><div style="font-size:var(--fs-kpi-md);font-weight:800">${fm(a.spg_balance)}</div><div style="font-size:var(--fs-xxs);color:var(--t3)">SPG balance</div></div>
          <div>${bankBalHtml}</div>
        </div>
      </div>
    </div>`;
  }

  // ══════════════════════════════════════════
  // REGISTER ROUTES
  // ══════════════════════════════════════════
  App.registerRoutes({
    ac_coa:        { render: renderCOA, onLoad: _loadCOA },
    ac_coa_create: { render: renderCreateCategory, onLoad: _onCreateLoad },
    ac_coa_edit:   { render: renderEditCategory, onLoad: _onEditLoad },
    ac_tax:        { render: renderTaxCodes, onLoad: _loadTax },
    ac_rules:      { render: renderBankRules, onLoad: _brLoad },
    ac_hub:        { render: renderBankingHub, onLoad: _hubLoad },
  });

  // ══════════════════════════════════════════
  // PUBLIC API — functions called from onclick
  // ══════════════════════════════════════════
  window.ScrAccounting = {
    _setCoaTab,
    _onSearch,
    _toggleInactive,
    _resetCoaFilters,
    _toggleAllCoa,
    _editCategory,
    _goLinked,
    _onTxTypeChange,
    _saveCat,
    _toggleActive,
    _deleteCat,
    _editTax,
    // E3a: Bank Rules
    _brToggleMenu,
    _brOpenModal,
    _brSetFilter,
    _brResetFilters,
    _brToggleActive,
    _brSave,
    _brDelete,
    _brOnVendorChange,
    _brUpdateSubCats,
  };

})();
