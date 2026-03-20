/** Version 1.7 | 16 MAR 2026 | Siam Palette Group | Created 13 MAR 2026 */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — api_fin.js
 * API Client + Memory Management (DB-first, no MOCK)
 * ═══════════════════════════════════════════
 *
 * CHANGED v1.6.4 → v1.7:
 * - [DELETED] All MOCK data: _MOCK_SESSION, _MOCK_MASTER, _MOCK_DETAIL,
 *   _MOCK_BILLS, _MOCK_TX_LOG, _MOCK_SALES, _MOCK_RETURNS
 * - [DELETED] _billSummaryFromMock(), _mockDelay()
 * - [FIXED] initBundle — API fail → throw error (no MOCK fallback)
 * - [FIXED] initMaster — API fail → throw error (no MOCK fallback)
 * - [FIXED] getBills — API fail → return empty + console.warn
 * - [FIXED] getBillDetail — API fail → return null + console.warn
 * - [FIXED] getTransactions — API fail → return empty + console.warn
 * - [FIXED] getUnpaidBills — API fail → return empty array
 * - [FIXED] getDebitCredits — API fail → return empty array
 * - [FIXED] getDashboard — API fail → return empty object
 * - [FIXED] createBill/Sale/Transfer/Debit — API fail → throw error (no MOCK)
 * - [FIXED] silentRefresh — calls API instead of returning null
 * ═══════════════════════════════════════════
 */

const API = (() => {

  // Lazy reference — App.S ยังไม่มีตอน script โหลด
  // ใช้ _S() เรียกตอน runtime แทน
  function _S() { return App.S; }

  // ── In-flight guards ──
  const _loading = {};

  // (All MOCK data removed — DB-first, API errors propagate to UI)

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

      const res = await _call('fin_init_bundle');

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
      const res = await _call('fin_init_master');

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
      const result = await _call('fin_get_bills', filters);

      const page = filters.page || 1;
      if (page === 1) {
        _S()._bills = result.rows;
      } else {
        _S()._bills = (_S()._bills || []).concat(result.rows);
      }
      _S()._billSummary = result.summary;

      return { rows: _S()._bills, hasMore: result.hasMore, summary: result.summary };
    } catch (e) {
      console.warn('getBills failed:', e.message);
      return { rows: _S()._bills || [], hasMore: false, summary: _S()._billSummary || {} };
    } finally {
      _loading.bills = false;
    }
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
      console.warn('getBillDetail failed:', e.message);
      return null;
    }
  }

  /** Get transactions — paginated → DB จริง */
  async function getTransactions(filters = {}) {
    const key = '_tx_' + (filters.type || 'log');
    if (_loading[key]) return { rows: _S()[key] || [], hasMore: false };
    _loading[key] = true;
    try {
      const result = await _call('fin_get_transactions', filters);

      const page = filters.page || 1;
      if (page === 1) {
        _S()[key] = result.rows;
      } else {
        _S()[key] = (_S()[key] || []).concat(result.rows);
      }

      return { rows: _S()[key], hasMore: result.hasMore };
    } catch (e) {
      console.warn('getTransactions failed:', e.message);
      return { rows: _S()[key] || [], hasMore: false };
    } finally {
      _loading[key] = false;
    }
  }

  /** Get unpaid bills → DB จริง */
  async function getUnpaidBills() {
    try {
      return await _call('fin_get_unpaid_bills', {});
    } catch (e) {
      console.warn('getUnpaidBills failed:', e.message);
      return [];
    }
  }

  /** Get SD pending records → DB จริง (sd_finance_bridge) */
  async function getSdPending(filters = {}) {
    if (_loading.sd) return { rows: _S()._sdPending || [], kpi: _sdKpi() };
    _loading.sd = true;
    try {
      const result = await _call('fin_get_sd_pending', filters);
      _S()._sdPending = result.rows;
      return { rows: _S()._sdPending, kpi: result.kpi || _sdKpi() };
    } catch (e) {
      console.warn('getSdPending failed:', e.message);
      return { rows: _S()._sdPending || [], kpi: _sdKpi() };
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

  /** Sync SD records → Finance → creates fin_transactions */
  async function syncSd(ids) {
    const result = await _call('fin_sync_sd', { ids });
    // Update memory: mark synced + remove from pending
    if (_S()._sdPending) {
      ids.forEach(id => {
        const r = _S()._sdPending.find(x => x.id === id);
        if (r) r.status = 'synced';
      });
    }
    return result;
  }

  /** Get debit credits → DB จริง */
  async function getDebitCredits(filters = {}) {
    try {
      return await _call('fin_get_debit_credits', filters);
    } catch (e) {
      console.warn('getDebitCredits failed:', e.message);
      return [];
    }
  }

  /** Get dashboard KPIs → DB จริง */
  async function getDashboard() {
    try {
      return await _call('fin_get_dashboard', {});
    } catch (e) {
      console.warn('getDashboard failed:', e.message);
      return {};
    }
  }

  // ═══════════════════════════════════════
  // CRUD — Save → wait DB → update memory
  // ═══════════════════════════════════════

  /** Create bill → call API → return full bill object (DB generates bill_no) */
  async function createBill(data) {
    const res = await _call('fin_create_bill', data);

    // Update memory — prepend to bills list
    if (res.bill && _S()._bills) {
      _S()._bills.unshift(res.bill);
    }

    // Store bill detail in memory for immediate display
    _S()._billDetail = res;

    return res;
  }

  /** Create sale transaction → DB จริง */
  async function createSale(data) {
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
  }

  /** Create transfer → DB จริง */
  async function createTransfer(data) {
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
  }

  /** Create debit note → DB จริง */
  async function createDebit(data) {
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
  }

  // ═══════════════════════════════════════
  // UPDATE / DELETE BILL
  // ═══════════════════════════════════════

  /** Update bill → DB */
  async function updateBill(data) {
    const res = await _call('fin_update_bill', data);
    // Clear caches
    _S()._billDetail = null;
    _S()._bills = null;
    return res;
  }

  /** Delete bill → DB */
  async function deleteBill(billId) {
    const res = await _call('fin_delete_bill', { bill_id: billId });
    _S()._billDetail = null;
    _S()._bills = null;
    return res;
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
    try {
      return await _call('fin_check_newer', { key, since: lastTs });
    } catch (e) {
      return null;
    }
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
    updateBill,
    deleteBill,
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
