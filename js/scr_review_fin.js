/** Version 1.0.2 | 16 MAR 2026 | Siam Palette Group */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_review_fin.js
 * Review Monitor: Pending Tracker, Recurring Setup, Expected Invoices
 * Lazy-loaded by app_fin.js on first visit to rv_* routes
 * ═══════════════════════════════════════════
 *
 * CHANGED v1.0.1 → v1.0.2:
 * - [DELETED] _skeleton() — use App.skeleton()
 * - [DELETED] _fmtDate() — use App.formatDate() with '—' fallback
 * ═══════════════════════════════════════════
 */

(() => {
  const esc = App.esc;
  const fm = App.formatMoney;

  // ── Local state ──
  let _kpi = { missing: 0, recurring: 0, expected: 0, pnlGap: 0 };
  let _pendingRows = [];
  let _pendingFilter = 'all'; // all | overdue | due_soon
  let _recurringRows = [];
  let _expectedRows = [];
  let _filterMonth = '';
  let _filterBrand = '';

  // ══════════════════════════════════════════
  // SHARED: KPI bar (4 cards) — used by all 3 screens
  // ══════════════════════════════════════════
  function _kpiBar(active) {
    const items = [
      { id: 'rv_pending',   val: _kpi.missing,   label: 'Missing Bills',      color: 'var(--r)',   bg: 'var(--rbg)' },
      { id: 'rv_recurring', val: _kpi.recurring,  label: 'Recurring Rules',    color: 'var(--t1)',  bg: '#fff' },
      { id: 'rv_expected',  val: _kpi.expected,   label: 'Expected Invoices',  color: 'var(--b)',   bg: '#fff' },
      { id: '_gap',         val: '$' + _fmtShort(_kpi.pnlGap), label: 'Est. P&L Gap', color: 'var(--r)', bg: 'var(--rbg)' },
    ];
    return '<div class="kpi" style="gap:0;border-radius:var(--rd);overflow:hidden;border:1px solid var(--bd)">'
      + items.map(k => {
        const isActive = k.id === active;
        const bgStyle = isActive ? 'background:' + (k.id === 'rv_recurring' ? 'var(--acc2)' : k.bg) : 'background:#fff';
        const valColor = isActive && k.id === 'rv_recurring' ? 'var(--acc)' : k.color;
        const lblColor = isActive && k.id === 'rv_recurring' ? 'var(--acc)' : (isActive ? k.color : 'var(--t3)');
        const clickable = k.id !== '_gap' ? ` cursor:pointer" onclick="App.go('${k.id}')` : '"';
        return `<div style="flex:1;padding:10px 14px;text-align:center;${bgStyle};${clickable}>`
          + `<div style="font-size:var(--fs-kpi-md);font-weight:800;color:${valColor}">${typeof k.val === 'number' ? k.val : k.val}</div>`
          + `<div style="font-size:var(--fs-xs);color:${lblColor}">${k.label}</div>`
          + '</div>';
      }).join('')
      + '</div>';
  }

  // ══════════════════════════════════════════
  // SHARED: Tabs (Pending / Recurring / Expected)
  // ══════════════════════════════════════════
  function _tabs(active) {
    const tabs = [
      { id: 'rv_pending',   label: 'Pending Tracker' },
      { id: 'rv_recurring', label: 'Recurring Setup' },
      { id: 'rv_expected',  label: 'Expected Invoices' },
    ];
    return '<div class="tabs">'
      + tabs.map(t =>
        `<div class="tab${t.id === active ? ' a' : ''}" onclick="App.go('${t.id}')">${esc(t.label)}</div>`
      ).join('')
      + '</div>';
  }

  // ══════════════════════════════════════════
  // SHARED: Toolbar — same for all 3 screens
  // ══════════════════════════════════════════
  function _toolbar(active) {
    const extraBtns = active === 'rv_pending'
      ? `<button class="btn bo" onclick="App.go('rv_expected')">+ Expected Invoice</button><button class="bs" onclick="App.go('rv_recurring')">+ Recurring Rule</button>`
      : active === 'rv_recurring'
        ? `<button class="bs" onclick="ScrReview._createRecurring()">+ Create Recurring Rule</button>`
        : `<button class="bs" onclick="ScrReview._createExpected()">+ Add Expected Invoice</button>`;

    return '<div class="tb"><div class="tb-t">Review Monitor</div>'
      + `<select class="fl" id="rv_month" onchange="ScrReview._setMonth(this.value)"><option value="">All Months</option></select>`
      + `<select class="fl" id="rv_brand" onchange="ScrReview._setBrand(this.value)"><option value="">All Brands</option></select>`
      + extraBtns + '</div>';
  }

  // ══════════════════════════════════════════
  // SHARED — aliases from App
  // ══════════════════════════════════════════
  const _skeleton = App.skeleton;
  const _fmtDate = (d) => App.formatDate(d) || '—';

  // Short money format
  function _fmtShort(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'K';
    return String(n);
  }

  // Days diff helper
  function _daysDiff(dateStr) {
    if (!dateStr) return 0;
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((now - d) / 86400000);
  }

  // ══════════════════════════════════════════
  // 1. PENDING TRACKER (rv_pending)
  // ══════════════════════════════════════════
  function renderPending() {
    return {
      tb: _toolbar('rv_pending'),
      ct: `<div style="max-width:1060px;margin:0 auto">
        ${_kpiBar('rv_pending')}
        ${_tabs('rv_pending')}
        <div style="display:flex;gap:4px;margin-bottom:8px">
          <button class="btn bo rv-chip${_pendingFilter === 'all' ? ' rv-chip-a' : ''}" onclick="ScrReview._filterPending('all')" id="rv_chip_all">All</button>
          <button class="btn bo rv-chip${_pendingFilter === 'overdue' ? ' rv-chip-a' : ''}" onclick="ScrReview._filterPending('overdue')" id="rv_chip_overdue">Overdue</button>
          <button class="btn bo rv-chip${_pendingFilter === 'due_soon' ? ' rv-chip-a' : ''}" onclick="ScrReview._filterPending('due_soon')" id="rv_chip_due_soon">Due soon</button>
        </div>
        <div class="card" style="padding:0;overflow:hidden;margin:0">
          <table class="tbl" id="rv_pend_tbl"><thead><tr>
            ${App.sth('Source','source','rv_pend_tbl')}${App.sth('Vendor','vendor','rv_pend_tbl')}${App.sth('Expected Item','item','rv_pend_tbl')}${App.sth('Frequency','freq','rv_pend_tbl')}
            ${App.sthR('Est. $','est','rv_pend_tbl')}${App.sth('Due','due','rv_pend_tbl')}${App.sth('Status','status','rv_pend_tbl')}<th>Action</th>
          </tr></thead>
          <tbody id="rv_pending_body">${_skeleton(8)}</tbody>
          </table>
        </div>
      </div>`,
    };
  }

  function _renderPendingRows() {
    const tbody = document.getElementById('rv_pending_body');
    if (!tbody) return;

    // Filter
    let rows = _pendingRows;
    if (_pendingFilter === 'overdue') rows = rows.filter(r => r.days_late > 0);
    else if (_pendingFilter === 'due_soon') rows = rows.filter(r => r.days_late <= 0 && r.days_until_due <= 7);

    // Update chip counts
    const allCount = _pendingRows.length;
    const overdueCount = _pendingRows.filter(r => r.days_late > 0).length;
    const dueSoonCount = _pendingRows.filter(r => r.days_late <= 0 && r.days_until_due <= 7).length;
    const chipAll = document.getElementById('rv_chip_all');
    const chipOver = document.getElementById('rv_chip_overdue');
    const chipDue = document.getElementById('rv_chip_due_soon');
    if (chipAll) chipAll.textContent = `All (${allCount})`;
    if (chipOver) chipOver.textContent = `Overdue (${overdueCount})`;
    if (chipDue) chipDue.textContent = `Due soon (${dueSoonCount})`;

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--t3)">No pending items</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const isOverdue = r.days_late > 0;
      const isDueSoon = !isOverdue && r.days_until_due <= 7 && r.days_until_due >= 0;
      const rowBg = isOverdue ? 'background:var(--rbg)' : '';

      // Source badge
      const srcBadge = r.source === 'recurring'
        ? '<span class="sts sts-p" style="font-size:var(--fs-xs)">Recurring</span>'
        : r.source === 'pattern'
          ? '<span class="sts sts-d" style="font-size:var(--fs-xs)">Pattern</span>'
          : '<span style="font-size:var(--fs-xs);color:var(--t3);border:1px solid var(--bd);padding:1px 6px;border-radius:3px">Expected</span>';

      // Status badge
      let stsBadge;
      if (isOverdue) {
        stsBadge = `<span class="sts sts-r">${r.days_late} days late</span>`;
      } else if (isDueSoon) {
        stsBadge = `<span class="sts sts-p">Due in ${r.days_until_due}d</span>`;
      } else {
        stsBadge = '<span class="sts sts-c">On time</span>';
      }

      // Action
      let actionHtml = '';
      if (isOverdue && r.days_late > 3) {
        actionHtml = `<button class="bs" style="padding:3px 8px;font-size:var(--fs-xs)" onclick="ScrReview._createBillFrom('${r.rule_id || ''}','${r.expected_id || ''}')">Create Bill</button>`;
      } else if (isOverdue) {
        actionHtml = `<button class="btn bo" style="padding:3px 8px;font-size:var(--fs-xs);color:var(--r);border-color:var(--r)">Chase</button>`;
      }

      // Last matched
      const lastMatch = r.last_matched_ref
        ? `<span style="font-size:var(--fs-xs)">${esc(r.last_matched_ref)} · ${_fmtDate(r.last_matched_date)} · ${fm(r.last_matched_amount || 0)}</span>`
        : '<span style="font-size:var(--fs-xs);color:var(--t3)">—</span>';

      return `<tr style="${rowBg}">
        <td>${srcBadge}</td>
        <td style="font-weight:600">${esc(r.vendor_name)}</td>
        <td>${esc(r.item_description)}</td>
        <td>${esc(r.frequency)}</td>
        <td style="text-align:right">~${fm(r.est_amount)}</td>
        <td style="color:${isOverdue ? 'var(--r)' : isDueSoon ? 'var(--o)' : 'var(--t1)'}">${_fmtDate(r.due_date)}</td>
        <td>${stsBadge}</td>
        <td>${actionHtml}</td>
      </tr>`;
    }).join('');
  }

  // ══════════════════════════════════════════
  // 2. RECURRING SETUP (rv_recurring)
  // ══════════════════════════════════════════
  function renderRecurring() {
    return {
      tb: _toolbar('rv_recurring'),
      ct: `<div style="max-width:1060px;margin:0 auto">
        ${_kpiBar('rv_recurring')}
        ${_tabs('rv_recurring')}
        <div class="card" style="padding:0;overflow:hidden;margin:0">
          <table class="tbl" id="rv_rec_tbl"><thead><tr>
            ${App.sth('Vendor','vendor','rv_rec_tbl')}${App.sth('Item','item','rv_rec_tbl')}${App.sth('Frequency','freq','rv_rec_tbl')}
            ${App.sthR('Est. Amount','est','rv_rec_tbl')}${App.sth('Next Due','due','rv_rec_tbl')}
            ${App.sth('Last Matched Bill','lastmatch','rv_rec_tbl')}${App.sth('Status','status','rv_rec_tbl')}<th></th>
          </tr></thead>
          <tbody id="rv_recurring_body">${_skeleton(8)}</tbody>
          </table>
        </div>
        <div style="font-size:var(--fs-xs);color:var(--t3);margin-top:8px">"Last Matched Bill" = system auto-checks if a bill from this vendor arrived within the expected window. If not → MISSING.</div>
      </div>`,
    };
  }

  function _renderRecurringRows() {
    const tbody = document.getElementById('rv_recurring_body');
    if (!tbody) return;

    if (_recurringRows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--t3)">No recurring rules yet. Click "+ Create Recurring Rule" to add one.</td></tr>`;
      return;
    }

    tbody.innerHTML = _recurringRows.map(r => {
      const days = _daysDiff(r.next_due_date);
      const isLate = days > 0;
      const isMissing = isLate && !r.last_matched_recent;

      // Status
      let stsBadge;
      if (isMissing) stsBadge = '<span class="sts sts-r">MISSING</span>';
      else if (isLate) stsBadge = `<span class="sts sts-p">${days} days late</span>`;
      else stsBadge = '<span class="sts sts-c">On time</span>';

      // Last matched bill info
      const lastMatch = r.last_matched_ref
        ? `<span style="font-size:var(--fs-xs)">${esc(r.last_matched_ref)} · ${_fmtDate(r.last_matched_date)} · ${fm(r.last_matched_amount || 0)}</span>`
        : '<span style="font-size:var(--fs-xs);color:var(--t3)">—</span>';

      // Frequency display
      const freqDisplay = r.frequency === 'monthly' && r.day_of_month
        ? `Monthly (${r.day_of_month}${_ordSuffix(r.day_of_month)})`
        : r.frequency === 'weekly' && r.day_of_week != null
          ? `Weekly (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][r.day_of_week]})`
          : r.frequency.charAt(0).toUpperCase() + r.frequency.slice(1);

      return `<tr>
        <td style="font-weight:600">${esc(r.vendor_name)}</td>
        <td>${esc(r.item_description)}</td>
        <td>${esc(freqDisplay)}</td>
        <td style="text-align:right">${r.est_amount > 0 ? '~' + fm(r.est_amount) : '—'}</td>
        <td style="color:${isLate ? 'var(--r)' : 'var(--t1)'}">${_fmtDate(r.next_due_date)}</td>
        <td>${lastMatch}</td>
        <td>${stsBadge}</td>
        <td><a class="lk" style="font-size:var(--fs-xs)" onclick="ScrReview._editRecurring('${r.id}')">Edit</a></td>
      </tr>`;
    }).join('');
  }

  // Ordinal suffix
  function _ordSuffix(n) {
    if (n >= 11 && n <= 13) return 'th';
    switch (n % 10) {
      case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th';
    }
  }

  // ══════════════════════════════════════════
  // 3. EXPECTED INVOICES (rv_expected)
  // ══════════════════════════════════════════
  function renderExpected() {
    return {
      tb: _toolbar('rv_expected'),
      ct: `<div style="max-width:1060px;margin:0 auto">
        ${_kpiBar('rv_expected')}
        ${_tabs('rv_expected')}
        <div class="card" style="padding:0;overflow:hidden;margin:0">
          <table class="tbl" id="rv_exp_tbl"><thead><tr>
            ${App.sth('Created','created','rv_exp_tbl')}${App.sth('By','by','rv_exp_tbl')}${App.sth('Vendor','vendor','rv_exp_tbl')}${App.sth('Description','desc','rv_exp_tbl')}
            ${App.sthR('Est. $','est','rv_exp_tbl')}${App.sth('Expected Date','expdate','rv_exp_tbl')}
            ${App.sth('Days Waiting','days','rv_exp_tbl')}${App.sth('Responsible','resp','rv_exp_tbl')}${App.sth('Status','status','rv_exp_tbl')}<th>Action</th>
          </tr></thead>
          <tbody id="rv_expected_body">${_skeleton(10)}</tbody>
          </table>
        </div>
        <div style="font-size:var(--fs-xs);color:var(--t3);margin-top:8px">Staff creates expected invoices when work is done but invoice not yet received. System alerts when overdue.</div>
      </div>`,
    };
  }

  function _renderExpectedRows() {
    const tbody = document.getElementById('rv_expected_body');
    if (!tbody) return;

    const active = _expectedRows.filter(r => r.status !== 'received' && r.status !== 'cancelled');

    if (active.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--t3)">No expected invoices. Click "+ Add Expected Invoice" to add one.</td></tr>`;
      return;
    }

    tbody.innerHTML = active.map(r => {
      const days = _daysDiff(r.expected_date);
      const isOverdue = days > 0;

      // Status
      let stsBadge;
      if (r.status === 'overdue' || isOverdue) stsBadge = '<span class="sts sts-r">Overdue</span>';
      else stsBadge = '<span class="sts sts-p">Waiting</span>';

      // Action
      const actionHtml = isOverdue
        ? `<button class="btn bo" style="padding:3px 8px;font-size:var(--fs-xs);color:var(--r);border-color:var(--r)" onclick="ScrReview._chaseExpected('${r.id}')">Chase</button>`
        : '';

      return `<tr>
        <td style="font-size:var(--fs-xs)">${_fmtDate(r.created_at ? r.created_at.substring(0, 10) : '')}</td>
        <td>${esc(r.created_by_name || r.created_by || '—')}</td>
        <td style="font-weight:600">${esc(r.vendor_name)}</td>
        <td>${esc(r.description)}</td>
        <td style="text-align:right;font-weight:700">~${fm(r.est_amount)}</td>
        <td>${_fmtDate(r.expected_date)}</td>
        <td style="color:${isOverdue ? 'var(--r)' : 'var(--t3)'};font-weight:${isOverdue ? '700' : '400'}">${isOverdue ? days + ' days' : '—'}</td>
        <td>${esc(r.responsible || '—')}</td>
        <td>${stsBadge}</td>
        <td>${actionHtml}</td>
      </tr>`;
    }).join('');
  }

  // ══════════════════════════════════════════
  // DATA LOADING — shared across all 3 screens
  // ══════════════════════════════════════════
  async function _loadReviewData(activeRoute) {
    try {
      App.showLoader();

      // Load KPIs + review data from API
      const data = await API.call('fin_get_review_dashboard', {
        month: _filterMonth || undefined,
        brand: _filterBrand || undefined,
      });

      // Update KPIs
      _kpi.missing = data.missing_count || 0;
      _kpi.recurring = data.recurring_count || 0;
      _kpi.expected = data.expected_count || 0;
      _kpi.pnlGap = data.pnl_gap || 0;

      // Refresh KPI bar in DOM
      const kpiContainer = document.querySelector('.kpi');
      if (kpiContainer) {
        kpiContainer.outerHTML = _kpiBar(activeRoute);
      }

      // Store pending rows (aggregated from recurring + expected)
      _pendingRows = data.pending_items || [];

      // Populate month filter
      _populateMonthFilter();
      _populateBrandFilter();

    } catch (e) {
      console.warn('Review dashboard API failed:', e.message);
      // Leave skeleton / empty state
    } finally {
      App.hideLoader();
    }
  }

  async function _loadRecurringList() {
    try {
      const data = await API.call('fin_get_recurring_rules', {
        brand: _filterBrand || undefined,
      });
      _recurringRows = data.rules || [];
    } catch (e) {
      console.warn('Get recurring rules failed:', e.message);
      _recurringRows = [];
    }
  }

  async function _loadExpectedList() {
    try {
      const data = await API.call('fin_get_expected_invoices', {
        brand: _filterBrand || undefined,
      });
      _expectedRows = data.invoices || [];
    } catch (e) {
      console.warn('Get expected invoices failed:', e.message);
      _expectedRows = [];
    }
  }

  // ══════════════════════════════════════════
  // onLoad handlers — called after render
  // ══════════════════════════════════════════
  async function onLoadPending() {
    await _loadReviewData('rv_pending');
    _renderPendingRows();
  }

  async function onLoadRecurring() {
    await Promise.all([
      _loadReviewData('rv_recurring'),
      _loadRecurringList(),
    ]);
    _renderRecurringRows();
  }

  async function onLoadExpected() {
    await Promise.all([
      _loadReviewData('rv_expected'),
      _loadExpectedList(),
    ]);
    _renderExpectedRows();
  }

  // ══════════════════════════════════════════
  // FILTER ACTIONS
  // ══════════════════════════════════════════
  function _filterPending(filter) {
    _pendingFilter = filter;
    // Update chip active state
    document.querySelectorAll('.rv-chip').forEach(el => el.classList.remove('rv-chip-a'));
    const active = document.getElementById('rv_chip_' + filter);
    if (active) active.classList.add('rv-chip-a');
    _renderPendingRows();
  }

  function _setMonth(val) {
    _filterMonth = val;
    // Reload current screen
    const route = App.S.route;
    if (route === 'rv_pending') onLoadPending();
    else if (route === 'rv_recurring') onLoadRecurring();
    else if (route === 'rv_expected') onLoadExpected();
  }

  function _setBrand(val) {
    _filterBrand = val;
    const route = App.S.route;
    if (route === 'rv_pending') onLoadPending();
    else if (route === 'rv_recurring') onLoadRecurring();
    else if (route === 'rv_expected') onLoadExpected();
  }

  function _populateMonthFilter() {
    const sel = document.getElementById('rv_month');
    if (!sel) return;
    const now = new Date();
    let opts = '<option value="">All Months</option>';
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = d.toISOString().substring(0, 7);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      opts += `<option value="${val}"${val === _filterMonth ? ' selected' : ''}>${label}</option>`;
    }
    sel.innerHTML = opts;
  }

  function _populateBrandFilter() {
    const sel = document.getElementById('rv_brand');
    if (!sel) return;
    const brands = App.S.brands || [];
    let opts = '<option value="">All Brands</option>';
    brands.forEach(b => {
      opts += `<option value="${esc(b.brand_id || b.id)}"${b.brand_id === _filterBrand ? ' selected' : ''}>${esc(b.brand_name || b.name)}</option>`;
    });
    sel.innerHTML = opts;
  }

  // ══════════════════════════════════════════
  // CRUD ACTIONS
  // ══════════════════════════════════════════

  // ── Create Recurring Rule (modal) ──
  function _createRecurring() {
    _showRecurringModal(null);
  }

  function _editRecurring(id) {
    const rule = _recurringRows.find(r => r.id === id);
    if (rule) _showRecurringModal(rule);
  }

  function _showRecurringModal(existing) {
    const isEdit = !!existing;
    const title = isEdit ? 'Edit Recurring Rule' : 'Create Recurring Rule';
    const vendors = App.S.vendors || [];
    const categories = App.S.categories || [];

    App.showDialog({
      title,
      html: `
        <div class="fg">
          <label class="lb">Vendor *</label>
          <select class="inp" id="rr_vendor">
            <option value="">— Select vendor —</option>
            ${vendors.map(v => `<option value="${esc(v.id)}" data-name="${esc(v.vendor_name)}"${existing && existing.vendor_id === v.id ? ' selected' : ''}>${esc(v.vendor_name)}</option>`).join('')}
          </select>
        </div>
        <div class="fg">
          <label class="lb">Item Description *</label>
          <input class="inp" id="rr_item" value="${esc(existing?.item_description || '')}" placeholder="e.g. Weekly food delivery">
        </div>
        <div class="fr">
          <div class="fg">
            <label class="lb">Frequency *</label>
            <select class="inp" id="rr_freq" onchange="ScrReview._onFreqChange()">
              <option value="daily"${existing?.frequency === 'daily' ? ' selected' : ''}>Daily</option>
              <option value="weekly"${existing?.frequency === 'weekly' ? ' selected' : ''}>Weekly</option>
              <option value="fortnightly"${existing?.frequency === 'fortnightly' ? ' selected' : ''}>Fortnightly</option>
              <option value="monthly"${!existing || existing?.frequency === 'monthly' ? ' selected' : ''}>Monthly</option>
              <option value="quarterly"${existing?.frequency === 'quarterly' ? ' selected' : ''}>Quarterly</option>
              <option value="yearly"${existing?.frequency === 'yearly' ? ' selected' : ''}>Yearly</option>
            </select>
          </div>
          <div class="fg" id="rr_dom_wrap" style="${existing?.frequency === 'weekly' ? 'display:none' : ''}">
            <label class="lb">Day of Month</label>
            <input class="inp" id="rr_dom" type="number" min="1" max="31" value="${existing?.day_of_month || 1}">
          </div>
          <div class="fg" id="rr_dow_wrap" style="${existing?.frequency === 'weekly' || existing?.frequency === 'fortnightly' ? '' : 'display:none'}">
            <label class="lb">Day of Week</label>
            <select class="inp" id="rr_dow">
              ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => `<option value="${i}"${existing?.day_of_week === i ? ' selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="fr">
          <div class="fg">
            <label class="lb">Est. Amount ($)</label>
            <input class="inp" id="rr_amount" type="number" step="0.01" min="0" value="${existing?.est_amount || ''}">
          </div>
          <div class="fg">
            <label class="lb">Category</label>
            <select class="inp" id="rr_cat">
              <option value="">— Optional —</option>
              ${categories.map(c => `<option value="${esc(c.id)}"${existing?.category_id === c.id ? ' selected' : ''}>${esc(c.category_name || c.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="fg">
          <label class="lb">Brand</label>
          <select class="inp" id="rr_brand">
            <option value="">— All —</option>
            ${(App.S.brands || []).map(b => `<option value="${esc(b.brand_id || b.id)}"${existing?.brand_id === (b.brand_id || b.id) ? ' selected' : ''}>${esc(b.brand_name || b.name)}</option>`).join('')}
          </select>
        </div>`,
      confirmText: isEdit ? 'Save Changes' : 'Create Rule',
      onConfirm: () => _saveRecurring(existing?.id),
    });
  }

  function _onFreqChange() {
    const freq = document.getElementById('rr_freq')?.value;
    const domWrap = document.getElementById('rr_dom_wrap');
    const dowWrap = document.getElementById('rr_dow_wrap');
    if (domWrap) domWrap.style.display = (freq === 'weekly' || freq === 'fortnightly' || freq === 'daily') ? 'none' : '';
    if (dowWrap) dowWrap.style.display = (freq === 'weekly' || freq === 'fortnightly') ? '' : 'none';
  }

  async function _saveRecurring(existingId) {
    const vendorEl = document.getElementById('rr_vendor');
    const vendor_id = vendorEl?.value;
    const vendor_name = vendorEl?.selectedOptions[0]?.dataset.name || '';
    const item_description = document.getElementById('rr_item')?.value.trim();
    const frequency = document.getElementById('rr_freq')?.value;
    const day_of_month = parseInt(document.getElementById('rr_dom')?.value) || null;
    const day_of_week = parseInt(document.getElementById('rr_dow')?.value);
    const est_amount = parseFloat(document.getElementById('rr_amount')?.value) || 0;
    const category_id = document.getElementById('rr_cat')?.value || null;
    const brand_id = document.getElementById('rr_brand')?.value || null;

    if (!item_description) return App.toast('Item description is required', 1500);

    try {
      App.showLoader();
      if (existingId) {
        await API.call('fin_update_recurring_rule', {
          id: existingId, vendor_id, vendor_name, item_description,
          frequency, day_of_month, day_of_week, est_amount, category_id, brand_id,
        });
        // Update memory
        const idx = _recurringRows.findIndex(r => r.id === existingId);
        if (idx >= 0) Object.assign(_recurringRows[idx], { vendor_id, vendor_name, item_description, frequency, day_of_month, day_of_week, est_amount, category_id, brand_id });
        App.toast('Rule updated');
      } else {
        const result = await API.call('fin_create_recurring_rule', {
          vendor_id, vendor_name, item_description,
          frequency, day_of_month, day_of_week, est_amount, category_id, brand_id,
        });
        // Push to memory
        if (result.rule) _recurringRows.push(result.rule);
        App.toast('Rule created');
      }
      _renderRecurringRows();
    } catch (e) {
      App.toast('Error: ' + e.message, 2000);
    } finally {
      App.hideLoader();
    }
  }

  // ── Create Expected Invoice (modal) ──
  function _createExpected() {
    const vendors = App.S.vendors || [];

    App.showDialog({
      title: 'Add Expected Invoice',
      html: `
        <div class="fg">
          <label class="lb">Vendor *</label>
          <select class="inp" id="ei_vendor">
            <option value="">— Select or type —</option>
            ${vendors.map(v => `<option value="${esc(v.id)}" data-name="${esc(v.vendor_name)}">${esc(v.vendor_name)}</option>`).join('')}
          </select>
        </div>
        <div class="fg">
          <label class="lb">Description *</label>
          <input class="inp" id="ei_desc" placeholder="e.g. Kitchen pipe repair — Mango Coco">
        </div>
        <div class="fr">
          <div class="fg">
            <label class="lb">Est. Amount ($) *</label>
            <input class="inp" id="ei_amount" type="number" step="0.01" min="0">
          </div>
          <div class="fg">
            <label class="lb">Expected Date *</label>
            <input class="inp" id="ei_date" type="date">
          </div>
        </div>
        <div class="fr">
          <div class="fg">
            <label class="lb">Responsible</label>
            <input class="inp" id="ei_resp" placeholder="Who should chase this?">
          </div>
          <div class="fg">
            <label class="lb">Brand</label>
            <select class="inp" id="ei_brand">
              <option value="">— All —</option>
              ${(App.S.brands || []).map(b => `<option value="${esc(b.brand_id || b.id)}">${esc(b.brand_name || b.name)}</option>`).join('')}
            </select>
          </div>
        </div>`,
      confirmText: 'Add Expected',
      onConfirm: _saveExpected,
    });
  }

  async function _saveExpected() {
    const vendorEl = document.getElementById('ei_vendor');
    const vendor_id = vendorEl?.value || null;
    const vendor_name = vendorEl?.selectedOptions[0]?.dataset.name || '';
    const description = document.getElementById('ei_desc')?.value.trim();
    const est_amount = parseFloat(document.getElementById('ei_amount')?.value) || 0;
    const expected_date = document.getElementById('ei_date')?.value;
    const responsible = document.getElementById('ei_resp')?.value.trim();
    const brand_id = document.getElementById('ei_brand')?.value || null;

    if (!description) return App.toast('Description is required', 1500);
    if (!expected_date) return App.toast('Expected date is required', 1500);
    if (est_amount <= 0) return App.toast('Amount must be > 0', 1500);

    try {
      App.showLoader();
      const result = await API.call('fin_create_expected_invoice', {
        vendor_id, vendor_name, description, est_amount, expected_date, responsible, brand_id,
      });
      if (result.invoice) _expectedRows.push(result.invoice);
      _kpi.expected++;
      App.toast('Expected invoice added');
      _renderExpectedRows();
    } catch (e) {
      App.toast('Error: ' + e.message, 2000);
    } finally {
      App.hideLoader();
    }
  }

  // ── Chase expected invoice ──
  function _chaseExpected(id) {
    App.toast('Chase notification — coming soon');
  }

  // ── Create bill from pending item ──
  function _createBillFrom(ruleId, expectedId) {
    // Navigate to cr_bill with pre-fill params
    App.go('cr_bill', { prefill_rule: ruleId || undefined, prefill_expected: expectedId || undefined });
  }

  // ══════════════════════════════════════════
  // REGISTER ROUTES
  // ══════════════════════════════════════════
  App.registerRoutes({
    rv_pending:   { render: renderPending,   onLoad: onLoadPending },
    rv_recurring: { render: renderRecurring, onLoad: onLoadRecurring },
    rv_expected:  { render: renderExpected,  onLoad: onLoadExpected },
  });

  // ══════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════
  window.ScrReview = {
    _filterPending,
    _setMonth,
    _setBrand,
    _createRecurring,
    _editRecurring,
    _onFreqChange,
    _createExpected,
    _chaseExpected,
    _createBillFrom,
  };

})();
