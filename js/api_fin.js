/** Version 1.6.3 | 15 MAR 2026 | Siam Palette Group | Created 13 MAR 2026 */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — api_fin.js
 * API Client + Memory Management + MOCK Data
 * ═══════════════════════════════════════════
 *
 * LAYERS:
 *   1. Master Data  — initBundle → S.xxx (small, load once)
 *   2. Detail Data   — initMaster → _S().vendors, _S().categories (load in background)
 *   3. Screen Data  — _S()._bills, S._txLog etc (per-screen, memory-first)
 *   4. CRUD         — save → wait DB → update memory
 *   5. Silent Refresh — check if newer data exists → update memory if so
 *
 * MOCK MODE:
 *   All functions return MOCK data formatted exactly like real API responses.
 *   When connecting DB: change _call() from MOCK → fetch. Screens don't change.
 *
 * FUNCTION MAP:
 *   API.init()              — init session + start bundle load
 *   API.initBundle()        — Phase 1: session + small master data
 *   API.initMaster()        — Phase 2: vendors, categories, vendorRules (background)
 *   API.getSession()        — return current session
 *   API.call(action, body)  — API call wrapper (MOCK for now)
 *   API.getBills(filters)   — paginated bills + summary
 *   API.getBillDetail(id)   — single bill with line items, payments, attachments
 *   API.getTransactions(f)  — paginated transactions (log, sales, returns)
 *   API.getUnpaidBills()    — bills with balance > 0
 *   API.getSdPending(f)     — SD records ready to sync
 *   API.syncSd(ids)         — sync SD → Finance
 *   API.getDebitCredits(f)  — debit notes paired with invoices
 *   API.getDashboard()      — CFO Brief KPIs
 *   API.createBill(data)    — create bill → return full bill object
 *   API.createSale(data)    — create sale transaction
 *   API.createTransfer(d)   — create transfer
 *   API.createDebit(data)   — create debit note
 *   API.silentRefresh(key, lastTs) — check if newer data → return if changed
 * ═══════════════════════════════════════════
 */

const API = (() => {

  // Lazy reference — App.S ยังไม่มีตอน script โหลด
  // ใช้ _S() เรียกตอน runtime แทน
  function _S() { return App.S; }

  // ── In-flight guards ──
  const _loading = {};

  // ── MOCK SESSION ──
  const _MOCK_SESSION = {
    user_id: 'USR-001',
    display_name: 'Khun Or',
    avatar: 'AO',
    tier_level: 1,
  };

  // ═══════════════════════════════════════
  // MOCK DATA — formatted exactly like API responses
  // When connecting DB, remove this section and _call() returns fetch()
  // ═══════════════════════════════════════

  const _MOCK_MASTER = {
    brands: ['Mango Coco', 'Flying Tigress', 'Issho Cafe', 'Cheese Cottage', 'Redwork'],
    channels: ['Cash', 'Card (Eftpos1)', 'Card (Eftpos2)', 'UberEats', 'Easi', 'Union Pay', 'Card Prepaid'],
    bankAccounts: [
      { id: 'BA-001', label: '7134 Mango Coco Westpac', balance: 45200.00 },
      { id: 'BA-002', label: '680 Flying Tigress #4429', balance: 22360.99 },
      { id: 'BA-003', label: '682 Flying Tigress (Petty Cash) #1997', balance: -3849.70 },
    ],
    taxCodes: [
      { code: 'FRE', name: 'GST Free', rate: 0 },
      { code: 'GST', name: 'Goods & Services Tax', rate: 10 },
      { code: 'CAP', name: 'Capital Acquisitions', rate: 10 },
      { code: 'GNR', name: 'GST Non-Registered', rate: 0 },
      { code: 'N-T', name: 'Not Reportable', rate: 0 },
    ],
  };

  const _MOCK_DETAIL = {
    vendors: [
      { id: 'V-001', name: 'Pro Bros Providore', group: 'Food' },
      { id: 'V-002', name: 'Siam Pacific Food', group: 'Food' },
      { id: 'V-003', name: 'B&E Food Distributors', group: 'Food' },
      { id: 'V-004', name: 'Dencal Pty Ltd', group: 'Property' },
      { id: 'V-005', name: 'Akipan', group: 'Food' },
      { id: 'V-006', name: 'Attakor Trading', group: 'Equipment' },
      { id: 'V-007', name: 'AGL Energy', group: 'Utilities' },
    ],
    categories: [
      { id: 'C-001', code: '27002', name: 'Purchases-GST Free', type: 'expense' },
      { id: 'C-002', code: '27010', name: 'Packaging', type: 'expense' },
      { id: 'C-003', code: '42700', name: 'Rent', type: 'expense' },
      { id: 'C-004', code: '43000', name: 'Utilities', type: 'expense' },
      { id: 'C-005', code: '46000', name: 'Wages', type: 'expense' },
      { id: 'C-006', code: '46000', name: 'Equipment', type: 'asset' },
      { id: 'C-007', code: '41000', name: 'Revenue', type: 'income' },
    ],
    vendorRules: [
      { vendor_id: 'V-001', category_id: 'C-001', brand: 'Mango Coco', allocation: 'self', terms_days: 14, tax_code: 'FRE' },
      { vendor_id: 'V-002', category_id: 'C-001', brand: 'Flying Tigress', allocation: 'self', terms_days: 14, tax_code: 'FRE' },
      { vendor_id: 'V-004', category_id: 'C-003', brand: 'Mango Coco', allocation: 'self', terms_days: 30, tax_code: 'GST' },
      { vendor_id: 'V-007', category_id: 'C-004', brand: 'Mango Coco', allocation: 'split', terms_days: 21, tax_code: 'GST' },
    ],
  };

  const _MOCK_BILLS = [
    { id: 'B-001', date: '2026-03-10', bill_no: 'FIN-0050', supplier_id: 'V-006', supplier_name: 'Attakor Trading', inv_no: '', amount: 200, balance: 0, due_date: '2026-03-10', has_file: false, status: 'Closed', updated_at: '2026-03-10T10:00:00Z' },
    { id: 'B-002', date: '2026-03-09', bill_no: 'FIN-0049', supplier_id: 'V-002', supplier_name: 'Siam Pacific Food', inv_no: 'INV00003255', amount: 86.44, balance: 86.44, due_date: '2026-03-23', has_file: true, status: 'Open', updated_at: '2026-03-09T09:00:00Z' },
    { id: 'B-003', date: '2026-03-09', bill_no: 'FIN-0048', supplier_id: 'V-002', supplier_name: 'Siam Pacific Food', inv_no: 'INV00003237', amount: 654.16, balance: 654.16, due_date: '2026-03-23', has_file: true, status: 'Open', updated_at: '2026-03-09T08:00:00Z' },
    { id: 'B-004', date: '2026-03-09', bill_no: 'FIN-0047', supplier_id: 'V-002', supplier_name: 'Siam Pacific Food', inv_no: 'INV00003237-CR', amount: -50, balance: -50, due_date: '2026-03-23', has_file: true, status: 'Debit', updated_at: '2026-03-09T07:00:00Z' },
    { id: 'B-005', date: '2026-03-07', bill_no: 'FIN-0045', supplier_id: 'V-001', supplier_name: 'Pro Bros Providore', inv_no: 'INV1050836', amount: 128.10, balance: 128.10, due_date: '2026-03-04', has_file: true, status: 'Overdue', updated_at: '2026-03-07T06:00:00Z' },
  ];

  const _MOCK_TX_LOG = [
    { id: 'T-001', date: '2026-03-12', ref: '1277', type: 'Pay run', desc: 'Wage Mar W2', brand: 'Mango Coco', contact: 'Watcharapol D.', amount: 609, recon: 'Match', updated_at: '2026-03-12T12:00:00Z' },
    { id: 'T-002', date: '2026-03-11', ref: '1284', type: 'Bill payment', desc: 'Mind.RBuakl', brand: 'Mango Coco', contact: 'Mind.RBuakl xx_M...', amount: 582.82, recon: 'Group Match', updated_at: '2026-03-11T11:00:00Z' },
    { id: 'T-003', date: '2026-03-11', ref: '1282', type: 'Bill payment', desc: 'Rental Mar 2026', brand: 'Mango Coco', contact: 'Dencal Pty Ltd', amount: 23558.32, recon: 'Match', updated_at: '2026-03-11T10:00:00Z' },
    { id: 'T-004', date: '2026-03-11', ref: 'FIN-0050', type: 'Bill', desc: 'Purchase; Dencal', brand: 'Mango Coco', contact: 'Dencal Pty Ltd', amount: 23558.32, recon: '', updated_at: '2026-03-11T09:00:00Z' },
    { id: 'T-005', date: '2026-03-10', ref: 'FIN-0049', type: 'Bill', desc: 'Siam Pacific Food', brand: 'Flying Tigress', contact: 'Siam Pacific Food', amount: 86.44, recon: 'Unmatch', updated_at: '2026-03-10T08:00:00Z' },
  ];

  const _MOCK_SALES = [
    { id: 'S-001', date: '2026-03-12', brand: 'Mango Coco', channel: 'Cash', amount: 2340.50, gst: 234.05, status: 'Received', updated_at: '2026-03-12T12:00:00Z' },
    { id: 'S-002', date: '2026-03-12', brand: 'Mango Coco', channel: 'UberEats', amount: 890.20, gst: 89.02, status: 'Received', updated_at: '2026-03-12T11:00:00Z' },
    { id: 'S-003', date: '2026-03-11', brand: 'Flying Tigress', channel: 'Card', amount: 1560, gst: 156, status: 'Received', updated_at: '2026-03-11T10:00:00Z' },
    { id: 'S-004', date: '2026-03-11', brand: 'Mango Coco', channel: 'Easi', amount: 340, gst: 34, status: 'Received', updated_at: '2026-03-11T09:00:00Z' },
  ];

  const _MOCK_RETURNS = [
    { id: 'R-001', date: '2026-03-09', bill_no: 'FIN-0047', supplier_name: 'Siam Pacific Food', inv_no: 'INV00003237-CR', orig_inv: 'FIN-0048 · INV00003237', amount: -50, balance: -50, apply_status: 'Unused', updated_at: '2026-03-09T07:00:00Z' },
  ];

  const _MOCK_SD_PENDING = [
    { id: 'SD-001', date: '2026-03-12', store: 'Mango Coco Mac', channel: 'In-store', type: 'revenue', amount: 2340.50, status: 'pending' },
    { id: 'SD-002', date: '2026-03-12', store: 'Mango Coco Mac', channel: 'UberEats', type: 'revenue', amount: 890.20, status: 'pending' },
    { id: 'SD-003', date: '2026-03-11', store: 'Flying Tigress', channel: 'In-store', type: 'revenue', amount: 1560.00, status: 'synced' },
  ];

  // ═══════════════════════════════════════
  // INIT — 2 phases
  // ═══════════════════════════════════════

  /** Phase 1: Quick init — session + small data → UI can render */
  async function initBundle() {
    if (_loading.bundle) return;
    _loading.bundle = true;
    try {
      // Read token from URL param or localStorage
      const params = new URLSearchParams(window.location.search);
      let token = params.get('token');
      if (!token) token = localStorage.getItem('spg_token');
      if (token) {
        localStorage.setItem('spg_token', token);
        _S().token = token;
        // Clean URL if token was in param
        if (params.get('token')) {
          window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        }
      }

      let res;
      try {
        res = await _call('fin_init_bundle');
      } catch (e) {
        console.warn('initBundle API failed, using MOCK:', e.message);
        // Fallback to MOCK if no token or API fails
        res = {
          session: _MOCK_SESSION,
          brands: _MOCK_MASTER.brands,
          channels: _MOCK_MASTER.channels,
          bankAccounts: _MOCK_MASTER.bankAccounts,
          taxCodes: _MOCK_MASTER.taxCodes,
          accountTypes: [],
        };
      }

      _S().session = res.session;
      _S().brands = res.brands || [];
      _S().channels = res.channels || [];
      _S().bankAccounts = res.bankAccounts || [];
      _S().taxCodes = res.taxCodes || [];
      _S().accountTypes = res.accountTypes || [];

      return res;
    } finally {
      _loading.bundle = false;
    }
  }

  /** Phase 2: Background — vendors, categories, vendorRules */
  async function initMaster() {
    if (_loading.master) return;
    if (_S().vendors && _S().vendors.length > 0) return; // already loaded
    _loading.master = true;
    try {
      let res;
      try {
        res = await _call('fin_init_master');
      } catch (e) {
        console.warn('initMaster API failed, using MOCK:', e.message);
        res = {
          vendors: _MOCK_DETAIL.vendors,
          categories: _MOCK_DETAIL.categories,
          vendorRules: _MOCK_DETAIL.vendorRules,
        };
      }

      _S().vendors = res.vendors || [];
      _S().categories = res.categories || [];
      _S().vendorRules = res.vendorRules || [];
      _S()._masterReady = true;

      return res;
    } finally {
      _loading.master = false;
    }
  }

  /** Combined init — called from App.init() */
  async function init() {
    await initBundle();       // Phase 1: quick — blocks until done
    initMaster();             // Phase 2: background — no await
  }

  /** Get current session */
  function getSession() {
    return _S().session;
  }

  /** Check if master data is ready */
  function isMasterReady() {
    return _S()._masterReady === true;
  }

  /** Wait for master data (use in screens that need vendors/categories) */
  async function waitMaster() {
    if (_S()._masterReady) return;
    // Poll every 50ms until ready (max 5s)
    return new Promise((resolve) => {
      let tries = 0;
      const check = () => {
        if (_S()._masterReady || tries > 100) { resolve(); return; }
        tries++;
        setTimeout(check, 50);
      };
      check();
    });
  }

  // ═══════════════════════════════════════
  // API CALL WRAPPER
  // ═══════════════════════════════════════

  /** Base API call — fetch to Edge Function */
  const _API_URL = 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/finance';

  async function _call(action, body = {}) {
    const token = _S().token || localStorage.getItem('spg_token') || '';
    const res = await fetch(_API_URL + '?action=' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...body }),
    });
    const json = await res.json();
    if (!json.success) {
      const msg = json.error?.message || 'API error';
      throw new Error(msg);
    }
    return json.data;
  }

  // ═══════════════════════════════════════
  // SCREEN DATA — Memory-first + Silent Refresh
  // ═══════════════════════════════════════

  /** Get bills — paginated, filter, sort → DB จริง */
  async function getBills(filters = {}) {
    if (_loading.bills) return { rows: _S()._bills || [], hasMore: false, summary: _S()._billSummary || {} };
    _loading.bills = true;
    try {
      let result;
      try {
        result = await _call('fin_get_bills', filters);
      } catch (e) {
        console.warn('getBills API failed, using MOCK:', e.message);
        // Fallback to MOCK
        const page = filters.page || 1;
        const perPage = 30;
        const start = (page - 1) * perPage;
        const rows = _MOCK_BILLS.slice(start, start + perPage);
        result = {
          rows: rows,
          hasMore: start + perPage < _MOCK_BILLS.length,
          summary: _billSummaryFromMock(),
        };
      }

      const page = filters.page || 1;
      if (page === 1) {
        _S()._bills = result.rows;
      } else {
        _S()._bills = (_S()._bills || []).concat(result.rows);
      }
      _S()._billSummary = result.summary;

      return { rows: _S()._bills, hasMore: result.hasMore, summary: result.summary };
    } finally {
      _loading.bills = false;
    }
  }

  function _billSummaryFromMock() {
    const bills = _MOCK_BILLS;
    return {
      totalAmount: bills.reduce((s, r) => s + Math.abs(r.amount), 0),
      balanceDue: bills.reduce((s, r) => s + r.balance, 0),
      overdueAmount: bills.filter(r => r.status === 'Overdue').reduce((s, r) => s + r.balance, 0),
    };
  }

  /** Get bill detail → DB จริง */
  async function getBillDetail(billId) {
    // Check memory first
    if (_S()._billDetail && _S()._billDetail.bill && _S()._billDetail.bill.id === billId) {
      return _S()._billDetail;
    }
    try {
      const detail = await _call('fin_get_bill_detail', { bill_id: billId });
      _S()._billDetail = detail;
      return detail;
    } catch (e) {
      console.warn('getBillDetail API failed, using MOCK:', e.message);
      // Fallback to MOCK
      const bill = _MOCK_BILLS.find(b => b.id === billId || b.bill_no === billId);
      if (!bill) return null;
      const detail = {
        bill: bill,
        lineItems: [
          { desc: 'Food supplies', category: '27002 Purchases', amount: 750.00, gst: 0, tax_code: 'FRE', cost_owner: bill.supplier_name },
          { desc: 'Beverage', category: '27002 Purchases', amount: 140.55, gst: 0, tax_code: 'FRE', cost_owner: bill.supplier_name },
        ],
        payments: bill.status === 'Closed' ? [{ date: '2026-03-10', amount: bill.amount, method: 'Bank Transfer', ref: 'PAY-001' }] : [],
        attachments: bill.has_file ? [{ name: 'invoice.pdf', size: '0.45 MB', url: '#' }] : [],
        sourceDoc: { url: '#', linked: bill.has_file },
        allocation: 'self',
      };
      _S()._billDetail = detail;
      return detail;
    }
  }

  /** Get transactions — paginated → DB จริง */
  async function getTransactions(filters = {}) {
    const key = '_tx_' + (filters.type || 'log');
    if (_loading[key]) return { rows: _S()[key] || [], hasMore: false };
    _loading[key] = true;
    try {
      let result;
      try {
        result = await _call('fin_get_transactions', filters);
      } catch (e) {
        console.warn('getTransactions API failed, using MOCK:', e.message);
        let source;
        switch (filters.type) {
          case 'sale': source = _MOCK_SALES; break;
          case 'return': source = _MOCK_RETURNS; break;
          default: source = _MOCK_TX_LOG; break;
        }
        const page = filters.page || 1;
        const perPage = 30;
        const start = (page - 1) * perPage;
        result = { rows: source.slice(start, start + perPage), hasMore: start + perPage < source.length };
      }

      const page = filters.page || 1;
      if (page === 1) {
        _S()[key] = result.rows;
      } else {
        _S()[key] = (_S()[key] || []).concat(result.rows);
      }

      return { rows: _S()[key], hasMore: result.hasMore };
    } finally {
      _loading[key] = false;
    }
  }

  /** Get unpaid bills (for debit note creation) */
  /** Get unpaid bills → DB จริง */
  async function getUnpaidBills() {
    try {
      return await _call('fin_get_unpaid_bills', {});
    } catch (e) {
      console.warn('getUnpaidBills API failed, using MOCK:', e.message);
      return _MOCK_BILLS.filter(b => b.balance > 0 && b.status !== 'Debit');
    }
  }

  /** Get SD pending records → DB จริง */
  async function getSdPending(filters = {}) {
    if (_loading.sd) return { rows: _S()._sdPending || [], kpi: _sdKpi() };
    _loading.sd = true;
    try {
      let result;
      try {
        result = await _call('fin_get_sd_pending', filters);
      } catch (e) {
        console.warn('getSdPending API failed, using MOCK:', e.message);
        result = { rows: _MOCK_SD_PENDING, kpi: _sdKpi() };
      }

      _S()._sdPending = result.rows;
      return { rows: _S()._sdPending, kpi: result.kpi || _sdKpi() };
    } finally {
      _loading.sd = false;
    }
  }

  function _sdKpi() {
    const rows = _S()._sdPending || [];
    return {
      revenue: rows.filter(r => r.type === 'revenue').reduce((s, r) => s + r.amount, 0),
      expenses: rows.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
      pendingCount: rows.filter(r => r.status === 'pending').length,
    };
  }

  /** Sync SD records → Finance → DB จริง */
  async function syncSd(ids) {
    try {
      const result = await _call('fin_sync_sd', { ids });
      // Update memory: mark synced
      if (_S()._sdPending) {
        ids.forEach(id => {
          const r = _S()._sdPending.find(x => x.id === id);
          if (r) r.status = 'synced';
        });
      }
      return result;
    } catch (e) {
      console.warn('syncSd API failed, using MOCK:', e.message);
      if (_S()._sdPending) {
        ids.forEach(id => {
          const r = _S()._sdPending.find(x => x.id === id);
          if (r) r.status = 'synced';
        });
      }
      return { success: true, synced: ids.length };
    }
  }

  /** Get debit credits (Find Tx: DC tab) */
  /** Get debit credits → DB จริง */
  async function getDebitCredits(filters = {}) {
    try {
      return await _call('fin_get_debit_credits', filters);
    } catch (e) {
      console.warn('getDebitCredits API failed, using MOCK:', e.message);
      return [
        { date: '2026-03-09', debitRef: 'FIN-0047', creditRef: 'FIN-0048', supplier: 'Siam Pacific Food', debitAmt: -50, creditAmt: 654.16, status: 'Linked' },
      ];
    }
  }

  /** Get dashboard KPIs → DB จริง */
  async function getDashboard() {
    try {
      return await _call('fin_get_dashboard', {});
    } catch (e) {
      console.warn('getDashboard API failed, using MOCK:', e.message);
      return {
        totalBills: _MOCK_BILLS.length,
        overdueCount: _MOCK_BILLS.filter(b => b.status === 'Overdue').length,
        totalAmount: _MOCK_BILLS.reduce((s, b) => s + Math.abs(b.amount), 0),
        pendingSync: _MOCK_SD_PENDING.filter(r => r.status === 'pending').length,
      };
    }
  }

  // ═══════════════════════════════════════
  // CRUD — Save → wait DB → update memory
  // ═══════════════════════════════════════

  /** Create bill → call API → return full bill object (DB generates bill_no) */
  async function createBill(data) {
    try {
      const res = await _call('fin_create_bill', data);

      // Update memory — prepend to bills list
      if (res.bill && _S()._bills) {
        _S()._bills.unshift(res.bill);
      }

      // Store bill detail in memory for immediate display
      _S()._billDetail = res;

      return res;
    } catch (e) {
      // Fallback to MOCK if API fails
      console.warn('createBill API failed, using MOCK:', e.message);
      await _mockDelay(400);

      const newBill = {
        id: 'B-' + Date.now(),
        date: data.issue_date || App.today(),
        bill_no: 'MOCK-' + Date.now(),
        supplier_id: data.supplier_id,
        supplier_name: data.supplier_name || 'Unknown',
        inv_no: data.inv_no || '',
        amount: data.total || 0,
        balance: data.total || 0,
        due_date: data.due_date || '',
        has_file: false,
        status: 'Open',
        updated_at: new Date().toISOString(),
      };

      if (_S()._bills) _S()._bills.unshift(newBill);
      _MOCK_BILLS.unshift(newBill);

      const detail = {
        bill: newBill,
        lineItems: data.lineItems || [],
        payments: [],
        attachments: [],
        sourceDoc: { url: null, linked: false },
        allocation: data.allocation || 'self',
      };
      _S()._billDetail = detail;
      return detail;
    }
  }

  /** Create sale transaction → DB จริง */
  async function createSale(data) {
    try {
      const res = await _call('fin_create_sale', {
        brand_id: data.brand,
        channel: data.channel,
        amount: data.amount,
        gst: data.gst,
        sale_date: data.date || App.today(),
        bank_account_id: data.bank_account_id || null,
      });

      // Update memory — prepend to sales list
      if (_S()._tx_sale) _S()._tx_sale.unshift(res);

      return res;
    } catch (e) {
      console.warn('createSale API failed, using MOCK:', e.message);
      await _mockDelay(300);
      const newSale = {
        id: 'S-' + Date.now(),
        date: data.date || App.today(),
        brand: data.brand,
        channel: data.channel,
        amount: data.amount,
        gst: data.gst,
        status: 'Closed',
        updated_at: new Date().toISOString(),
      };
      if (_S()._tx_sale) _S()._tx_sale.unshift(newSale);
      _MOCK_SALES.unshift(newSale);
      return newSale;
    }
  }

  /** Create transfer → DB จริง */
  async function createTransfer(data) {
    try {
      const res = await _call('fin_create_transfer', {
        amount: data.amount,
        reference: data.reference || null,
        description: data.description || '',
        transfer_date: data.date || App.today(),
        transfer_type: data.transfer_type || 'Internal',
        from_account_id: data.from_account_id || null,
        to_account_id: data.to_account_id || null,
        from_label: data.from_label || '',
        to_label: data.to_label || '',
      });

      // Update memory — prepend to tx log
      if (_S()._tx_log) _S()._tx_log.unshift(res);

      return res;
    } catch (e) {
      console.warn('createTransfer API failed, using MOCK:', e.message);
      await _mockDelay(300);
      const newTx = {
        id: 'T-' + Date.now(),
        date: data.date || App.today(),
        ref: 'TR' + String(Date.now()).slice(-6),
        type: 'Transfer',
        desc: data.description || 'Transfer',
        brand: '',
        contact: '',
        amount: data.amount,
        recon: '',
        updated_at: new Date().toISOString(),
      };
      if (_S()._tx_log) _S()._tx_log.unshift(newTx);
      _MOCK_TX_LOG.unshift(newTx);
      return newTx;
    }
  }

  /** Create debit note → DB จริง */
  async function createDebit(data) {
    try {
      const res = await _call('fin_create_debit', {
        vendor_id: data.vendor_id || null,
        vendor_name: data.vendor_name || '',
        supplier_inv_no: data.inv_no || '',
        amount: Math.abs(data.amount),
        debit_date: data.date || App.today(),
        notes: data.notes || '',
        original_bill_no: data.original_bill_no || '',
      });

      // Update memory — prepend to bills list
      if (_S()._bills) _S()._bills.unshift(res);

      return res;
    } catch (e) {
      console.warn('createDebit API failed, using MOCK:', e.message);
      await _mockDelay(300);
      const newDebit = {
        id: 'B-' + Date.now(),
        date: data.date || App.today(),
        bill_no: 'MOCK-' + Date.now(),
        supplier_id: data.vendor_id,
        supplier_name: data.vendor_name || 'Unknown',
        inv_no: data.inv_no || '',
        amount: -(Math.abs(data.amount)),
        balance: -(Math.abs(data.amount)),
        due_date: '',
        has_file: false,
        status: 'Debit',
        updated_at: new Date().toISOString(),
      };
      if (_S()._bills) _S()._bills.unshift(newDebit);
      _MOCK_BILLS.unshift(newDebit);
      return newDebit;
    }
  }

  // ═══════════════════════════════════════
  // SILENT REFRESH
  // ═══════════════════════════════════════

  /**
   * Check if there's newer data than what's in memory.
   * If yes → return new rows. If no → return null.
   * @param {string} key - 'bills', 'tx_log', 'tx_sale', etc.
   * @param {string} lastTs - ISO timestamp of newest item in memory
   */
  async function silentRefresh(key, lastTs) {
    // MOCK — replace with: return await _call('fin_check_newer', { key, since: lastTs });
    // For MOCK: always return null (no changes)
    return null;
  }

  // ═══════════════════════════════════════
  // E1: COA (Chart of Accounts)
  // ═══════════════════════════════════════

  /** Get COA list — always fresh from DB (4 ACC concurrent, no stale cache) */
  async function getCoa(filters = {}) {
    try {
      return await _call('fin_get_coa', filters);
    } catch (e) {
      console.warn('getCoa API failed:', e.message);
      return { rows: [], total: 0 };
    }
  }

  /** Create category → DB */
  async function createCategory(data) {
    return await _call('fin_create_category', data);
  }

  /** Update category → DB */
  async function updateCategory(data) {
    return await _call('fin_update_category', data);
  }

  /** Delete / deactivate category → DB */
  async function deleteCategory(id, hardDelete = false) {
    return await _call('fin_delete_category', { id, hard_delete: hardDelete });
  }

  // ═══════════════════════════════════════
  // E1: TAX CODES
  // ═══════════════════════════════════════

  /** Get tax codes — fresh from DB */
  async function getTaxCodes() {
    try {
      return await _call('fin_get_tax_codes', {});
    } catch (e) {
      console.warn('getTaxCodes API failed, using S.taxCodes:', e.message);
      return _S().taxCodes || [];
    }
  }

  /** Update tax code → DB */
  async function updateTaxCode(data) {
    return await _call('fin_update_tax_code', data);
  }

  // ═══════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════

  /** Mock delay for simulating network latency */
  function _mockDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════
  return {
    init,
    initBundle,
    initMaster,
    getSession,
    isMasterReady,
    waitMaster,
    getBills,
    getBillDetail,
    getTransactions,
    getUnpaidBills,
    getSdPending,
    syncSd,
    getDebitCredits,
    getDashboard,
    createBill,
    createSale,
    createTransfer,
    createDebit,
    silentRefresh,
    // E1: COA + Tax
    getCoa,
    createCategory,
    updateCategory,
    deleteCategory,
    getTaxCodes,
    updateTaxCode,
    // E2: Contacts — thin wrappers using _call
    call: _call,
    // E5a: Review Monitor — thin wrappers using _call
    getReviewDashboard: (filters) => _call('fin_get_review_dashboard', filters || {}),
    getRecurringRules: (filters) => _call('fin_get_recurring_rules', filters || {}),
    createRecurringRule: (data) => _call('fin_create_recurring_rule', data),
    updateRecurringRule: (data) => _call('fin_update_recurring_rule', data),
    getExpectedInvoices: (filters) => _call('fin_get_expected_invoices', filters || {}),
    createExpectedInvoice: (data) => _call('fin_create_expected_invoice', data),
    // E5b: Payment — thin wrappers using _call
    getUnpaidForPayment: (filters) => _call('fin_get_unpaid_for_payment', filters || {}),
    getNextPaymentRef: (data) => _call('fin_get_next_payment_ref', data || {}),
    recordPayment: (data) => _call('fin_record_payment', data),
    getPaymentHistory: (filters) => _call('fin_get_payment_history', filters || {}),
    getRemittanceList: (filters) => _call('fin_get_remittance_list', filters || {}),
    sendRemittance: (data) => _call('fin_send_remittance', data),
    // E5c: Reconciliation — thin wrappers using _call
    uploadStatement: (data) => _call('fin_upload_statement', data),
    getBankRecon: (filters) => _call('fin_get_bank_recon', filters || {}),
    autoMatch: (data) => _call('fin_auto_match', data),
    confirmMatch: (data) => _call('fin_confirm_match', data),
    getCashRecon: (filters) => _call('fin_get_cash_recon', filters || {}),
    recordCashCollection: (data) => _call('fin_record_cash_collection', data),
    // E6a: Payroll — thin wrappers using _call
    getPayRuns: (filters) => _call('fin_get_pay_runs', filters || {}),
    createPayRun: (data) => _call('fin_create_pay_run', data),
    importPayRun: (data) => _call('fin_import_pay_run', data),
    getPayRunDetail: (data) => _call('fin_get_pay_run_detail', data),
    approvePayRun: (data) => _call('fin_approve_pay_run', data),
    markPayRunPaid: (data) => _call('fin_mark_pay_run_paid', data),
    getNextPayRunNo: () => _call('fin_get_next_pay_run_no', {}),
    getEmployees: (filters) => _call('fin_get_employees', filters || {}),
    getEmployeeDetail: (data) => _call('fin_get_employee_detail', data),
    // E6b: Reports — thin wrappers using _call
    getPnlSummary: (filters) => _call('fin_get_pnl_summary', filters || {}),
    getPnlBrandCompare: (filters) => _call('fin_get_pnl_brand_compare', filters || {}),
    getProfitFlow: (filters) => _call('fin_get_profit_flow', filters || {}),
    getPnlFull: (filters) => _call('fin_get_pnl_full', filters || {}),
    // E6b-2: Balance Sheet + Cash Flow
    getBalanceSheet: (filters) => _call('fin_get_balance_sheet', filters || {}),
    getCashFlow: (filters) => _call('fin_get_cash_flow', filters || {}),
    // E6b-3: Tracker + Summary Reports
    getApArTracker: (filters) => _call('fin_get_ap_ar_tracker', filters || {}),
    getAssetSummary: (filters) => _call('fin_get_asset_summary', filters || {}),
    getBankSummary: (filters) => _call('fin_get_bank_summary', filters || {}),
    getCashSummary: (filters) => _call('fin_get_cash_summary', filters || {}),
    getLoanReport: (filters) => _call('fin_get_loan_report', filters || {}),
    // E6c: Performance
    getBrandComparison: (filters) => _call('fin_get_brand_comparison', filters || {}),
    getBudgetVsActual: (filters) => _call('fin_get_budget_vs_actual', filters || {}),
    getRevenueAnalysis: (filters) => _call('fin_get_revenue_analysis', filters || {}),
    getExpenseTrend: (filters) => _call('fin_get_expense_trend', filters || {}),
    // E6d: Dashboard
    getCfoDashboard: (filters) => _call('fin_get_cfo_dashboard', filters || {}),
  };

})();
