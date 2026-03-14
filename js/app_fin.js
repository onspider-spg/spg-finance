/** Version 2.0.1 | 14 MAR 2026 | Siam Palette Group | Created 12 MAR 2026 */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — app_fin.js
 * Router + Sidebar + Topbar + Shared Utilities
 * ═══════════════════════════════════════════
 *
 * FUNCTION MAP (P1):
 *   App.init()            — entry point, call API.init, build shell, start router
 *   App.go(route)         — navigate to a screen (with lazy load)
 *   App.esc(str)          — HTML escape
 *   App.formatMoney(n)    — format number as $x,xxx.xx
 *   App.formatDate(str)   — format ISO date to DD/MM
 *   App.toast(msg,ms)     — show toast notification
 *   App.showLoader()      — show loading spinner
 *   App.hideLoader()      — hide loading spinner
 *   App.showDialog(opt)   — show confirm/alert dialog (replaces native confirm())
 *   App.statusBadge(s)    — return HTML for status badge
 *   App._hardRefresh()    — clear all memory → re-init (like fresh open)
 *   --- internal ---
 *   _buildTopbar()        — render topbar
 *   _buildSidebar()       — render full sidebar nav
 *   _toggleSidebar()      — collapse/expand sidebar
 *   _highlightNav(route)  — highlight active sidebar item
 *   _loadScript(src)      — lazy load a JS file (once)
 *   _resolveRoute(route)  — load script for route if needed, then render
 * ═══════════════════════════════════════════
 */

const App = (() => {

  // ── STATE ──
  const S = {
    token: null,
    session: null,
    route: '',
    // Master data (populated by API.initBundle)
    brands: [],
    channels: [],
    bankAccounts: [],
    taxCodes: [],
    accountTypes: [],
    // Detail data (populated by API.initMaster in background)
    vendors: [],
    categories: [],
    vendorRules: [],
    _masterReady: false,
    // Screen memory (populated when user visits screens)
    _bills: null,
    _billDetail: null,
    _tx_log: null,
    _tx_sale: null,
    _tx_return: null,
    _sdPending: null,
  };

  // ── ROUTE MAP ──
  // Each route: { render: fn → toolbar+content HTML, onLoad?: fn after render }
  // Screen files register routes via App.registerRoutes()
  const ROUTES = {};

  // ── NAV STRUCTURE (from wireframe Part 1 + Part 2) ──
  const NAV = [
    { id: 'dashboard', icon: '◇', label: 'Dashboard', type: 'item' },
    '_spacer',
    { id: 'create', icon: '＋', label: 'Create', type: 'group', items: [
      { id: 'cr_sale', label: 'Sale' },
      { id: 'cr_bill', label: 'Bill / Invoice' },
      { id: 'cr_transfer', label: 'Transfer' },
      { id: 'cr_debit', label: 'Debit Note' },
      { id: 'cr_recurring', label: 'Recurring' },
      '_div',
      { id: 'cr_upload', label: 'Upload Create' },
      { id: 'cr_import', label: 'Import' },
    ]},
    { id: 'transactions', icon: '☰', label: 'Transactions', type: 'group', items: [
      { id: 'tx_log', label: 'Transaction Log' },
      { id: 'tx_sale', label: 'Sale' },
      { id: 'tx_bill', label: 'Bill / Invoice' },
      { id: 'tx_sd', label: 'SD Bridge' },
      '_div',
      { id: 'tx_return', label: 'Return and Debit' },
      { id: 'tx_find', label: 'Find Transactions' },
    ]},
    { id: 'reconciliation', icon: '⇄', label: 'Reconciliation', type: 'group', items: [
      { id: 'rc_bank', label: 'Bank Reconcile' },
      { id: 'rc_cash', label: 'Cash Collection' },
      { id: 'rc_stmt', label: 'Statement Upload' },
    ]},
    { id: 'review', icon: '⊘', label: 'Review Monitor', type: 'group', items: [
      { id: 'rv_pending', label: 'Pending Tracker' },
      { id: 'rv_recurring', label: 'Recurring Transactions' },
      { id: 'rv_expected', label: 'Expected Invoices' },
    ]},
    { id: 'payment', icon: '$', label: 'Payment', type: 'group', items: [
      { id: 'py_record', label: 'Record Payment' },
      { id: 'py_history', label: 'Payment History' },
      { id: 'py_remit', label: 'Remittance Advice' },
    ]},
    { id: 'payroll', icon: '₿', label: 'Payroll', type: 'group', items: [
      { id: 'pr_runs', label: 'Pay Runs' },
      { id: 'pr_emp', label: 'Employees' },
      '_div',
      { id: 'pr_wage', label: 'Wage Payments' },
      { id: 'pr_super', label: 'Super' },
      { id: 'pr_payg', label: 'Withholding Tax' },
    ]},
    { id: 'accounting', icon: '⊞', label: 'Accounting', type: 'group', items: [
      { id: 'ac_rules', label: 'Bank Rules' },
      { id: 'ac_hub', label: 'Banking Hub' },
      { id: 'ac_map', label: 'Bank Map' },
      { id: 'ac_loan', label: 'Loans and Finance' },
      { id: 'ac_journal', label: 'General Journal' },
      '_div',
      { id: 'ac_coa', label: 'Categories (COA)' },
      { id: 'ac_linked', label: 'Linked Categories' },
      { id: 'ac_tax', label: 'Tax Codes' },
    ]},
    { id: 'reports', icon: '▤', label: 'Reports', type: 'group', items: [
      { id: 'rp_dash', label: 'Financial Dashboard' },
      { id: 'rp_pnl', label: 'Profit & Loss Summary' },
      { id: 'rp_bs', label: 'Balance Sheet' },
      { id: 'rp_cf', label: 'Cash Flow Statement' },
      { id: 'rp_apar', label: 'AP/AR Tracker' },
      { id: 'rp_asset', label: 'Fixed Asset Management' },
      '_div',
      { id: 'rp_bank', label: 'Bank Account Summary' },
      { id: 'rp_cash', label: 'Cash Account Summary' },
      { id: 'rp_loan', label: 'Loan & Equity Report' },
    ]},
    { id: 'performance', icon: '◆', label: 'Performance', type: 'group', items: [
      { id: 'fp_brand', label: 'Brand Comparison' },
      { id: 'fp_budget', label: 'Budget vs Actual' },
      { id: 'fp_rev', label: 'Revenue Analysis' },
      { id: 'fp_exp', label: 'Expense Trend' },
    ]},
    { id: 'contacts', icon: '⊕', label: 'Contacts', type: 'item' },
    '_spacer',
    { id: 'settings', icon: '⚙', label: 'Settings', type: 'group', items: [
      { id: 'st_alert', label: 'Alert Rules' },
      { id: 'st_perm', label: 'Permissions' },
      { id: 'st_audit', label: 'Audit Log' },
    ]},
    '_spacer_double',
    { id: 'upload', icon: '↑', label: 'Upload', type: 'item' },
  ];

  // Map route → parent group for highlighting
  const ROUTE_GROUP = {};
  NAV.forEach(n => {
    if (typeof n === 'string') return;
    if (n.type === 'group' && n.items) {
      n.items.forEach(it => { if (it !== '_div') ROUTE_GROUP[it.id] = n.id; });
    }
  });

  // ═══════════════════════════
  // LAZY LOADER — load screen JS files on demand
  // ═══════════════════════════
  const _loadedScripts = {};

  function _loadScript(src) {
    if (_loadedScripts[src]) return _loadedScripts[src];
    _loadedScripts[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { _loadedScripts[src] = null; reject(new Error('Failed to load: ' + src)); };
      document.head.appendChild(s);
    });
    return _loadedScripts[src];
  }

  // Route → script file mapping
  const ROUTE_FILE = {
    // Create screens
    cr_sale: 'js/scr_input_fin.js', cr_bill: 'js/scr_input_fin.js',
    cr_transfer: 'js/scr_input_fin.js', cr_debit: 'js/scr_input_fin.js',
    cr_recurring: 'js/scr_input_fin.js', cr_upload: 'js/scr_input_fin.js',
    cr_import: 'js/scr_input_fin.js',
    // Transaction screens
    tx_log: 'js/scr_tx_fin.js', tx_sale: 'js/scr_tx_fin.js',
    tx_bill: 'js/scr_tx_fin.js', tx_return: 'js/scr_tx_fin.js',
    tx_bill_detail: 'js/scr_tx_fin.js', tx_sd: 'js/scr_tx_fin.js',
    tx_find: 'js/scr_tx_fin.js',
    // Settings screens
    st_alert: 'js/scr_settings_fin.js', st_perm: 'js/scr_settings_fin.js',
    st_audit: 'js/scr_settings_fin.js',
    // Accounting screens (E1)
    ac_coa: 'js/scr_accounting_fin.js', ac_coa_create: 'js/scr_accounting_fin.js',
    ac_coa_edit: 'js/scr_accounting_fin.js', ac_tax: 'js/scr_accounting_fin.js',
  };

  // ═══════════════════════════
  // INIT
  // ═══════════════════════════
  async function init() {
    // Phase 1: API init — session + small master data
    await API.init();

    // Build shell immediately (session ready)
    _buildTopbar();
    _buildSidebar();

    // Register built-in routes
    registerRoutes({
      dashboard: {
        render: () => ({
          tb: '<div class="tb"><div class="tb-t">Dashboard</div><select class="fl" style="width:110px"><option>Mar 2026</option><option>Feb 2026</option><option>Jan 2026</option></select><select class="fl" style="width:130px"><option>All Brands</option><option>Mango Coco</option><option>Flying Tigress</option><option>Issho Cafe</option></select></div>',
          ct: '<div class="empty" style="padding:60px"><div style="font-size:28px;margin-bottom:8px">◇</div><div style="font-size:15px;font-weight:600;margin-bottom:4px">Dashboard</div><div>Data will appear here once connected</div></div>',
        }),
      },
    });

    // Route from hash or default
    const hash = location.hash.replace('#', '') || 'dashboard';
    go(hash);

    // Listen hash changes
    window.addEventListener('hashchange', () => {
      const h = location.hash.replace('#', '') || 'dashboard';
      if (h !== S.route) go(h);
    });
  }

  // ═══════════════════════════
  // ROUTE REGISTRATION
  // ═══════════════════════════
  function registerRoutes(obj) {
    Object.assign(ROUTES, obj);
  }

  // ═══════════════════════════
  // NAVIGATION
  // ═══════════════════════════
  async function go(route) {
    // Lazy load script if needed
    const scriptFile = ROUTE_FILE[route];
    if (scriptFile && !_loadedScripts[scriptFile]) {
      // Show loading state while script loads
      const ct = document.getElementById('content');
      if (ct) ct.innerHTML = '<div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div>';
      try {
        await _loadScript(scriptFile);
      } catch (e) {
        if (ct) ct.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load. Please refresh.</div>';
        return;
      }
    }

    const r = ROUTES[route];
    if (!r) {
      // Show "coming soon" for unregistered routes
      const tb = document.getElementById('toolbar');
      const ct = document.getElementById('content');
      if (tb) tb.innerHTML = `<div class="tb"><div class="tb-t">${esc(route)}</div></div>`;
      if (ct) ct.innerHTML = '<div class="empty"><div style="font-size:24px;margin-bottom:8px">🚧</div>Coming soon</div>';
      S.route = route;
      location.hash = route;
      _highlightNav(route);
      return;
    }
    const result = r.render();
    const tb = document.getElementById('toolbar');
    const ct = document.getElementById('content');
    if (tb) tb.innerHTML = result.tb || '';
    if (ct) {
      ct.innerHTML = result.ct || '';
      ct.scrollTop = 0;
    }
    S.route = route;
    location.hash = route;
    _highlightNav(route);
    // Post-render callback
    if (r.onLoad) {
      requestAnimationFrame(() => r.onLoad());
    }
  }

  // ═══════════════════════════
  // TOPBAR
  // ═══════════════════════════
  function _buildTopbar() {
    const el = document.getElementById('topbar');
    if (!el) return;
    const s = S.session || {};
    el.innerHTML = `
      <div class="gt-logo" onclick="App.go('dashboard')">SPG Finance</div>
      <div class="gt-r">
        <div class="gt-i" title="Refresh" onclick="App._hardRefresh()" style="font-size:14px">↻</div>
        <div class="gt-i" title="Settings" onclick="App.go('st_alert')">⚙</div>
        <div class="gt-u">
          <div class="gt-av">${esc(s.avatar || 'U')}</div>
          ${esc(s.display_name || 'User')}
        </div>
      </div>`;
  }

  // ═══════════════════════════
  // SIDEBAR
  // ═══════════════════════════
  let _sidebarCollapsed = false;

  function _buildSidebar() {
    const el = document.getElementById('sidebar');
    if (!el) return;

    // Toggle button at top of sidebar
    let html = '<div class="sd-top"><div class="sd-toggle" onclick="App._toggleSidebar()"><span class="sd-toggle-icon">☰</span></div></div>';

    NAV.forEach(n => {
      if (n === '_spacer') {
        html += '<div style="height:20px"></div>';
        return;
      }
      if (n === '_spacer_double') {
        html += '<div style="height:20px"></div>';
        return;
      }
      if (n === '_spacer_30') {
        html += '<div style="height:30px"></div>';
        return;
      }
      if (n.type === 'item') {
        const extra = '';
        html += `<div class="si" data-route="${n.id}" onclick="App.go('${n.id}')"${extra}>`
              + `<span class="sg-ico">${n.icon}</span>`
              + `<span class="sit">${esc(n.label)}</span></div>`;
      } else if (n.type === 'group') {
        html += `<div class="sg" data-group="${n.id}">`
              + `<div class="sg-head" data-group="${n.id}"><span class="sg-ico">${n.icon}</span><span class="sit">${esc(n.label)}</span><span class="sg-arr">›</span></div>`
              + `<div class="sg-sub">`;
        n.items.forEach(it => {
          if (it === '_div') {
            html += '<div class="sg-div"></div>';
          } else {
            html += `<div class="sg-item" data-route="${it.id}" onclick="App.go('${it.id}')">${esc(it.label)}</div>`;
          }
        });
        html += '</div></div>';
      }
    });

    // Footer
    html += `<div class="sf">
      <div style="font-size:9px;color:var(--t4);padding:2px 0;margin-bottom:4px">v2.0.1 | 14 Mar 2026 AEDT</div>
      <a href="https://onspider-spg.github.io/spg/#dashboard"><span style="font-size:12px">←</span><span class="sit"> Back to Home</span></a>
      <a href="https://onspider-spg.github.io/spg/#logout" class="danger"><span style="font-size:12px">→</span><span class="sit"> Log out</span></a>
    </div>`;

    el.innerHTML = html;

    // ── Setup flyout hover events (fixed position submenu) ──
    _setupFlyoutHover();
  }

  /** Position submenu as fixed overlay when hovering group */
  function _setupFlyoutHover() {
    document.querySelectorAll('.sg').forEach(sg => {
      const head = sg.querySelector('.sg-head');
      const sub = sg.querySelector('.sg-sub');
      if (!head || !sub) return;

      let hoverTimeout = null;

      sg.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimeout);
        // Close other open submenus
        document.querySelectorAll('.sg-sub.show').forEach(s => {
          if (s !== sub) s.classList.remove('show');
        });
        // Calculate position from group head
        const rect = head.getBoundingClientRect();
        sub.style.top = rect.top + 'px';
        sub.style.left = rect.right + 'px';
        sub.classList.add('show');
      });

      sg.addEventListener('mouseleave', () => {
        hoverTimeout = setTimeout(() => {
          sub.classList.remove('show');
        }, 100);
      });

      // Keep submenu open when hovering on it
      sub.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimeout);
      });
      sub.addEventListener('mouseleave', () => {
        hoverTimeout = setTimeout(() => {
          sub.classList.remove('show');
        }, 100);
      });
    });
  }

  function _toggleSidebar() {
    const sd = document.getElementById('sidebar');
    if (!sd) return;
    _sidebarCollapsed = !_sidebarCollapsed;
    sd.classList.toggle('cl', _sidebarCollapsed);
    document.body.classList.toggle('sd-collapsed', _sidebarCollapsed);
    const icon = sd.querySelector('.sd-toggle-icon');
    if (icon) icon.textContent = _sidebarCollapsed ? '☰' : '☰';
  }

  function _highlightNav(route) {
    // Clear all active
    document.querySelectorAll('.si.a').forEach(x => x.classList.remove('a'));
    document.querySelectorAll('.sg-item.a').forEach(x => x.classList.remove('a'));
    document.querySelectorAll('.sg-head.a').forEach(x => x.classList.remove('a'));

    // Highlight standalone item
    const siEl = document.querySelector(`.si[data-route="${route}"]`);
    if (siEl) siEl.classList.add('a');

    // Highlight submenu item + parent group head
    const itemEl = document.querySelector(`.sg-item[data-route="${route}"]`);
    if (itemEl) itemEl.classList.add('a');

    const groupId = ROUTE_GROUP[route];
    if (groupId) {
      const head = document.querySelector(`.sg-head[data-group="${groupId}"]`);
      if (head) head.classList.add('a');
    }
  }

  // ═══════════════════════════
  // SHARED UTILITIES
  // ═══════════════════════════

  /** HTML escape */
  function esc(str) {
    if (str == null) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  /** Format number as $x,xxx.xx */
  function formatMoney(n, decimals = 2) {
    if (n == null || isNaN(n)) return '$0.00';
    const num = Number(n);
    const neg = num < 0;
    const abs = Math.abs(num).toFixed(decimals);
    const parts = abs.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-$' : '$') + parts.join('.');
  }

  /** Format ISO date (2026-03-12) to DD/MM */
  function formatDate(str) {
    if (!str) return '';
    const parts = str.split('-');
    if (parts.length < 3) return str;
    return parts[2] + '/' + parts[1];
  }

  /** Format ISO date to DD/MM/YYYY */
  function formatDateFull(str) {
    if (!str) return '';
    const parts = str.split('-');
    if (parts.length < 3) return str;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  /** Today as YYYY-MM-DD (Sydney time) */
  function today() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
  }

  /** Toast notification */
  function toast(msg, ms = 2500) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), ms);
  }

  /** Show/Hide loader */
  function showLoader() {
    const el = document.getElementById('loader');
    if (el) el.classList.remove('hidden');
  }
  function hideLoader() {
    const el = document.getElementById('loader');
    if (el) el.classList.add('hidden');
  }

  /** Show dialog (replaces native confirm/prompt) */
  function showDialog({ title, message, confirmText = 'OK', cancelText = 'Cancel', onConfirm, onCancel, hideCancel = false }) {
    // Remove existing
    const existing = document.querySelector('.fin-dialog-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'fin-dialog-overlay';
    overlay.innerHTML = `
      <div class="fin-dialog">
        <div class="fin-dialog-title">${esc(title || '')}</div>
        <div class="fin-dialog-msg">${message || ''}</div>
        <div class="fin-dialog-btns">
          ${hideCancel ? '' : `<button class="btn bo" id="dlg-cancel">${esc(cancelText)}</button>`}
          <button class="bs" id="dlg-confirm">${esc(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const btnConfirm = document.getElementById('dlg-confirm');
    const btnCancel = document.getElementById('dlg-cancel');

    if (btnConfirm) btnConfirm.addEventListener('click', () => {
      overlay.remove();
      if (onConfirm) onConfirm();
    });
    if (btnCancel) btnCancel.addEventListener('click', () => {
      overlay.remove();
      if (onCancel) onCancel();
    });
    // Click overlay to cancel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        if (onCancel) onCancel();
      }
    });
  }

  /** Status badge HTML */
  function statusBadge(status) {
    const map = {
      open: 'sts-o', closed: 'sts-c', overdue: 'sts-r',
      debit: 'sts-d', pending: 'sts-p',
    };
    const cls = map[(status || '').toLowerCase()] || 'sts-o';
    const label = (status || 'Open').charAt(0).toUpperCase() + (status || 'open').slice(1);
    return `<span class="sts ${cls}">${esc(label)}</span>`;
  }

  /** API call — delegates to API module */
  async function api(action, body = {}) {
    return API.call ? API.call(action, body) : { success: true, data: null };
  }

  /** Hard refresh — clear all memory → re-init like fresh app open */
  async function _hardRefresh() {
    // Clear all screen memory
    S.brands = [];
    S.channels = [];
    S.bankAccounts = [];
    S.taxCodes = [];
    S.accountTypes = [];
    S.vendors = [];
    S.categories = [];
    S.vendorRules = [];
    S._masterReady = false;
    S._bills = null;
    S._billDetail = null;
    S._tx_log = null;
    S._tx_sale = null;
    S._tx_return = null;
    S._sdPending = null;

    toast('Refreshing...');
    showLoader();

    try {
      // Re-init API (session + master data)
      await API.init();
      // Rebuild shell with fresh session
      _buildTopbar();
      // Re-navigate to current route (re-fetch data)
      const current = S.route || 'dashboard';
      S.route = ''; // force re-render
      await go(current);
    } catch (e) {
      toast('Refresh failed');
    } finally {
      hideLoader();
    }
  }

  // ═══════════════════════════
  // BOOT
  // ═══════════════════════════
  document.addEventListener('DOMContentLoaded', init);

  // ── PUBLIC API ──
  return {
    S,
    go,
    esc,
    formatMoney,
    formatDate,
    formatDateFull,
    today,
    toast,
    showLoader,
    hideLoader,
    showDialog,
    statusBadge,
    api,
    registerRoutes,
    _toggleSidebar,
    _hardRefresh,
    NAV,
  };

})();
