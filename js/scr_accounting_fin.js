/** Version 1.0.1 | 14 MAR 2026 | Siam Palette Group */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_accounting_fin.js
 * Accounting screens: COA List, Create, Edit, Tax Codes
 * ═══════════════════════════════════════════
 *
 * SCREENS:
 *   ac_coa        — Categories (Chart of Accounts) full list
 *   ac_coa_create — Create Category form
 *   ac_coa_edit   — Edit Category form (+ bank details if type=Bank)
 *   ac_tax        — Tax Codes list + inline edit
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

  // ── Category type options (from wireframe) ──
  const CAT_TYPES = [
    'Bank', 'Account receivable', 'Other current asset', 'Fixed asset', 'Other asset',
    'Credit card', 'Account payable', 'Other current liability', 'Long term liability',
    'Equity', 'Income', 'Cost of sales', 'Expense', 'Other income', 'Other expense',
  ];

  // Map account_type → transaction_type (classification)
  const TYPE_TO_CLASS = {
    'Bank': 'Asset', 'Account receivable': 'Asset', 'Other current asset': 'Asset',
    'Fixed asset': 'Asset', 'Other asset': 'Asset',
    'Credit card': 'Liability', 'Account payable': 'Liability',
    'Other current liability': 'Liability', 'Long term liability': 'Liability',
    'Equity': 'Equity', 'Income': 'Income', 'Cost of sales': 'Cost of Sales',
    'Expense': 'Expense', 'Other income': 'Other Income', 'Other expense': 'Other Expense',
  };

  /** Infer account_type from transaction_type for old records that don't have account_type set */
  function _inferAccountType(txType) {
    if (!txType) return '';
    const map = {
      'Income': 'Income', 'Expense': 'Expense', 'Asset Purchase': 'Fixed asset',
      'Transfer': 'Bank', 'Loan': 'Long term liability',
      'Asset': 'Other current asset', 'Liability': 'Other current liability',
      'Equity': 'Equity', 'Cost of Sales': 'Cost of sales',
      'Other Income': 'Other income', 'Other Expense': 'Other expense',
    };
    return map[txType] || '';
  }

  // Tab filter options
  const COA_TABS = ['All', 'Asset', 'Liability', 'Equity', 'Income', 'Cost of Sales', 'Expense', 'Other Income', 'Other Expense'];

  // Map tab label → transaction_type values to match
  const TAB_FILTER_MAP = {
    'All': null,
    'Asset': ['Income', 'Expense', 'Asset Purchase', 'Transfer', 'Loan', 'Asset'],
    'Liability': ['Liability'],
    'Equity': ['Equity'],
    'Income': ['Income'],
    'Cost of Sales': ['Cost of Sales'],
    'Expense': ['Expense'],
    'Other Income': ['Other Income'],
    'Other Expense': ['Other Expense'],
  };

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

    // Group by transaction_type for Level 1 headers
    let lastType = '';
    let html = '';

    _coaRows.forEach(r => {
      // Level 1 header row
      if (r.level === 1 || (r.transaction_type !== lastType && r.level !== 1)) {
        if (r.transaction_type !== lastType) {
          lastType = r.transaction_type;
          // Insert a header row for each group
          html += `<tr style="background:var(--bg2)"><td><input type="checkbox" style="accent-color:var(--acc)"></td><td></td><td style="font-weight:700;color:var(--acc);font-size:var(--fs-body)">${esc(r.transaction_type)}</td><td>${esc(r.transaction_type)}</td><td></td><td></td><td style="font-weight:600">Level 1</td><td style="text-align:right;font-weight:700">${fm(_coaRows.filter(x => x.transaction_type === r.transaction_type).reduce((s, x) => s + (x.current_balance || 0), 0))}</td></tr>`;
        }
      }

      if (r.level === 1) return; // skip rendering level 1 as data row — already shown as header

      const balColor = r.current_balance < 0 ? 'color:var(--r)' : '';
      const balWeight = r.is_linked ? 'font-weight:600' : '';
      const nameWeight = r.is_linked ? 'font-weight:600' : '';
      const inactive = !r.is_active ? 'opacity:0.45' : '';
      const linked = r.is_linked ? `<span class="sts sts-p" style="font-size:9px">Linked</span>` : '';

      html += `<tr style="cursor:pointer;${inactive}" onclick="ScrAccounting._editCategory('${r.id}')">
        <td onclick="event.stopPropagation()"><input type="checkbox" data-coa-id="${r.id}" style="accent-color:var(--acc)"></td>
        <td style="${nameWeight}">${esc(r.account_code || '')}</td>
        <td><a class="lk" style="${nameWeight}">${esc(r.sub_category)}</a></td>
        <td style="font-size:var(--fs-xs)">${esc(r.account_type || r.transaction_type)}</td>
        <td>${esc(r.tax_code || '')}</td>
        <td>${linked}</td>
        <td style="font-size:var(--fs-xxs);color:var(--t3)">Level ${r.level || 2}</td>
        <td style="text-align:right;${balColor};${balWeight}">${fm(r.current_balance || 0)}</td>
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

    // Resolve account_type: use stored value, or infer from transaction_type for old records
    const resolvedAccountType = c.account_type || _inferAccountType(c.transaction_type) || '';
    const isBank = (resolvedAccountType === 'Bank');

    // Category type options — match resolved type
    const typeOpts = CAT_TYPES.map(t =>
      `<option value="${t}"${t === resolvedAccountType ? ' selected' : ''}>${t}</option>`
    ).join('');

    // Tax code options
    const taxCodes = App.S.taxCodes || [];
    const tcOpts = taxCodes.map(t =>
      `<option value="${t.code}"${t.code === (c.tax_code || '') ? ' selected' : ''}>${t.code}</option>`
    ).join('');

    // Balance + linked info bar (edit only)
    const infoBar = isEdit ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg3);border-radius:var(--rd);margin-bottom:14px"><div><div style="font-size:var(--fs-xs);font-weight:600">Linked category for</div><div style="font-size:var(--fs-xs);color:var(--t3)">${c.is_linked ? esc(c.linked_description || 'Linked') : '—'}</div></div><div style="text-align:right"><div style="font-size:var(--fs-xs);font-weight:600">Current balance</div><div style="font-size:var(--fs-h1);font-weight:700">${fm(c.current_balance || 0)}</div></div></div>` : '';

    // Classification (auto from type)
    const classDisplay = resolvedAccountType ? (TYPE_TO_CLASS[resolvedAccountType] || c.transaction_type || '—') : (c.transaction_type || '—');

    // Form row helper
    const frow = (label, req, content) =>
      `<div style="display:flex;align-items:center;margin-bottom:10px"><div style="width:150px;text-align:right;padding-right:14px;font-size:var(--fs-sm);color:var(--t2)">${label}${req ? ' <span style="color:var(--acc)">*</span>' : ''}</div><div style="max-width:340px;flex:1">${content}</div></div>`;

    let html = `<div class="card" style="max-width:660px;margin:0 auto">
      ${infoBar}
      <div style="font-size:var(--fs-body);font-weight:700;margin-bottom:2px">Category details</div>
      <div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:14px">These details impact the category and its priority order in the Chart of Accounts.</div>

      <div style="display:flex;align-items:center;margin-bottom:10px">
        <div style="width:150px;text-align:right;padding-right:14px;font-size:var(--fs-sm);color:var(--t2)">Category level <span style="color:var(--acc)">*</span></div>
        <div>
          <label style="font-size:var(--fs-sm);display:flex;align-items:center;gap:6px"><input type="radio" name="cat_level" value="2"${(c.level || 2) === 2 ? ' checked' : ''} style="accent-color:var(--acc)"> Detail category</label>
          <label style="font-size:var(--fs-sm);display:flex;align-items:center;gap:6px;margin-top:4px"><input type="radio" name="cat_level" value="1"${c.level === 1 ? ' checked' : ''} style="accent-color:var(--acc)"> Header category</label>
        </div>
      </div>

      <div style="display:flex;align-items:center;margin-bottom:10px">
        <div style="width:150px;text-align:right;padding-right:14px;font-size:var(--fs-sm);color:var(--t2)">Classification</div>
        <div id="cat_class" style="font-size:var(--fs-sm);font-weight:600">${esc(classDisplay)}</div>
      </div>

      ${frow('Category type', true, `<select class="inp" id="cat_type" onchange="ScrAccounting._onTypeChange(this.value)"><option value="">Select an option</option>${typeOpts}</select>`)}
      ${frow('Parent header', true, `<select class="inp" id="cat_parent"><option value="">Select an option</option></select>`)}
      ${frow('Category code', true, `<input class="inp" id="cat_code" value="${esc(c.account_code || '')}" placeholder="e.g. 688" style="max-width:140px">`)}
      ${frow('Category name', true, `<input class="inp" id="cat_name" value="${esc(c.sub_category || '')}" placeholder="e.g. Term Deposit #5015">`)}
      ${frow('Opening balance ($)', false, `<input class="inp" id="cat_balance" value="${(c.current_balance || 0).toFixed(2)}" style="text-align:right">`)}
      ${frow('Tax code', true, `<select class="inp" id="cat_tax" style="max-width:100px"><option value=""></option>${tcOpts}</select>`)}

      <div style="display:flex;align-items:flex-start;margin-bottom:10px">
        <div style="width:150px;text-align:right;padding-right:14px;font-size:var(--fs-sm);color:var(--t2);padding-top:6px">Notes</div>
        <div style="max-width:340px;flex:1"><textarea class="inp" id="cat_notes" style="min-height:50px;resize:vertical">${esc(c.notes || '')}</textarea></div>
      </div>`;

    // Bank details section (edit only, when type = Bank)
    if (isEdit && isBank) {
      html += `
      <div style="font-size:var(--fs-body);font-weight:700;margin:18px 0 10px;padding-top:10px;border-top:1px solid var(--bd2)">Bank account details</div>
      <div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:10px">These details are linked from the bank_accounts table.</div>
      <div style="padding:10px 14px;background:var(--bg2);border-radius:var(--rd);font-size:var(--fs-xs);color:var(--t3)">Bank account details are managed in Banking Hub. <a class="lk" onclick="App.go('ac_hub')">Go to Banking Hub →</a></div>`;
    }

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
    // Ensure COA data is available for parent header dropdown
    if (_coaRows.length === 0) {
      API.getCoa({ show_inactive: false }).then(res => {
        _coaRows = res.rows || [];
        _populateParentHeaders();
      });
    } else {
      _populateParentHeaders();
    }
  }

  function _onEditLoad() {
    // Ensure COA data is available for parent header dropdown
    if (_coaRows.length === 0) {
      API.getCoa({ show_inactive: false }).then(res => {
        _coaRows = res.rows || [];
        _populateParentHeaders();
      });
    } else {
      _populateParentHeaders();
    }
  }

  function _onTypeChange(val) {
    // Update classification display
    const clEl = document.getElementById('cat_class');
    if (clEl) clEl.textContent = TYPE_TO_CLASS[val] || '—';
    _populateParentHeaders();
  }

  /** Populate parent header dropdown from existing categories */
  function _populateParentHeaders() {
    const sel = document.getElementById('cat_parent');
    if (!sel) return;
    const typeEl = document.getElementById('cat_type');
    const selectedType = typeEl ? typeEl.value : '';
    const classification = TYPE_TO_CLASS[selectedType] || '';

    // Strategy: find Level 1 headers first, fallback to unique main_categories
    let headers = _coaRows.filter(r => r.level === 1 && r.transaction_type === classification);

    // Fallback: if no Level 1 headers, collect unique main_category values for this classification
    if (headers.length === 0 && classification) {
      const matchingRows = _coaRows.filter(r => {
        // Match by transaction_type OR by inferred classification
        const rowClass = TYPE_TO_CLASS[r.account_type] || r.transaction_type || '';
        return rowClass === classification || r.transaction_type === classification;
      });
      const seen = new Set();
      headers = [];
      matchingRows.forEach(r => {
        if (r.main_category && !seen.has(r.main_category)) {
          seen.add(r.main_category);
          headers.push({ sub_category: r.main_category });
        }
      });
    }

    let opts = '<option value="">Select an option</option>';
    const editMain = _editingCat ? _editingCat.main_category : '';
    if (headers.length > 0) {
      headers.forEach(h => {
        const label = h.sub_category || h.main_category || '';
        const selected = label === editMain ? ' selected' : '';
        opts += `<option value="${esc(label)}"${selected}>${esc(label)}</option>`;
      });
      // If editing and current main_category not in list, add it
      if (editMain && !headers.some(h => (h.sub_category || h.main_category) === editMain)) {
        opts += `<option value="${esc(editMain)}" selected>${esc(editMain)}</option>`;
      }
    } else if (classification) {
      // No headers at all — offer the classification as default
      const selected = editMain === classification || !editMain ? ' selected' : '';
      opts += `<option value="${esc(classification)}"${selected}>${esc(classification)}</option>`;
      if (editMain && editMain !== classification) {
        opts += `<option value="${esc(editMain)}" selected>${esc(editMain)}</option>`;
      }
    } else if (editMain) {
      // No classification resolved — just show current value
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
      const level = parseInt(document.querySelector('input[name="cat_level"]:checked')?.value || '2');
      const account_type = document.getElementById('cat_type')?.value || '';
      const classification = TYPE_TO_CLASS[account_type] || account_type;
      const main_category = document.getElementById('cat_parent')?.value || classification;
      const account_code = document.getElementById('cat_code')?.value?.trim() || '';
      const sub_category = document.getElementById('cat_name')?.value?.trim() || '';
      const current_balance = parseFloat(document.getElementById('cat_balance')?.value) || 0;
      const tax_code = document.getElementById('cat_tax')?.value || 'FRE';

      if (!sub_category) { App.toast('Category name is required'); return; }
      if (!account_type) { App.toast('Category type is required'); return; }

      const data = {
        transaction_type: classification,
        main_category,
        sub_category,
        account_type,
        level,
        account_code: account_code || null,
        current_balance,
        tax_code,
      };

      if (id) {
        // Update
        data.id = id;
        if (_editingCat) data.expected_updated_at = _editingCat.updated_at;
        await API.updateCategory(data);
        App.toast('Category updated');
      } else {
        // Create
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
  // REGISTER ROUTES
  // ══════════════════════════════════════════
  App.registerRoutes({
    ac_coa:        { render: renderCOA, onLoad: _loadCOA },
    ac_coa_create: { render: renderCreateCategory, onLoad: _onCreateLoad },
    ac_coa_edit:   { render: renderEditCategory, onLoad: _onEditLoad },
    ac_tax:        { render: renderTaxCodes, onLoad: _loadTax },
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
    _onTypeChange,
    _saveCat,
    _toggleActive,
    _deleteCat,
    _editTax,
  };

})();
