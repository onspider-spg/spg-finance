/** Version 2.3.1 | 16 MAR 2026 | Siam Palette Group */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_accounting_fin.js
 * Accounting: COA, Tax, Bank Rules, Hub, Map, Linked,
 * Loans & Finance, General Journal
 * ═══════════════════════════════════════════
 *
 * CHANGED v2.3 → v2.3.1:
 * - [DELETED] _skeleton() — use App.skeleton()
 * ═══════════════════════════════════════════
 */

(() => {
  const esc = App.esc;
  const fm = App.formatMoney;
  const _skeleton = App.skeleton;

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
              ${App.sth('Code','code','coa_tbl')}${App.sth('Name','name','coa_tbl')}${App.sth('Type','type','coa_tbl')}${App.sth('Tax','tax','coa_tbl')}${App.sth('Linked','linked','coa_tbl')}${App.sth('Level','level','coa_tbl')}${App.sthR('Balance ($)','balance','coa_tbl')}
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
        html += `<tr class="sort-skip" style="background:var(--bg2)">
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

  function _onCatFormLoad() {
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
          <thead><tr>${App.sth('Code','code','tax_tbl')}${App.sth('Name','name','tax_tbl')}${App.sthR('Rate','rate','tax_tbl')}${App.sth('Description','desc','tax_tbl')}${App.sth('Status','status','tax_tbl')}<th style="width:60px"></th></tr></thead>
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
        <div class="card" style="padding:0;overflow:hidden"><table class="br-tbl" id="br_tbl"><thead><tr>${App.sth('Rule Name','rule','br_tbl')}${App.sth('Bank Account','bank','br_tbl')}${App.sth('Type','type','br_tbl')}${App.sth('Contact','contact','br_tbl')}${App.sth('Main Category','main','br_tbl')}${App.sth('Sub Category','sub','br_tbl')}<th style="width:8%">Active</th><th style="width:5%"></th></tr></thead><tbody id="br_tbody">${_skeleton(8)}</tbody></table></div>
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

  function _hubBrandOpts() {
    const brands = App.S.brands || [];
    return '<option value="">All Brands</option>' + brands.map(b => `<option>${esc(b)}</option>`).join('');
  }

  let _hubBrandFilter = '';

  function renderBankingHub() {
    _hubBrandFilter = '';
    return {
      tb: `<div class="tb"><div class="tb-t">Banking Hub</div><select class="fl" id="hub_brand" onchange="ScrAccounting._hubSetBrand()" style="width:140px">${_hubBrandOpts()}</select><button class="bs" onclick="App.go('ac_coa_create')">+ Add Bank Account</button></div>`,
      ct: `<div style="max-width:1000px;margin:0 auto" id="hub_content">${_skeleton(1).replace('<tr><td', '<div style="text-align:center;padding:40px;color:var(--t3)"><div class="fin-spinner" style="margin:0 auto 8px"></div>').replace('</td></tr>', '</div>')}</div>`,
    };
  }

  function _hubSetBrand() {
    _hubBrandFilter = document.getElementById('hub_brand')?.value || '';
    const el = document.getElementById('hub_content');
    if (el) _hubRender(el);
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
    let accounts = _hubAccounts;
    // Brand filter by entity_id
    if (_hubBrandFilter) {
      accounts = accounts.filter(a => (a.entity_name || '') === _hubBrandFilter);
    }

    if (accounts.length === 0) {
      el.innerHTML = _hubBrandFilter
        ? '<div class="empty" style="padding:40px">No bank accounts for this brand.</div>'
        : '<div class="empty" style="padding:40px">No bank accounts found. Add one in Categories (COA).</div>';
      return;
    }

    const active = accounts.filter(a => a.is_active !== false);
    const inactive = accounts.filter(a => a.is_active === false);

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
  // 7. BANK MAP (ac_map) — 3 Tabs ★ E3b
  // ══════════════════════════════════════════

  let _bmTab = 'mapping';
  let _bmData = null;
  let _bmBridgeSettings = [];
  let _bmSaving = false;

  function _bmTabs(active) {
    const tabs = [
      { id: 'mapping', label: 'Bank Mapping' },
      { id: 'channels', label: 'Bank Channel' },
    ];
    return '<div style="display:flex;gap:0;border-bottom:1px solid var(--bd);margin-bottom:16px">'
      + tabs.map(t => `<div class="tab${t.id === active ? ' a' : ''}" onclick="ScrAccounting._bmSetTab('${t.id}')">${esc(t.label)}</div>`).join('')
      + '</div>';
  }

  let _bmBrandFilter = '';

  function renderBankMap() {
    _bmTab = 'mapping';
    _bmBrandFilter = '';
    return {
      tb: `<div class="tb"><div class="tb-t">Bank Mapping</div><select class="fl" id="bm_brand" onchange="ScrAccounting._bmSetBrand()" style="width:140px">${_hubBrandOpts()}</select><button class="bs" id="bm_save_btn" onclick="ScrAccounting._bmSave()">Save Changes</button></div>`,
      ct: `<div style="max-width:1100px;margin:0 auto" id="bm_wrap"><div id="bm_tabs">${_bmTabs('mapping')}</div><div id="bm_content">${_skeleton(1).replace('<tr><td', '<div style="text-align:center;padding:40px;color:var(--t3)"><div class="fin-spinner" style="margin:0 auto 8px"></div>').replace('</td></tr>', '</div>')}</div></div>`,
    };
  }

  function _bmSetBrand() {
    _bmBrandFilter = document.getElementById('bm_brand')?.value || '';
    _bmLoad();
  }

  async function _bmLoad() {
    const tabsEl = document.getElementById('bm_tabs');
    if (tabsEl) tabsEl.innerHTML = _bmTabs(_bmTab);
    await _bmLoadMapping();
  }

  async function _bmLoadMapping() {
    const el = document.getElementById('bm_content');
    if (!el) return;
    try {
      _bmData = await API.call('fin_get_bank_mapping', {});
      if (_bmTab === 'channels') _bmRenderChannels(el);
      else _bmRenderMapping(el);
    } catch (e) {
      el.innerHTML = `<div style="padding:20px;color:var(--r)">Error: ${esc(e.message)}</div>`;
    }
  }

  function _bmRenderMapping(el) {
    const d = _bmData;
    if (!d) return;
    const stores = d.stores || {};
    const storeBanks = d.storeBanks || {};
    const storeNames = d.storeNames || {};
    const stats = d.stats || {};

    // Stats bar
    let html = `<div style="display:flex;gap:24px;margin-bottom:16px;font-size:var(--fs-sm);color:var(--t2);align-items:center">
      <div><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--g);margin-right:4px"></span><span style="font-weight:700;font-size:14px">${stats.mapped || 0}</span> mapped</div>
      <div><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--o);margin-right:4px"></span><span style="font-weight:700;font-size:14px;color:var(--o)">${stats.unmapped || 0}</span> unmapped</div>
    </div>`;

    const storeIds = Object.keys(stores);
    if (storeIds.length === 0) {
      html += '<div class="empty" style="padding:40px">No channel mappings found. Channels are populated from Sale Daily module.</div>';
      el.innerHTML = html;
      return;
    }

    storeIds.forEach((sid, idx) => {
      const channels = stores[sid] || [];
      const myBanks = storeBanks[sid] || [];
      const storeName = storeNames[sid] || sid;
      const mappedCount = channels.filter(c => c.is_mapped).length;
      const allMapped = mappedCount === channels.length;
      const statusBadge = allMapped ? '<span class="sts sts-c">All mapped</span>' : `<span class="sts sts-p">${channels.length - mappedCount} unmapped</span>`;
      const open = idx === 0 ? '' : ' style="display:none"';

      html += `<div style="border:1px solid var(--bd);border-radius:8px;margin-bottom:12px;overflow:hidden;background:#fff">
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--bg2);cursor:pointer" onclick="var b=document.getElementById('bm_s_${idx}');b.style.display=b.style.display==='none'?'':'none'">
          <span style="font-size:var(--fs-xs);color:var(--t3)">▾</span>
          <span style="font-size:var(--fs-body);font-weight:600">${esc(storeName)}</span>
          <span style="font-size:var(--fs-xxs);color:var(--t3);background:var(--bg3);padding:2px 8px;border-radius:3px">${esc(sid)}</span>
          <span style="flex:1"></span>
          <span style="font-size:var(--fs-xs);color:var(--t3)">${channels.length} mappings</span>
          ${statusBadge}
        </div>
        <div id="bm_s_${idx}"${open}>
          ${myBanks.length > 0 ? `<div style="padding:8px 16px;font-size:var(--fs-xxs);color:var(--t3);background:#fafafa;border-bottom:1px solid var(--bd2)">Bank accounts: ${myBanks.map(b => '<b>' + esc(b.account_label) + '</b>').join(', ')}</div>` : `<div style="padding:8px 16px;font-size:var(--fs-xxs);color:var(--o);background:var(--obg);border-bottom:1px solid var(--bd2)">No bank accounts found for this store</div>`}
          <table class="tbl" style="font-size:var(--fs-sm)"><thead><tr><th style="width:4%">#</th><th style="width:22%">Channel</th><th style="width:9%">Type</th><th style="width:8%">Dir</th><th style="width:30%">Bank Account</th><th style="width:18%">Category</th><th style="width:6%"></th></tr></thead><tbody>`;

      channels.forEach((c, ci) => {
        const typeCls = c.channel_type === 'revenue' ? 'background:var(--gbg);color:var(--g)' : c.channel_type === 'expense' ? 'background:var(--rbg);color:var(--r)' : 'background:var(--bbg);color:var(--b)';
        const dirCls = c.direction === 'in' ? 'color:var(--g)' : c.direction === 'out' ? 'color:var(--r)' : 'color:var(--b)';
        const warn = c.is_mapped ? '' : 'style="background:rgba(217,119,6,.04)"';
        const dot = c.is_mapped ? 'background:var(--g)' : 'background:var(--o)';

        // Bank select — only show banks belonging to this store
        let selectHtml = '<option value="">— Select —</option>';
        myBanks.forEach(b => { selectHtml += `<option value="${b.id}" ${b.id === c.bank_account_id ? 'selected' : ''}>${esc(b.account_label)}</option>`; });

        html += `<tr ${warn}>
          <td style="color:var(--t4)">${ci + 1}</td>
          <td style="font-weight:500">${esc(c.channel_label)}${!c.is_mapped ? '<span style="font-size:9px;color:var(--o);font-weight:600;margin-left:4px">NEW</span>' : ''}</td>
          <td><span style="font-size:9px;font-weight:600;padding:2px 8px;border-radius:3px;${typeCls}">${esc(c.channel_type)}</span></td>
          <td><span style="font-size:var(--fs-xxs);font-weight:500;${dirCls}">${esc(c.direction.toUpperCase())}</span></td>
          <td><select class="fl" style="width:100%;font-size:var(--fs-xs);padding:5px 8px" data-map-id="${c.id}" onchange="ScrAccounting._bmMarkDirty()">${selectHtml}</select></td>
          <td style="font-size:var(--fs-xxs);color:var(--t2)">${esc(c.auto_category || '')}</td>
          <td><span style="display:inline-block;width:7px;height:7px;border-radius:50%;${dot}"></span></td>
        </tr>`;
      });

      html += '</tbody></table></div></div>';
    });

    html += `<div style="font-size:var(--fs-xxs);color:var(--t3);padding:8px 12px;background:var(--bg2);border-radius:8px;margin-top:8px">Bank accounts come from Chart of Accounts. To add a new bank account, go to Accounting → Categories (COA).</div>`;
    el.innerHTML = html;
  }

  function _bmRenderChannels(el) {
    const d = _bmData;
    if (!d) return;
    const stores = d.stores || {};
    const storeBanks = d.storeBanks || {};
    const storeNames = d.storeNames || {};

    // Aggregate: which bank account → how many channels (per store)
    const bankCount = {};
    Object.entries(stores).forEach(([sid, channels]) => {
      (channels).forEach(c => {
        if (c.bank_account_id) {
          if (!bankCount[c.bank_account_id]) bankCount[c.bank_account_id] = 0;
          bankCount[c.bank_account_id]++;
        }
      });
    });

    let html = `<div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:14px">Overview of bank accounts per brand/store, and how many channels are mapped to each.</div>`;

    // Group banks by store
    const storeIds = Object.keys(storeBanks).filter(sid => (storeBanks[sid] || []).length > 0);
    if (storeIds.length === 0) {
      html += '<div class="empty" style="padding:40px">No bank accounts found.</div>';
      el.innerHTML = html;
      return;
    }

    storeIds.forEach(sid => {
      const myBanks = storeBanks[sid] || [];
      const storeName = storeNames[sid] || sid;

      html += `<div style="border:1px solid var(--bd);border-radius:8px;margin-bottom:12px;overflow:hidden;background:#fff">
        <div style="padding:10px 16px;background:var(--bg2);font-weight:600;font-size:var(--fs-sm);display:flex;align-items:center;gap:8px">
          ${esc(storeName)}
          <span style="font-size:var(--fs-xxs);color:var(--t3);background:var(--bg3);padding:2px 8px;border-radius:3px">${esc(sid)}</span>
        </div>
        <table class="tbl" style="font-size:var(--fs-sm);margin:0"><thead><tr><th>Account Name</th><th>Bank</th><th>Type</th><th style="text-align:right">Channels</th></tr></thead><tbody>`;

      myBanks.forEach(b => {
        const cnt = bankCount[b.id] || 0;
        const cntColor = cnt > 0 ? 'color:var(--g);font-weight:600' : 'color:var(--o)';
        html += `<tr style="background:#fff"><td style="font-weight:600">${esc(b.account_label)}</td><td>${esc(b.bank_name || '—')}</td><td>${esc(b.account_type || 'Bank')}</td><td style="text-align:right;${cntColor}">${cnt}</td></tr>`;
      });

      html += '</tbody></table></div>';
    });

    html += '<div style="font-size:var(--fs-xxs);color:var(--t3);margin-top:12px">To add or edit bank accounts, go to Accounting → Categories (COA).</div>';
    el.innerHTML = html;
  }

  async function _bmLoadSettings() {
    const el = document.getElementById('bm_content');
    if (!el) return;
    try {
      const result = await API.call('fin_get_bridge_settings', {});
      _bmBridgeSettings = result.settings || [];
      _bmRenderSettings(el);
    } catch (e) {
      el.innerHTML = `<div style="padding:20px;color:var(--r)">Error: ${esc(e.message)}</div>`;
    }
  }

  function _bmRenderSettings(el) {
    const rev = _bmBridgeSettings.filter(s => s.data_type.startsWith('revenue'));
    const exp = _bmBridgeSettings.filter(s => !s.data_type.startsWith('revenue'));

    const settingLabels = {
      revenue_cash: { title: 'In-store Cash', desc: 'Auto-create sale transaction when SD records cash revenue' },
      revenue_card: { title: 'Card channels', desc: 'Eftpos, Prepaid, Union Pay' },
      revenue_platform: { title: 'Platform payouts', desc: 'UberEats, Easi, Hungry Panda, DoorDash' },
      expense_cash: { title: 'Expenses (Cash paid)', desc: 'Auto-create bill when SD records a cash expense' },
      invoice_paid: { title: 'Invoices (Paid)', desc: 'Auto-create bill for paid invoices from SD' },
      invoice_unpaid: { title: 'Invoices (Unpaid)', desc: 'Create as Awaiting Payment in Finance' },
    };

    function settingRow(s) {
      const info = settingLabels[s.data_type] || { title: s.data_type, desc: '' };
      const checked = s.is_enabled ? 'checked' : '';
      return `<div style="display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid var(--bd2);gap:12px">
        <div style="flex:1"><div style="font-size:var(--fs-sm);font-weight:600">${esc(info.title)}</div><div style="font-size:var(--fs-xxs);color:var(--t3)">${esc(info.desc)}</div></div>
        <label class="br-tgl"><input type="checkbox" ${checked} data-bridge-id="${s.bridge_id}" onchange="ScrAccounting._bmMarkDirty()"><span class="br-sl"></span></label>
      </div>`;
    }

    let html = `<div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:14px">Control which data types sync automatically from Sale Daily to Finance.</div>`;
    html += `<div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:8px">Revenue Auto-sync</div><div style="border:1px solid var(--bd);border-radius:8px;margin-bottom:16px">${rev.map(settingRow).join('')}</div>`;
    html += `<div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:8px">Expense Auto-sync</div><div style="border:1px solid var(--bd);border-radius:8px;margin-bottom:16px">${exp.map(settingRow).join('')}</div>`;
    html += `<div style="font-size:var(--fs-xxs);color:var(--t3);padding:8px 12px;background:var(--bg2);border-radius:8px">Expense auto-sync is currently off. It is recommended that ACC reviews expenses before syncing.</div>`;
    el.innerHTML = html;
  }

  function _bmSetTab(tab) {
    _bmTab = tab;
    _bmLoad();
  }

  function _bmMarkDirty() {
    const btn = document.getElementById('bm_save_btn');
    if (btn) { btn.style.background = 'var(--acc)'; btn.textContent = 'Save Changes ●'; }
  }

  async function _bmSave() {
    if (_bmSaving) return;
    const btn = document.getElementById('bm_save_btn');
    _bmSaving = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    try {
      // Collect bank mapping selections
      const mappings = [];
      document.querySelectorAll('[data-map-id]').forEach(sel => {
        mappings.push({ id: sel.dataset.mapId, bank_account_id: sel.value || null });
      });
      if (mappings.length > 0) await API.call('fin_save_bank_mapping', { mappings });
      App.toast('Saved');
      if (btn) { btn.style.background = ''; btn.textContent = 'Save Changes'; }
      _bmLoad(); // refresh
    } catch (e) {
      App.toast(e.message || 'Save failed');
    } finally {
      _bmSaving = false;
      if (btn) { btn.disabled = false; }
    }
  }

  // ══════════════════════════════════════════
  // 8. LINKED CATEGORIES (ac_linked) ★ E3b
  // ══════════════════════════════════════════

  let _lcRows = [];

  function renderLinkedCats() {
    return {
      tb: `<div class="tb"><div class="tb-t">Linked Categories</div><button class="bs" onclick="ScrAccounting._lcAdd()">+ Add Link</button></div>`,
      ct: `<div class="card" style="max-width:900px;margin:0 auto">
        <div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:8px">Link related categories so transactions auto-update paired accounts (e.g. Super expense → Super payable on Balance Sheet)</div>
        <table class="tbl" id="lc_tbl">
          <thead><tr>${App.sth('Source Category','src','lc_tbl')}<th style="width:30px">→</th>${App.sth('Linked Account','lnk','lc_tbl')}${App.sth('Effect','effect','lc_tbl')}${App.sth('Status','status','lc_tbl')}<th style="width:40px"></th></tr></thead>
          <tbody id="lc_tbody">${_skeleton(6)}</tbody>
        </table>
      </div>`,
    };
  }

  async function _lcLoad() {
    try {
      const result = await API.call('fin_get_linked_cats', {});
      _lcRows = result.rows || [];
      _lcRender();
    } catch (e) {
      const tbody = document.getElementById('lc_tbody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--r)">Error: ${esc(e.message)}</td></tr>`;
    }
  }

  function _lcRender() {
    const tbody = document.getElementById('lc_tbody');
    if (!tbody) return;
    if (_lcRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--t3)">No linked categories</td></tr>';
      return;
    }
    tbody.innerHTML = _lcRows.map(r => `<tr>
      <td>${esc(r.source_label)}</td>
      <td style="font-size:16px;color:var(--acc)">→</td>
      <td>${esc(r.linked_label)}</td>
      <td style="font-size:var(--fs-xxs);color:var(--t3)">${esc(r.effect || '')}</td>
      <td><span class="sts ${r.is_active ? 'sts-c' : 'sts-o'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
      <td><button class="bg" style="color:var(--acc);font-size:var(--fs-xs)" onclick="ScrAccounting._lcEdit('${r.id}')">Edit</button></td>
    </tr>`).join('');
  }

  function _lcAdd() {
    _lcShowDialog(null);
  }

  function _lcEdit(id) {
    const row = _lcRows.find(r => r.id === id);
    if (row) _lcShowDialog(row);
  }

  function _lcShowDialog(row) {
    const isEdit = !!row;
    const r = row || {};
    App.showDialog({
      title: isEdit ? 'Edit Linked Category' : 'Add Linked Category',
      message: `<div style="text-align:left">
        <div class="fg"><label class="lb">Source Category *</label><input class="inp" id="dlg_lc_src" value="${esc(r.source_label || '')}" placeholder="e.g. Expense: Payroll → Superannuation"></div>
        <div class="fg"><label class="lb">Linked Account *</label><input class="inp" id="dlg_lc_lnk" value="${esc(r.linked_label || '')}" placeholder="e.g. Liability: Super Payable"></div>
        <div class="fg"><label class="lb">Effect</label><input class="inp" id="dlg_lc_eff" value="${esc(r.effect || '')}" placeholder="Describe what happens"></div>
      </div>`,
      confirmText: isEdit ? 'Save' : 'Add',
      onConfirm: async () => {
        const src = document.getElementById('dlg_lc_src')?.value?.trim();
        const lnk = document.getElementById('dlg_lc_lnk')?.value?.trim();
        const eff = document.getElementById('dlg_lc_eff')?.value?.trim();
        if (!src || !lnk) { App.toast('Source and Linked are required'); return; }
        try {
          await API.call('fin_save_linked_cat', {
            id: isEdit ? r.id : undefined,
            source_label: src, linked_label: lnk, effect: eff,
          });
          App.toast(isEdit ? 'Updated' : 'Added');
          _lcLoad();
        } catch (e) {
          App.toast(e.message || 'Save failed');
        }
      },
    });
  }

  // ══════════════════════════════════════════
  // 9. LOANS & FINANCE (ac_loan) — 4 tabs ★ E3c
  // ══════════════════════════════════════════

  let _lnData = null;   // full dashboard data
  let _lnTab = 'external';
  let _lnSaving = false;

  function _lnTabs(active) {
    const tabs = [
      { id: 'external', label: 'External Loans' },
      { id: 'interco', label: 'Intercompany' },
      { id: 'capital', label: 'Investment & Capital' },
      { id: 'dividend', label: 'Dividends' },
    ];
    return '<div class="tabs" id="ln_tabs" style="margin-bottom:12px">'
      + tabs.map(t => `<div class="tab${t.id === active ? ' a' : ''}" onclick="ScrAccounting._lnSetTab('${t.id}')">${esc(t.label)}</div>`).join('')
      + '</div>';
  }

  function renderLoans() {
    _lnTab = 'external';
    return {
      tb: `<div class="tb"><div class="tb-t">Loans and Finance</div><div style="display:flex;gap:6px"><button class="btn bo" onclick="ScrAccounting._lnRepayModal()">+ Record Repayment</button><button class="btn bo" onclick="ScrAccounting._lnEquityModal('capital_in')">+ Equity Transaction</button><button class="bs" onclick="ScrAccounting._lnNewLoanModal()">+ Record New Loan</button></div></div>`,
      ct: `<div style="max-width:1100px;margin:0 auto"><div id="ln_kpis"></div><div id="ln_tabs_wrap">${_lnTabs('external')}</div><div id="ln_content">${_skeleton(1).replace('<tr><td', '<div style="text-align:center;padding:40px;color:var(--t3)"><div class="fin-spinner" style="margin:0 auto 8px"></div>').replace('</td></tr>', '</div>')}</div></div>`,
    };
  }

  async function _lnLoad() {
    try {
      _lnData = await API.call('fin_get_loans_dashboard', {});
      _lnRenderKpis();
      const tabsEl = document.getElementById('ln_tabs_wrap');
      if (tabsEl) tabsEl.innerHTML = _lnTabs(_lnTab);
      _lnRenderTab();
    } catch (e) {
      const el = document.getElementById('ln_content');
      if (el) el.innerHTML = `<div style="padding:20px;color:var(--r)">Error: ${esc(e.message)}</div>`;
    }
  }

  function _lnRenderKpis() {
    const el = document.getElementById('ln_kpis');
    if (!el || !_lnData) return;
    const k = _lnData.kpis || {};
    el.innerHTML = `<div class="kpi" style="flex-wrap:nowrap;margin-bottom:14px">
      <div class="kpi-c" style="border-top:3px solid var(--r)"><div class="kpi-v" style="color:var(--r)">${fm(k.loans_outstanding)}</div><div class="kpi-l">Loans Outstanding</div></div>
      <div class="kpi-c" style="border-top:3px solid var(--o)"><div class="kpi-v" style="color:var(--o)">${fm(k.interco_owing)}</div><div class="kpi-l">Intercompany Owing</div></div>
      <div class="kpi-c" style="border-top:3px solid var(--acc)"><div class="kpi-v" style="color:var(--acc)">${fm(k.capital_invested)}</div><div class="kpi-l">Total Capital Invested</div></div>
      <div class="kpi-c" style="border-top:3px solid var(--b)"><div class="kpi-v" style="color:var(--b)">${fm(k.dividends_paid_ytd)}</div><div class="kpi-l">Dividends Paid (YTD)</div></div>
      <div class="kpi-c" style="border-top:3px solid var(--g)"><div class="kpi-v" style="color:var(--g)">${fm(k.retained_earnings)}</div><div class="kpi-l">Retained Earnings</div></div>
    </div>`;
  }

  function _lnSetTab(tab) { _lnTab = tab; const tabsEl = document.getElementById('ln_tabs_wrap'); if (tabsEl) tabsEl.innerHTML = _lnTabs(tab); _lnRenderTab(); }

  function _lnRenderTab() {
    const el = document.getElementById('ln_content');
    if (!el || !_lnData) return;
    if (_lnTab === 'external') _lnRenderExternal(el);
    else if (_lnTab === 'interco') _lnRenderInterco(el);
    else if (_lnTab === 'capital') _lnRenderCapital(el);
    else if (_lnTab === 'dividend') _lnRenderDividend(el);
  }

  // ── Tab 1: External Loans ──
  function _lnRenderExternal(el) {
    const loans = _lnData.loans || [];
    if (loans.length === 0) {
      el.innerHTML = '<div class="empty" style="padding:40px">No loans recorded yet. Click "+ Record New Loan" to add one.</div>';
      return;
    }
    el.innerHTML = loans.map((l, idx) => {
      const repaid = Number(l.original_amount) - Number(l.outstanding_amount);
      const pct = l.original_amount > 0 ? Math.round((repaid / l.original_amount) * 100) : 0;
      const borderColor = l.loan_type === 'bank_loan' ? 'var(--o)' : l.loan_type === 'director_loan' ? 'var(--acc)' : 'var(--b)';
      const typeLabel = l.loan_type === 'bank_loan' ? 'Bank Loan' : l.loan_type === 'director_loan' ? 'Director Loan' : 'Equipment';
      const typeCls = l.loan_type === 'bank_loan' ? 'sts-b' : l.loan_type === 'director_loan' ? 'sts-p' : '';
      const statusCls = l.status === 'active' ? 'sts-o' : 'sts-c';
      const dim = l.status === 'paid_off' ? 'opacity:.7' : '';

      // Repayment history
      const reps = l.repayments || [];
      const repHtml = reps.length > 0 ? `<div style="font-size:var(--fs-sm);font-weight:700;margin:12px 0 6px">Repayment History</div>
        <table class="tbl" id="ln_rep_${idx}"><thead><tr>${App.sth('Date','date','ln_rep_'+idx)}${App.sth('Reference','ref','ln_rep_'+idx)}${App.sthR('Principal','principal','ln_rep_'+idx)}${App.sthR('Interest','interest','ln_rep_'+idx)}${App.sthR('Total','total','ln_rep_'+idx)}</tr></thead><tbody>
        ${reps.slice(0, 5).map(r => `<tr><td>${App.formatDateFull(r.payment_date)}</td><td>${esc(r.reference || '—')}</td><td style="text-align:right">${fm(r.principal_amount)}</td><td style="text-align:right;color:var(--t3)">${fm(r.interest_amount)}</td><td style="text-align:right;font-weight:600">${fm(r.total_amount)}</td></tr>`).join('')}
        ${reps.length > 5 ? `<tr><td colspan="5" style="font-size:var(--fs-xxs);color:var(--t3)">... ${reps.length - 5} earlier payments</td></tr>` : ''}
        </tbody></table>
        <div style="display:flex;gap:6px;margin-top:10px;justify-content:flex-end"><button class="btn bo" onclick="ScrAccounting._lnEditLoan('${l.id}')">Edit Loan</button><button class="bs" onclick="ScrAccounting._lnRepayModal('${l.id}')">Record Repayment</button></div>` : '';

      return `<div class="card" style="border-left:4px solid ${borderColor};${dim};cursor:pointer" onclick="var d=document.getElementById('lnd_${idx}');if(d)d.style.display=d.style.display==='none'?'block':'none'">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:14px;font-weight:700">${esc(l.loan_name)}</span><span class="sts ${statusCls}">${l.status === 'active' ? 'Active' : 'Paid off'}</span><span class="sts ${typeCls}">${typeLabel}</span></div>
            <div style="font-size:var(--fs-xs);color:var(--t3)">Lender: ${esc(l.lender)} · ${l.account_number ? 'Account: ' + esc(l.account_number) + ' · ' : ''}${l.brand_id ? 'Brand: ' + esc(l.brand_id) : ''}</div>
            ${l.purpose ? `<div style="font-size:var(--fs-xs);color:var(--t3);margin-top:2px">Purpose: ${esc(l.purpose)} · Start: ${App.formatDateFull(l.start_date)}${l.term_months ? ' · Term: ' + Math.floor(l.term_months / 12) + ' yrs' : ''}</div>` : ''}
          </div>
          <div style="text-align:right"><div style="font-size:22px;font-weight:800;color:${l.status === 'paid_off' ? 'var(--g)' : 'var(--r)'}">${fm(l.outstanding_amount)}</div><div style="font-size:var(--fs-xxs);color:var(--t3)">outstanding of ${fm(l.original_amount)}</div></div>
        </div>
        <div style="margin-top:8px"><div style="display:flex;justify-content:space-between;font-size:var(--fs-xxs);color:var(--t3);margin-bottom:3px"><span>Repaid ${pct}%</span><span>${fm(repaid)} of ${fm(l.original_amount)}</span></div><div style="height:6px;background:var(--bd2);border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--g);border-radius:3px"></div></div></div>
        <div style="display:flex;gap:16px;margin-top:10px;font-size:var(--fs-xs)">
          ${l.interest_rate ? `<div><span style="color:var(--t3)">Interest:</span> <b>${l.interest_rate}% p.a.</b></div>` : ''}
          ${l.monthly_repayment ? `<div><span style="color:var(--t3)">Monthly:</span> <b>${fm(l.monthly_repayment)}</b></div>` : ''}
          ${l.next_due_date ? `<div><span style="color:var(--t3)">Next due:</span> <b style="color:var(--o)">${App.formatDateFull(l.next_due_date)}</b></div>` : ''}
        </div>
      </div>
      <div id="lnd_${idx}" style="display:none"><div class="card" style="border:1.5px solid var(--acc);margin-top:-10px;border-radius:0 0 10px 10px">${repHtml || '<div style="font-size:var(--fs-xs);color:var(--t3);padding:8px">No repayments recorded yet</div>'}</div></div>`;
    }).join('');
  }

  // ── Tab 2: Intercompany ──
  function _lnRenderInterco(el) {
    const rows = (_lnData.intercompany || []).filter(i => !i.is_settled);
    const settled = (_lnData.intercompany || []).filter(i => i.is_settled);

    // Build matrix from intercompany data
    const entities = new Set();
    rows.forEach(r => { entities.add(r.debtor_entity); entities.add(r.creditor_entity); });
    settled.forEach(r => { entities.add(r.debtor_entity); entities.add(r.creditor_entity); });
    const brands = [...entities].sort();

    // Owing matrix
    const matrix = {};
    brands.forEach(b => { matrix[b] = {}; brands.forEach(b2 => { matrix[b][b2] = 0; }); });
    rows.forEach(r => { matrix[r.debtor_entity][r.creditor_entity] += Number(r.amount); });

    if (brands.length === 0) {
      el.innerHTML = '<div class="empty" style="padding:40px">No intercompany transactions yet. These are auto-generated from On Behalf / Split bills.</div>';
      return;
    }

    // Matrix table
    let html = `<div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:10px">Auto-generated from On Behalf / Split bills · Rows owe columns</div>
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px"><table class="tbl" style="text-align:center"><thead><tr><th style="text-align:left">Owes →</th>${brands.map(b => `<th>${esc(b)}</th>`).join('')}<th style="background:var(--rbg);color:var(--r)">Total Owing</th></tr></thead><tbody>`;

    brands.forEach(debtor => {
      const totalOwing = brands.reduce((s, creditor) => s + (debtor !== creditor ? matrix[debtor][creditor] : 0), 0);
      html += `<tr><td style="text-align:left;font-weight:700">${esc(debtor)}</td>`;
      brands.forEach(creditor => {
        if (debtor === creditor) html += `<td style="background:var(--bg3);color:var(--t4)">—</td>`;
        else { const v = matrix[debtor][creditor]; html += `<td style="${v > 0 ? 'font-weight:700;color:var(--r)' : 'color:var(--t4)'}">${v > 0 ? fm(v) : '$0'}</td>`; }
      });
      html += `<td style="font-weight:700;color:${totalOwing > 0 ? 'var(--r)' : 'var(--g)'}">${fm(totalOwing)}</td></tr>`;
    });
    html += '</tbody></table></div>';

    // Unsettled transactions table
    if (rows.length > 0) {
      html += `<div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:6px">Unsettled Transactions (${rows.length})</div>
        <div class="card" style="padding:0;overflow:hidden"><table class="tbl" id="ln_ic_tbl"><thead><tr>${App.sth('Date','date','ln_ic_tbl')}${App.sth('Debtor','debtor','ln_ic_tbl')}${App.sth('Creditor','creditor','ln_ic_tbl')}${App.sth('Source','source','ln_ic_tbl')}${App.sth('Description','desc','ln_ic_tbl')}${App.sthR('Amount','amount','ln_ic_tbl')}</tr></thead><tbody>
        ${rows.map(r => {
          const srcCls = r.source_type === 'on_behalf' ? 'sts-o' : r.source_type === 'split' ? 'sts-p' : 'sts-c';
          return `<tr><td>${App.formatDateFull(r.created_at?.substring(0,10))}</td><td style="font-weight:600;color:var(--r)">${esc(r.debtor_entity)}</td><td style="font-weight:600;color:var(--g)">${esc(r.creditor_entity)}</td><td><span class="sts ${srcCls}" style="font-size:8px">${esc(r.source_type)}</span></td><td style="font-size:var(--fs-xs)">${esc(r.description || '')}</td><td style="text-align:right;font-weight:600">${fm(r.amount)}</td></tr>`;
        }).join('')}
        </tbody></table></div>`;
    }

    el.innerHTML = html;
  }

  // ── Tab 3: Investment & Capital ──
  function _lnRenderCapital(el) {
    const equity = _lnData.equity || [];
    const capital = equity.filter(e => e.equity_type === 'capital_in' || e.equity_type === 'capital_out');
    const totalInvested = capital.filter(e => e.equity_type === 'capital_in').reduce((s, e) => s + Number(e.amount), 0);

    let html = '';
    if (capital.length === 0) {
      html = '<div class="empty" style="padding:40px">No capital transactions yet. Click "+ Equity Transaction" to record one.</div>';
    } else {
      html += `<div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:6px">Capital Transaction History</div>
        <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px"><table class="tbl" id="ln_cap_tbl"><thead><tr>${App.sth('Date','date','ln_cap_tbl')}${App.sth('Type','type','ln_cap_tbl')}${App.sth('Investor','investor','ln_cap_tbl')}${App.sth('Brand','brand','ln_cap_tbl')}${App.sth('Description','desc','ln_cap_tbl')}${App.sthR('Amount','amount','ln_cap_tbl')}${App.sth('Ref','ref','ln_cap_tbl')}</tr></thead><tbody>
        ${capital.map(e => `<tr><td>${App.formatDateFull(e.transaction_date)}</td><td><span class="sts sts-p">${e.equity_type === 'capital_in' ? 'Capital In' : 'Capital Out'}</span></td><td style="font-weight:600">${esc(e.person_name)}</td><td>${esc(e.entity_id || '—')}</td><td style="font-size:var(--fs-xs)">${esc(e.description || '')}</td><td style="text-align:right;font-weight:600;color:${e.equity_type === 'capital_in' ? 'var(--g)' : 'var(--r)'}">${e.equity_type === 'capital_in' ? '+' : '-'}${fm(e.amount)}</td><td style="font-size:var(--fs-xs)">${esc(e.reference || '—')}</td></tr>`).join('')}
        </tbody><tfoot><tr style="border-top:2px solid var(--bd);font-weight:700"><td colspan="5">Total Capital Invested</td><td style="text-align:right;color:var(--g)">${fm(totalInvested)}</td><td></td></tr></tfoot></table></div>`;
    }
    html += `<div style="display:flex;gap:6px;justify-content:flex-end"><button class="bs" onclick="ScrAccounting._lnEquityModal('capital_in')">+ Record Capital Injection</button></div>`;
    el.innerHTML = html;
  }

  // ── Tab 4: Dividends ──
  function _lnRenderDividend(el) {
    const equity = _lnData.equity || [];
    const k = _lnData.kpis || {};
    const paid = equity.filter(e => e.equity_type === 'dividend_paid');
    const planned = equity.filter(e => e.equity_type === 'dividend_planned');

    // Summary KPIs
    let html = `<div style="display:flex;gap:8px;margin-bottom:12px">
      <div class="card" style="flex:1;margin:0;text-align:center;border-top:3px solid var(--b)"><div style="font-size:var(--fs-xxs);color:var(--t3)">Dividends Paid (YTD)</div><div style="font-size:20px;font-weight:700;color:var(--b)">${fm(k.dividends_paid_ytd)}</div></div>
      <div class="card" style="flex:1;margin:0;text-align:center;border-top:3px solid var(--g)"><div style="font-size:var(--fs-xxs);color:var(--t3)">Retained Earnings</div><div style="font-size:20px;font-weight:700;color:var(--g)">${fm(k.retained_earnings)}</div></div>
      <div class="card" style="flex:1;margin:0;text-align:center;border-top:3px solid var(--o)"><div style="font-size:var(--fs-xxs);color:var(--t3)">Planned (not yet paid)</div><div style="font-size:20px;font-weight:700;color:var(--o)">${fm(k.dividends_planned)}</div></div>
    </div>`;

    // Planned
    if (planned.length > 0) {
      html += `<div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:6px;color:var(--o)">Planned Distributions</div>`;
      planned.forEach(e => {
        html += `<div class="card" style="border-left:4px solid var(--o);margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:var(--fs-body);font-weight:700">${esc(e.description || e.period || 'Dividend')} — ${esc(e.person_name)}</div><div style="font-size:var(--fs-xs);color:var(--t3)">Planned: ${App.formatDateFull(e.transaction_date)}</div></div><div style="font-size:18px;font-weight:800;color:var(--o)">${fm(e.amount)}</div></div></div>`;
      });
    }

    // Paid history
    if (paid.length > 0) {
      html += `<div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:6px">Dividend History</div>
        <div class="card" style="padding:0;overflow:hidden"><table class="tbl" id="ln_div_tbl"><thead><tr>${App.sth('Date','date','ln_div_tbl')}${App.sth('Recipient','recipient','ln_div_tbl')}${App.sth('Description','desc','ln_div_tbl')}${App.sth('Period','period','ln_div_tbl')}${App.sthR('Amount','amount','ln_div_tbl')}${App.sth('Ref','ref','ln_div_tbl')}${App.sth('Status','status','ln_div_tbl')}</tr></thead><tbody>
        ${paid.map(e => `<tr><td>${App.formatDateFull(e.transaction_date)}</td><td style="font-weight:600">${esc(e.person_name)}</td><td>${esc(e.description || '')}</td><td>${esc(e.period || '')}</td><td style="text-align:right;font-weight:600">${fm(e.amount)}</td><td style="font-size:var(--fs-xs)">${esc(e.reference || '—')}</td><td><span class="sts sts-c">Paid</span></td></tr>`).join('')}
        </tbody></table></div>`;
    }

    html += `<div style="display:flex;gap:6px;margin-top:10px;justify-content:flex-end"><button class="bs" onclick="ScrAccounting._lnEquityModal('dividend_paid')">+ Record Dividend</button></div>`;
    el.innerHTML = html;
  }

  // ── Modals ──
  function _lnNewLoanModal() {
    let bankOpts = '<option value="">— Select —</option>';
    (App.S.bankAccounts || []).forEach(b => { bankOpts += `<option value="${b.id}">${esc(b.label)}</option>`; });

    App.showDialog({
      title: 'Record New Loan',
      message: `<div style="text-align:left">
        <div class="fr"><div class="fg"><label class="lb">Loan Name *</label><input class="inp" id="dlg_ln_name" placeholder="e.g. ANZ Business Loan"></div><div class="fg"><label class="lb">Lender *</label><input class="inp" id="dlg_ln_lender" placeholder="e.g. ANZ"></div></div>
        <div class="fr"><div class="fg"><label class="lb">Type</label><select class="inp" id="dlg_ln_type"><option value="bank_loan">Bank Loan</option><option value="director_loan">Director Loan</option><option value="equipment_finance">Equipment Finance</option></select></div><div class="fg"><label class="lb">Amount *</label><input class="inp" id="dlg_ln_amt" type="number" step="0.01" placeholder="100000"></div></div>
        <div class="fr"><div class="fg"><label class="lb">Interest Rate (%)</label><input class="inp" id="dlg_ln_rate" type="number" step="0.1" value="0"></div><div class="fg"><label class="lb">Monthly Repayment</label><input class="inp" id="dlg_ln_monthly" type="number" step="0.01"></div></div>
        <div class="fr"><div class="fg"><label class="lb">Start Date *</label><input class="inp" id="dlg_ln_start" type="date" value="${App.today()}"></div><div class="fg"><label class="lb">Term (months)</label><input class="inp" id="dlg_ln_term" type="number" placeholder="60"></div></div>
        <div class="fr"><div class="fg"><label class="lb">Brand</label><input class="inp" id="dlg_ln_brand" placeholder="e.g. Mango Coco"></div><div class="fg"><label class="lb">Purpose</label><input class="inp" id="dlg_ln_purpose" placeholder="e.g. Fit-out"></div></div>
        <div class="fg"><label class="lb">Bank Account</label><select class="inp" id="dlg_ln_bank">${bankOpts}</select></div>
      </div>`,
      confirmText: 'Create Loan',
      onConfirm: async () => {
        try {
          await API.call('fin_create_loan', {
            loan_name: document.getElementById('dlg_ln_name')?.value?.trim(),
            lender: document.getElementById('dlg_ln_lender')?.value?.trim(),
            loan_type: document.getElementById('dlg_ln_type')?.value,
            original_amount: parseFloat(document.getElementById('dlg_ln_amt')?.value) || 0,
            interest_rate: parseFloat(document.getElementById('dlg_ln_rate')?.value) || 0,
            monthly_repayment: parseFloat(document.getElementById('dlg_ln_monthly')?.value) || 0,
            start_date: document.getElementById('dlg_ln_start')?.value,
            term_months: parseInt(document.getElementById('dlg_ln_term')?.value) || null,
            brand_id: document.getElementById('dlg_ln_brand')?.value?.trim() || null,
            purpose: document.getElementById('dlg_ln_purpose')?.value?.trim() || null,
            bank_account_id: document.getElementById('dlg_ln_bank')?.value || null,
          });
          App.toast('Loan created');
          _lnLoad();
        } catch (e) { App.toast(e.message || 'Create failed'); }
      },
    });
  }

  function _lnEditLoan(id) {
    const loan = (_lnData.loans || []).find(l => l.id === id);
    if (!loan) return;
    App.showDialog({
      title: 'Edit Loan: ' + (loan.loan_name || ''),
      message: `<div style="text-align:left">
        <div class="fr"><div class="fg"><label class="lb">Next Due Date</label><input class="inp" id="dlg_le_due" type="date" value="${loan.next_due_date || ''}"></div><div class="fg"><label class="lb">Monthly Repayment</label><input class="inp" id="dlg_le_monthly" type="number" step="0.01" value="${loan.monthly_repayment || 0}"></div></div>
        <div class="fg"><label class="lb">Notes</label><input class="inp" id="dlg_le_notes" value="${esc(loan.notes || '')}"></div>
        <div class="fg"><label class="lb">Status</label><select class="inp" id="dlg_le_status"><option value="active" ${loan.status==='active'?'selected':''}>Active</option><option value="paid_off" ${loan.status==='paid_off'?'selected':''}>Paid off</option></select></div>
      </div>`,
      confirmText: 'Save',
      onConfirm: async () => {
        try {
          await API.call('fin_update_loan', {
            id,
            next_due_date: document.getElementById('dlg_le_due')?.value || null,
            monthly_repayment: parseFloat(document.getElementById('dlg_le_monthly')?.value) || 0,
            notes: document.getElementById('dlg_le_notes')?.value || null,
            status: document.getElementById('dlg_le_status')?.value || 'active',
          });
          App.toast('Loan updated');
          _lnLoad();
        } catch (e) { App.toast(e.message || 'Update failed'); }
      },
    });
  }

  function _lnRepayModal(loanId) {
    const loans = (_lnData?.loans || []).filter(l => l.status === 'active');
    let loanOpts = '<option value="">— Select —</option>';
    loans.forEach(l => { loanOpts += `<option value="${l.id}" ${l.id === loanId ? 'selected' : ''}>${esc(l.loan_name)} (${fm(l.outstanding_amount)})</option>`; });

    App.showDialog({
      title: 'Record Repayment',
      message: `<div style="text-align:left">
        <div class="fg"><label class="lb">Loan *</label><select class="inp" id="dlg_rp_loan">${loanOpts}</select></div>
        <div class="fr"><div class="fg"><label class="lb">Principal *</label><input class="inp" id="dlg_rp_prin" type="number" step="0.01" placeholder="0.00"></div><div class="fg"><label class="lb">Interest</label><input class="inp" id="dlg_rp_int" type="number" step="0.01" placeholder="0.00"></div></div>
        <div class="fr"><div class="fg"><label class="lb">Date</label><input class="inp" id="dlg_rp_date" type="date" value="${App.today()}"></div><div class="fg"><label class="lb">Reference</label><input class="inp" id="dlg_rp_ref" placeholder="e.g. PAY-1290"></div></div>
      </div>`,
      confirmText: 'Record Payment',
      onConfirm: async () => {
        try {
          await API.call('fin_record_repayment', {
            loan_id: document.getElementById('dlg_rp_loan')?.value,
            principal_amount: parseFloat(document.getElementById('dlg_rp_prin')?.value) || 0,
            interest_amount: parseFloat(document.getElementById('dlg_rp_int')?.value) || 0,
            payment_date: document.getElementById('dlg_rp_date')?.value,
            reference: document.getElementById('dlg_rp_ref')?.value?.trim() || null,
          });
          App.toast('Repayment recorded');
          _lnLoad();
        } catch (e) { App.toast(e.message || 'Failed'); }
      },
    });
  }

  function _lnEquityModal(type) {
    const title = type === 'capital_in' ? 'Record Capital Injection' : type === 'capital_out' ? 'Record Capital Withdrawal' : 'Record Dividend';
    App.showDialog({
      title,
      message: `<div style="text-align:left">
        <div class="fr"><div class="fg"><label class="lb">Person / Investor *</label><input class="inp" id="dlg_eq_person" placeholder="e.g. Khun Or"></div><div class="fg"><label class="lb">Amount *</label><input class="inp" id="dlg_eq_amt" type="number" step="0.01"></div></div>
        <div class="fr"><div class="fg"><label class="lb">Brand / Entity</label><input class="inp" id="dlg_eq_brand" placeholder="e.g. SPG Group"></div><div class="fg"><label class="lb">Date</label><input class="inp" id="dlg_eq_date" type="date" value="${App.today()}"></div></div>
        <div class="fr"><div class="fg"><label class="lb">Description</label><input class="inp" id="dlg_eq_desc" placeholder=""></div><div class="fg"><label class="lb">Reference</label><input class="inp" id="dlg_eq_ref" placeholder="e.g. EQ-005"></div></div>
        ${type.startsWith('dividend') ? '<div class="fg"><label class="lb">Period</label><input class="inp" id="dlg_eq_period" placeholder="e.g. Q1 2026"></div>' : '<div class="fg"><label class="lb">Purpose</label><input class="inp" id="dlg_eq_purpose" placeholder="e.g. Store fit-out"></div>'}
      </div>`,
      confirmText: title.replace('Record ', ''),
      onConfirm: async () => {
        try {
          await API.call('fin_create_equity', {
            equity_type: type,
            person_name: document.getElementById('dlg_eq_person')?.value?.trim(),
            amount: parseFloat(document.getElementById('dlg_eq_amt')?.value) || 0,
            entity_id: document.getElementById('dlg_eq_brand')?.value?.trim() || null,
            transaction_date: document.getElementById('dlg_eq_date')?.value,
            description: document.getElementById('dlg_eq_desc')?.value?.trim() || null,
            reference: document.getElementById('dlg_eq_ref')?.value?.trim() || null,
            purpose: document.getElementById('dlg_eq_purpose')?.value?.trim() || null,
            period: document.getElementById('dlg_eq_period')?.value?.trim() || null,
            status: type === 'dividend_planned' ? 'pending' : 'completed',
          });
          App.toast('Recorded');
          _lnLoad();
        } catch (e) { App.toast(e.message || 'Failed'); }
      },
    });
  }

  // ══════════════════════════════════════════
  // 10. GENERAL JOURNAL (ac_journal) ★ E3c-1
  // ══════════════════════════════════════════

  let _jnEntries = [];
  let _jnView = 'list'; // 'list' or 'create'
  let _jnLines = [{ category_display: '', debit: '', credit: '', tax_code: 'FRE' }, { category_display: '', debit: '', credit: '', tax_code: 'FRE' }];
  let _jnSaving = false;

  function renderJournal() {
    _jnView = 'list';
    return {
      tb: `<div class="tb"><div class="tb-t">General Journal</div><button class="bs" onclick="ScrAccounting._jnNewEntry()">+ New Journal Entry</button></div>`,
      ct: `<div style="max-width:900px;margin:0 auto" id="jn_wrap"></div>`,
    };
  }

  async function _jnLoad() {
    const el = document.getElementById('jn_wrap');
    if (!el) return;
    if (_jnView === 'create') { _jnRenderCreate(el); return; }

    try {
      const result = await API.call('fin_get_journals', {});
      _jnEntries = result.rows || [];
      _jnRenderList(el);
    } catch (e) {
      el.innerHTML = `<div style="padding:20px;color:var(--r)">Error: ${esc(e.message)}</div>`;
    }
  }

  function _jnRenderList(el) {
    if (_jnEntries.length === 0) {
      el.innerHTML = '<div class="empty" style="padding:40px">No journal entries yet. Click "+ New Journal Entry" to create one.</div>';
      return;
    }
    el.innerHTML = `<div class="card" style="padding:0;overflow:hidden"><table class="tbl" id="jn_tbl"><thead><tr>${App.sth('Journal No','jno','jn_tbl')}${App.sth('Date','date','jn_tbl')}${App.sth('Description','desc','jn_tbl')}${App.sthR('Debit','debit','jn_tbl')}${App.sthR('Credit','credit','jn_tbl')}${App.sth('Status','status','jn_tbl')}</tr></thead><tbody>
      ${_jnEntries.map(e => `<tr>
        <td style="font-weight:600;color:var(--acc)">${esc(e.journal_no)}</td>
        <td>${App.formatDateFull(e.entry_date)}</td>
        <td>${esc(e.description || '—')}</td>
        <td style="text-align:right">${fm(e.total_debit)}</td>
        <td style="text-align:right">${fm(e.total_credit)}</td>
        <td><span class="sts ${e.status === 'posted' ? 'sts-c' : e.status === 'reversed' ? 'sts-o' : 'sts-p'}">${esc(e.status)}</span></td>
      </tr>`).join('')}
    </tbody></table></div>
    <div style="font-size:var(--fs-xxs);color:var(--t3);margin-top:6px">${_jnEntries.length} entries</div>`;
  }

  function _jnNewEntry() {
    _jnView = 'create';
    _jnLines = [
      { category_display: '', debit: '', credit: '', tax_code: 'FRE' },
      { category_display: '', debit: '', credit: '', tax_code: 'FRE' },
    ];
    _jnLoad();
  }

  async function _jnRenderCreate(el) {
    // Get next journal number
    let jnNo = 'GJ-0001';
    try {
      const r = await API.call('fin_get_next_journal_no', {});
      jnNo = r.journal_no || jnNo;
    } catch (e) { /* use default */ }

    // Category options from S.categories
    let catOpts = '<option value="">— Select account —</option>';
    (App.S.categories || []).forEach(c => {
      catOpts += `<option value="${esc((c.account_code || '') + ' ' + c.sub_category)}">${esc((c.account_code ? c.account_code + ' ' : '') + c.sub_category)}</option>`;
    });

    // Tax code options
    let taxOpts = '';
    (App.S.taxCodes || []).forEach(t => {
      taxOpts += `<option value="${esc(t.code)}">${esc(t.code)}</option>`;
    });

    el.innerHTML = `<div class="card">
      <div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:8px">Manual journal entries for adjustments</div>
      <div class="fr">
        <div class="fg"><label class="lb">Journal Number *</label><input class="inp" id="jn_no" value="${esc(jnNo)}" readonly style="background:var(--bg3);color:var(--t3)"></div>
        <div class="fg"><label class="lb">Date *</label><input class="inp" id="jn_date" type="date" value="${App.today()}"></div>
        <div class="fg"><label class="lb">Description</label><input class="inp" id="jn_desc" placeholder="e.g. Monthly accrual adjustment"></div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:var(--fs-sm);margin-top:10px">
        <thead><tr>
          <th style="text-align:left;padding:8px;font-weight:700;width:38%">Account</th>
          <th style="text-align:left;padding:8px;font-weight:700;width:20%">Debit ($)</th>
          <th style="text-align:left;padding:8px;font-weight:700;width:20%">Credit ($)</th>
          <th style="text-align:left;padding:8px;font-weight:700;width:14%">Tax code</th>
          <th style="width:8%"></th>
        </tr></thead>
        <tbody id="jn_lines"></tbody>
      </table>
      <div style="margin-top:6px"><a class="lk" style="font-size:var(--fs-xs);cursor:pointer" onclick="ScrAccounting._jnAddLine()">+ Add line</a></div>
      <div id="jn_totals" style="text-align:right;margin-top:10px;font-size:var(--fs-sm)"></div>
      <div style="display:flex;gap:6px;margin-top:14px;justify-content:flex-end;padding-top:10px;border-top:1px solid var(--bd2)">
        <button class="btn bo" onclick="ScrAccounting._jnBackToList()">Cancel</button>
        <button class="bs" id="jn_save_btn" onclick="ScrAccounting._jnSave()">Save Journal</button>
      </div>
    </div>`;

    // Store options for dynamic rendering
    _jnCatOpts = catOpts;
    _jnTaxOpts = taxOpts;
    _jnRenderLines();
  }

  let _jnCatOpts = '';
  let _jnTaxOpts = '';

  function _jnRenderLines() {
    const tbody = document.getElementById('jn_lines');
    if (!tbody) return;
    tbody.innerHTML = _jnLines.map((l, i) => `<tr>
      <td style="padding:0;border:1px solid var(--bd)"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm);font-family:inherit" data-jn-line="${i}" data-jn-field="category_display" onchange="ScrAccounting._jnLineChange(${i},'category_display',this.value)">${_jnCatOpts.replace(`value="${esc(l.category_display)}"`, `value="${esc(l.category_display)}" selected`)}</select></td>
      <td style="padding:0;border:1px solid var(--bd)"><input style="width:100%;padding:8px;border:none;text-align:right;font-size:var(--fs-sm)" value="${l.debit}" placeholder="0.00" oninput="ScrAccounting._jnLineChange(${i},'debit',this.value)"></td>
      <td style="padding:0;border:1px solid var(--bd)"><input style="width:100%;padding:8px;border:none;text-align:right;font-size:var(--fs-sm)" value="${l.credit}" placeholder="0.00" oninput="ScrAccounting._jnLineChange(${i},'credit',this.value)"></td>
      <td style="padding:0;border:1px solid var(--bd)"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm)" onchange="ScrAccounting._jnLineChange(${i},'tax_code',this.value)">${_jnTaxOpts.replace(`value="${esc(l.tax_code)}"`, `value="${esc(l.tax_code)}" selected`)}</select></td>
      <td style="text-align:center">${_jnLines.length > 2 ? `<button class="bg" style="color:var(--r);font-size:14px" onclick="ScrAccounting._jnRemoveLine(${i})">✕</button>` : ''}</td>
    </tr>`).join('');
    _jnCalcTotals();
  }

  function _jnLineChange(idx, field, val) {
    if (_jnLines[idx]) _jnLines[idx][field] = val;
    _jnCalcTotals();
  }

  function _jnAddLine() {
    _jnLines.push({ category_display: '', debit: '', credit: '', tax_code: 'FRE' });
    _jnRenderLines();
  }

  function _jnRemoveLine(idx) {
    if (_jnLines.length <= 2) return;
    _jnLines.splice(idx, 1);
    _jnRenderLines();
  }

  function _jnCalcTotals() {
    const el = document.getElementById('jn_totals');
    if (!el) return;
    let totalD = 0, totalC = 0;
    _jnLines.forEach(l => { totalD += parseFloat(l.debit) || 0; totalC += parseFloat(l.credit) || 0; });
    const balanced = Math.abs(totalD - totalC) < 0.01;
    el.innerHTML = `<span style="margin-right:20px">Total Debit: <b>${fm(totalD)}</b></span><span>Total Credit: <b>${fm(totalC)}</b></span> <span style="color:${balanced ? 'var(--g)' : 'var(--r)'};margin-left:8px">${balanced ? '✓ Balanced' : '✗ Not balanced'}</span>`;
  }

  function _jnBackToList() {
    _jnView = 'list';
    _jnLoad();
  }

  async function _jnSave() {
    if (_jnSaving) return;
    const date = document.getElementById('jn_date')?.value;
    if (!date) { App.toast('Date is required'); return; }

    // Validate balanced
    let totalD = 0, totalC = 0;
    _jnLines.forEach(l => { totalD += parseFloat(l.debit) || 0; totalC += parseFloat(l.credit) || 0; });
    if (Math.abs(totalD - totalC) > 0.01) { App.toast('Debit and Credit must be balanced'); return; }
    if (totalD === 0) { App.toast('Enter at least one debit/credit amount'); return; }

    // Validate at least one line has account
    const validLines = _jnLines.filter(l => l.category_display && ((parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0));
    if (validLines.length < 2) { App.toast('At least 2 lines with accounts required'); return; }

    _jnSaving = true;
    const btn = document.getElementById('jn_save_btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    try {
      await API.call('fin_create_journal', {
        entry_date: date,
        description: document.getElementById('jn_desc')?.value?.trim() || null,
        lines: validLines.map(l => ({
          category_display: l.category_display,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          tax_code: l.tax_code || 'FRE',
        })),
      });
      App.toast('Journal entry created');
      _jnView = 'list';
      _jnLoad();
    } catch (e) {
      App.toast(e.message || 'Save failed');
    } finally {
      _jnSaving = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Save Journal'; }
    }
  }

  // ══════════════════════════════════════════
  // REGISTER ROUTES
  // ══════════════════════════════════════════
  App.registerRoutes({
    ac_coa:        { render: renderCOA, onLoad: _loadCOA },
    ac_coa_create: { render: renderCreateCategory, onLoad: _onCatFormLoad },
    ac_coa_edit:   { render: renderEditCategory, onLoad: _onCatFormLoad },
    ac_tax:        { render: renderTaxCodes, onLoad: _loadTax },
    ac_rules:      { render: renderBankRules, onLoad: _brLoad },
    ac_hub:        { render: renderBankingHub, onLoad: _hubLoad },
    ac_map:        { render: renderBankMap, onLoad: _bmLoad },
    ac_linked:     { render: renderLinkedCats, onLoad: _lcLoad },
    ac_loan:       { render: renderLoans, onLoad: _lnLoad },
    ac_journal:    { render: renderJournal, onLoad: _jnLoad },
  });

  // ══════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════
  window.ScrAccounting = {
    _setCoaTab, _onSearch, _toggleInactive, _resetCoaFilters,
    _toggleAllCoa, _editCategory, _goLinked, _onTxTypeChange,
    _saveCat, _toggleActive, _deleteCat, _editTax,
    // E3a
    _brToggleMenu, _brOpenModal, _brSetFilter, _brResetFilters,
    _brToggleActive, _brSave, _brDelete, _brOnVendorChange, _brUpdateSubCats,
    // E3a: Hub brand filter
    _hubSetBrand,
    // E3b
    _bmSetTab, _bmMarkDirty, _bmSave, _bmSetBrand, _lcAdd, _lcEdit,
    // E3c: Loans
    _lnSetTab, _lnNewLoanModal, _lnEditLoan, _lnRepayModal, _lnEquityModal,
    // E3c-1: Journal
    _jnNewEntry, _jnAddLine, _jnRemoveLine, _jnLineChange, _jnBackToList, _jnSave,
  };

})();
