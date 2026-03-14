/** Version 1.0 | 15 MAR 2026 | Siam Palette Group */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_payroll_fin.js
 * Payroll: Pay Runs, Create Pay Run (3-step), Pay Run Detail
 * Lazy-loaded by app_fin.js on first visit to pr_* routes
 * ═══════════════════════════════════════════
 */

(() => {
  const esc = App.esc;
  const fm = App.formatMoney;
  const fd = App.formatDate;
  const fdf = App.formatDateFull;

  // ── Local state ──
  let _payRuns = [];
  let _payRunKpi = { draft: 0, approved: 0, paid: 0, latest_total: 0, brand_count: 0 };
  let _filters = { status: 'All', date_from: '', date_to: '' };

  // Create wizard state
  let _wizardPayRun = null; // pay run record after Step 1
  let _wizardLines = [];    // parsed lines for Step 2
  let _wizardSummary = {};  // summary for Step 3

  // Detail state
  let _detailPayRun = null;
  let _detailBrands = {};

  // ══════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════

  function _fmtPeriod(start, end) {
    if (!start || !end) return '—';
    const s = start.split('-');
    const e = end.split('-');
    const months = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return parseInt(s[2]) + '-' + parseInt(e[2]) + ' ' + (months[parseInt(s[1])] || '');
  }

  function _fmtPayDate(d) {
    if (!d) return '—';
    const p = d.split('-');
    const months = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return parseInt(p[2]) + ' ' + (months[parseInt(p[1])] || '');
  }

  function _statusBadge(status) {
    const map = {
      draft: 'sts-p', approved: 'sts-r', paid: 'sts-c',
      owing: 'sts-r',
    };
    const cls = map[(status || '').toLowerCase()] || 'sts-o';
    const label = (status || '').charAt(0).toUpperCase() + (status || '').slice(1);
    return `<span class="sts ${cls}">${esc(label)}</span>`;
  }

  // ══════════════════════════════════════════
  // S1. PAY RUNS LIST (pr_runs)
  // ══════════════════════════════════════════

  function renderPayRuns() {
    return {
      tb: '<div class="tb"><div class="tb-t">Pay Runs</div><button class="bs" onclick="ScrPayroll.goCreate()">+ Create Pay Run</button></div>',
      ct: `<div style="max-width:1100px;margin:0 auto">
        <div class="kpi">
          <div class="kpi-c" style="border-top:3px solid var(--o)"><div class="kpi-v" style="color:var(--o)" id="pr_kpi_draft">0</div><div class="kpi-l">Draft</div></div>
          <div class="kpi-c" style="border-top:3px solid var(--r)"><div class="kpi-v" style="color:var(--r)" id="pr_kpi_approved">0</div><div class="kpi-l">Approved (unpaid)</div></div>
          <div class="kpi-c" style="border-top:3px solid var(--g)"><div class="kpi-v" style="color:var(--g)" id="pr_kpi_paid">0</div><div class="kpi-l">Paid (this month)</div></div>
          <div class="kpi-c" style="border-top:3px solid var(--b)"><div class="kpi-v" id="pr_kpi_total">$0</div><div class="kpi-l">Latest Pay Run Total</div></div>
          <div class="kpi-c" style="border-top:3px solid var(--acc)"><div class="kpi-v" id="pr_kpi_brands">0</div><div class="kpi-l">Brands</div></div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:10px;align-items:flex-end">
          <div><div class="fl-l">Status</div><select class="fl" id="pr_fl_status" onchange="ScrPayroll._applyFilter()"><option>All</option><option>Draft</option><option>Approved</option><option>Paid</option></select></div>
          <div><div class="fl-l">Date from</div><input class="fl" type="date" id="pr_fl_from" style="width:120px" onchange="ScrPayroll._applyFilter()"></div>
          <div><div class="fl-l">Date to</div><input class="fl" type="date" id="pr_fl_to" style="width:120px" onchange="ScrPayroll._applyFilter()"></div>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <table class="tbl"><thead><tr>
            <th>Pay Run</th><th>Work Period</th><th>Pay Date</th>
            <th style="text-align:center">Brands</th><th style="text-align:center">Employees</th>
            <th style="text-align:right">Payroll $</th><th style="text-align:right">TAX</th>
            <th style="text-align:right">SUPER</th><th style="text-align:right;font-weight:700">Total $</th>
            <th>Alloc?</th><th>Status</th>
          </tr></thead><tbody id="pr_runs_body"><tr><td colspan="11" style="text-align:center;padding:20px;color:var(--t3)">Loading...</td></tr></tbody></table>
        </div>
      </div>`,
    };
  }

  async function _loadPayRuns() {
    try {
      const data = await API.getPayRuns(_filters);
      _payRuns = data.rows || [];
      _payRunKpi = data.kpi || _payRunKpi;
      _renderPayRunKpi();
      _renderPayRunRows();
    } catch (e) {
      const body = document.getElementById('pr_runs_body');
      if (body) body.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--r)">${esc(e.message)}</td></tr>`;
    }
  }

  function _renderPayRunKpi() {
    const k = _payRunKpi;
    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    el('pr_kpi_draft', k.draft);
    el('pr_kpi_approved', k.approved);
    el('pr_kpi_paid', k.paid);
    el('pr_kpi_total', fm(k.latest_total));
    el('pr_kpi_brands', k.brand_count);
  }

  function _renderPayRunRows() {
    const body = document.getElementById('pr_runs_body');
    if (!body) return;

    if (_payRuns.length === 0) {
      body.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--t3)">No pay runs found</td></tr>';
      return;
    }

    body.innerHTML = _payRuns.map(r => {
      const isDraft = r.status === 'draft';
      const isApproved = r.status === 'approved';
      const rowBg = isDraft ? 'background:var(--obg)' : (isApproved ? 'background:var(--rbg)' : '');
      const click = isDraft
        ? `onclick="ScrPayroll.goCreateEdit('${r.id}')"`
        : `onclick="ScrPayroll.goDetail('${r.id}')" style="cursor:pointer;${rowBg}"`;

      return `<tr ${isDraft ? `style="${rowBg}"` : click}>
        <td><a class="lk" ${isDraft ? `onclick="ScrPayroll.goCreateEdit('${r.id}')"` : ''}>${esc(r.pay_run_no)}</a></td>
        <td style="font-weight:600">${_fmtPeriod(r.period_start, r.period_end)}</td>
        <td${isDraft ? ' style="color:var(--t3)"' : ''}>${isDraft ? '~' + _fmtPayDate(r.pay_date) : _fmtPayDate(r.pay_date)}</td>
        <td style="text-align:center">${isDraft ? '—' : (r.brand_count || 0)}</td>
        <td style="text-align:center">${isDraft ? '—' : (r.employee_count || 0)}</td>
        <td style="text-align:right${isDraft ? ';color:var(--t4)' : ''}">${isDraft ? '—' : fm(r.total_payroll)}</td>
        <td style="text-align:right${isDraft ? ';color:var(--t4)' : (';color:var(--r)')}">${isDraft ? '—' : fm(r.total_tax)}</td>
        <td style="text-align:right${isDraft ? ';color:var(--t4)' : (';color:var(--o)')}">${isDraft ? '—' : fm(r.total_super)}</td>
        <td style="text-align:right;font-weight:700${isDraft ? ';color:var(--t4)' : ''}">${isDraft ? '—' : fm(r.grand_total)}</td>
        <td>${isDraft ? '—' : (r.is_allocated ? '<span class="sts sts-p">Yes</span>' : 'No')}</td>
        <td>${_statusBadge(r.status)}</td>
      </tr>`;
    }).join('');
  }

  function _applyFilter() {
    _filters.status = document.getElementById('pr_fl_status')?.value || 'All';
    _filters.date_from = document.getElementById('pr_fl_from')?.value || '';
    _filters.date_to = document.getElementById('pr_fl_to')?.value || '';
    _loadPayRuns();
  }

  // ══════════════════════════════════════════
  // S2. CREATE PAY RUN — STEP 1: SETUP (pr_create_s1)
  // ══════════════════════════════════════════

  function renderCreateS1() {
    const pr = _wizardPayRun;
    const pStart = pr?.period_start || '';
    const pEnd = pr?.period_end || '';
    const pDate = pr?.pay_date || '';
    const prNo = pr?.pay_run_no || '—';

    return {
      tb: '<div class="tb"><button class="bg" onclick="App.go(\'pr_runs\')">← Pay Runs</button><div class="tb-t">Create Pay Run — Step 1: Setup</div></div>',
      ct: `<div style="max-width:1100px;margin:0 auto">
        <div class="tabs"><div class="tab a">① Setup</div><div class="tab">② Import Excel</div><div class="tab">③ Review & Approve</div></div>
        <div class="card" style="max-width:600px;margin:0 auto">
          <div style="font-size:13px;font-weight:700;margin-bottom:10px">Pay Run Setup</div>
          <div class="fr">
            <div class="fg" style="flex:1"><label class="lb">Pay Cycle</label><select class="inp" id="pr_s1_cycle"><option>Weekly</option><option>Fortnightly</option><option>Monthly</option></select></div>
            <div class="fg" style="flex:1"><label class="lb">Work Period Start *</label><input class="inp" type="date" id="pr_s1_start" value="${esc(pStart)}"></div>
            <div class="fg" style="flex:1"><label class="lb">Work Period End *</label><input class="inp" type="date" id="pr_s1_end" value="${esc(pEnd)}"></div>
          </div>
          <div class="fr" style="margin-top:10px">
            <div class="fg" style="flex:1"><label class="lb">Pay Date *</label><input class="inp" type="date" id="pr_s1_paydate" value="${esc(pDate)}"></div>
            <div class="fg" style="flex:1"><label class="lb">Pay Run ID</label><input class="inp" id="pr_s1_no" value="${esc(prNo)}" readonly style="background:var(--bg3);color:var(--t3)"></div>
          </div>
          <div style="background:var(--bbg);border-radius:var(--rd);padding:8px;font-size:10px;color:var(--b);margin:10px 0">ℹ️ ระบบจะ import ข้อมูลจาก Excel ทุก brand ในขั้นตอนถัดไป</div>
          <div style="display:flex;justify-content:flex-end">
            <button class="bs" id="pr_s1_btn" onclick="ScrPayroll._saveStep1()">Next: Import Excel →</button>
          </div>
        </div>
      </div>`,
    };
  }

  async function _loadCreateS1() {
    // If no existing wizard, fetch next PR number
    if (!_wizardPayRun) {
      try {
        const data = await API.getNextPayRunNo();
        const el = document.getElementById('pr_s1_no');
        if (el) el.value = data.pay_run_no || 'PR-???';
      } catch (e) { /* ignore */ }
    }
  }

  async function _saveStep1() {
    const cycle = document.getElementById('pr_s1_cycle')?.value || 'Weekly';
    const start = document.getElementById('pr_s1_start')?.value || '';
    const end = document.getElementById('pr_s1_end')?.value || '';
    const payDate = document.getElementById('pr_s1_paydate')?.value || '';

    if (!start || !end || !payDate) {
      App.toast('Please fill all required fields');
      return;
    }

    const btn = document.getElementById('pr_s1_btn');
    if (btn) btn.disabled = true;

    try {
      if (_wizardPayRun?.id) {
        // Already created — go to step 2
        App.go('pr_create_s2');
        return;
      }

      App.showLoader();
      const data = await API.createPayRun({
        pay_cycle: cycle.toLowerCase(),
        period_start: start,
        period_end: end,
        pay_date: payDate,
      });
      _wizardPayRun = data;
      App.toast('Pay run created');
      App.go('pr_create_s2');
    } catch (e) {
      App.toast(e.message || 'Failed to create pay run');
    } finally {
      App.hideLoader();
      if (btn) btn.disabled = false;
    }
  }

  // ══════════════════════════════════════════
  // S3. CREATE PAY RUN — STEP 2: IMPORT EXCEL (pr_create_s2)
  // ══════════════════════════════════════════

  function renderCreateS2() {
    const pr = _wizardPayRun || {};
    const period = _fmtPeriod(pr.period_start, pr.period_end);

    return {
      tb: `<div class="tb"><button class="bg" onclick="App.go('pr_create_s1')">← Setup</button><div class="tb-t">Import Payroll Data — ${esc(pr.pay_run_no || '')}</div><span style="font-size:11px;color:var(--t3)">Week ${esc(period)}</span></div>`,
      ct: `<div style="max-width:1100px;margin:0 auto">
        <div class="tabs"><div class="tab" onclick="App.go('pr_create_s1')">① Setup</div><div class="tab a">② Import Excel</div><div class="tab">③ Review & Approve</div></div>

        <div class="card" style="border-top:3px solid var(--acc)">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            <span style="font-size:14px">📊</span>
            <div><div style="font-size:12px;font-weight:700">1. Payroll File</div><div style="font-size:10px;color:var(--t3)">Hours, rates, pay per employee per brand</div></div>
          </div>
          <div style="border:2px dashed var(--bd);border-radius:10px;padding:16px;text-align:center;cursor:pointer" onclick="document.getElementById('pr_s2_file1').click()">
            <input type="file" id="pr_s2_file1" accept=".xlsx,.xls,.csv" style="display:none" onchange="ScrPayroll._onFilePayroll(event)">
            <div style="font-size:18px;color:var(--t4)">📄</div>
            <div style="font-size:11px;color:var(--t3)">Drop Excel here, or <a style="color:var(--acc);font-weight:600">browse</a></div>
          </div>
          <div id="pr_s2_file1_status" style="margin-top:6px;font-size:11px"></div>
        </div>

        <div class="card" style="border-top:3px solid var(--acc)">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            <span style="font-size:14px">🔀</span>
            <div><div style="font-size:12px;font-weight:700">2. Allocation File</div><div style="font-size:10px;color:var(--t3)">ย้ายต้นทุนระหว่าง brand เพื่อ % Payroll/Sales</div></div>
          </div>
          <div style="border:2px dashed var(--bd);border-radius:10px;padding:16px;text-align:center;cursor:pointer" onclick="document.getElementById('pr_s2_file2').click()">
            <input type="file" id="pr_s2_file2" accept=".xlsx,.xls,.csv" style="display:none" onchange="ScrPayroll._onFileAllocation(event)">
            <div style="font-size:18px;color:var(--t4)">📄</div>
            <div style="font-size:11px;color:var(--t3)">Drop Excel here, or <a style="color:var(--acc);font-weight:600">browse</a></div>
          </div>
          <div id="pr_s2_file2_status" style="margin-top:6px;font-size:11px"></div>
        </div>

        <div id="pr_s2_preview" style="display:none">
          <div class="card" style="border:1.5px solid var(--acc)">
            <div style="font-size:12px;font-weight:700;margin-bottom:8px">Import Preview</div>
            <table class="tbl"><thead><tr>
              <th>Brand</th><th style="text-align:center">Employees</th>
              <th style="text-align:right">Payroll $</th><th style="text-align:right">Cash $</th>
              <th style="text-align:right">TAX</th><th style="text-align:right">SUPER</th>
              <th style="text-align:right;font-weight:700">Total</th>
              <th style="text-align:center">Allocation</th><th>Status</th>
            </tr></thead><tbody id="pr_s2_preview_body"></tbody>
            <tfoot id="pr_s2_preview_foot"></tfoot></table>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;margin-top:8px">
          <button class="btn bo" onclick="App.go('pr_create_s1')">← Setup</button>
          <button class="bs" id="pr_s2_btn" onclick="ScrPayroll._importAndNext()" disabled>Confirm Import & Review →</button>
        </div>
      </div>`,
    };
  }

  // File handler stubs — in production these parse Excel via SheetJS
  // For now, they demonstrate the flow
  function _onFilePayroll(evt) {
    const file = evt?.target?.files?.[0];
    if (!file) return;
    const statusEl = document.getElementById('pr_s2_file1_status');
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--g)">✔ <b>${esc(file.name)}</b></span>`;

    // TODO: Parse Excel with SheetJS → build _wizardLines
    // For now, show preview with mock structure
    _wizardLines = _buildMockLines();
    _renderImportPreview();

    const btn = document.getElementById('pr_s2_btn');
    if (btn) btn.disabled = false;
  }

  function _onFileAllocation(evt) {
    const file = evt?.target?.files?.[0];
    if (!file) return;
    const statusEl = document.getElementById('pr_s2_file2_status');
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--g)">✔ <b>${esc(file.name)}</b></span>`;
  }

  function _buildMockLines() {
    // This will be replaced with actual Excel parsing
    // Returns preview data grouped by brand
    return [];
  }

  function _renderImportPreview() {
    const previewEl = document.getElementById('pr_s2_preview');
    if (!previewEl) return;

    if (_wizardLines.length === 0) {
      // Show instruction message when no real data parsed yet
      previewEl.style.display = 'block';
      const body = document.getElementById('pr_s2_preview_body');
      if (body) body.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:16px;color:var(--t3)">Excel parsed — data will appear here. Click "Confirm Import" to proceed.</td></tr>';
      return;
    }

    previewEl.style.display = 'block';
    // Group by brand
    const byBrand = {};
    _wizardLines.forEach(l => {
      if (!byBrand[l.brand_id]) byBrand[l.brand_id] = { emps: 0, payroll: 0, cash: 0, tax: 0, super_: 0, total: 0, alloc: 0 };
      const b = byBrand[l.brand_id];
      b.emps++;
      b.payroll += l.transfer_pay;
      b.cash += l.cash_pay;
      b.tax += l.tax_withheld;
      b.super_ += l.super_amount;
      b.total += l.total_amount;
      if (l.allocated_from_brand) b.alloc += l.total_amount;
    });

    const body = document.getElementById('pr_s2_preview_body');
    const foot = document.getElementById('pr_s2_preview_foot');
    if (!body || !foot) return;

    let totalEmps = 0, totalPayroll = 0, totalCash = 0, totalTax = 0, totalSuper = 0, totalTotal = 0;

    body.innerHTML = Object.entries(byBrand).map(([brand, b]) => {
      totalEmps += b.emps; totalPayroll += b.payroll; totalCash += b.cash;
      totalTax += b.tax; totalSuper += b.super_; totalTotal += b.total;
      return `<tr>
        <td style="font-weight:600">${esc(brand)}</td>
        <td style="text-align:center">${b.emps}</td>
        <td style="text-align:right">${fm(b.payroll)}</td>
        <td style="text-align:right">${fm(b.cash)}</td>
        <td style="text-align:right">${fm(b.tax)}</td>
        <td style="text-align:right">${fm(b.super_)}</td>
        <td style="text-align:right;font-weight:700">${fm(b.total)}</td>
        <td style="text-align:center">${b.alloc > 0 ? '<span class="sts sts-p">+' + fm(b.alloc) + '</span>' : '—'}</td>
        <td><span class="sts sts-c">✔ Mapped</span></td>
      </tr>`;
    }).join('');

    foot.innerHTML = `<tr style="border-top:2px solid var(--bd);font-weight:700;background:var(--bg2)">
      <td>TOTAL</td><td style="text-align:center">${totalEmps}</td>
      <td style="text-align:right">${fm(totalPayroll)}</td><td style="text-align:right">${fm(totalCash)}</td>
      <td style="text-align:right">${fm(totalTax)}</td><td style="text-align:right">${fm(totalSuper)}</td>
      <td style="text-align:right;font-size:14px">${fm(totalTotal)}</td>
      <td style="text-align:center;color:var(--g)">Net $0 ✔</td><td></td>
    </tr>`;
  }

  async function _importAndNext() {
    if (!_wizardPayRun?.id) {
      App.toast('Please complete Step 1 first');
      return;
    }

    const btn = document.getElementById('pr_s2_btn');
    if (btn) btn.disabled = true;

    try {
      if (_wizardLines.length > 0) {
        App.showLoader();
        await API.importPayRun({
          pay_run_id: _wizardPayRun.id,
          lines: _wizardLines,
        });
        App.toast('Import successful');
      }
      App.go('pr_create_s3');
    } catch (e) {
      App.toast(e.message || 'Import failed');
    } finally {
      App.hideLoader();
      if (btn) btn.disabled = false;
    }
  }

  // ══════════════════════════════════════════
  // S4. CREATE PAY RUN — STEP 3: REVIEW & APPROVE (pr_create_s3)
  // ══════════════════════════════════════════

  function renderCreateS3() {
    const pr = _wizardPayRun || {};
    const period = _fmtPeriod(pr.period_start, pr.period_end);

    return {
      tb: `<div class="tb"><button class="bg" onclick="App.go('pr_create_s2')">← Import</button><div class="tb-t">Review & Approve — ${esc(pr.pay_run_no || '')}</div><span style="font-size:11px;color:var(--t3)">Week ${esc(period)}</span></div>`,
      ct: `<div style="max-width:1100px;margin:0 auto">
        <div class="tabs"><div class="tab" onclick="App.go('pr_create_s1')">① Setup</div><div class="tab" onclick="App.go('pr_create_s2')">② Import Excel</div><div class="tab a">③ Review & Approve</div></div>

        <div class="kpi">
          <div class="kpi-c" style="border-top:3px solid var(--b)"><div class="kpi-v" id="pr_s3_total">${fm(pr.grand_total)}</div><div class="kpi-l">Grand Total</div></div>
          <div class="kpi-c" style="border-top:3px solid var(--t1)"><div class="kpi-v" id="pr_s3_payroll">${fm(pr.total_payroll)}</div><div class="kpi-l">Payroll</div></div>
          <div class="kpi-c" style="border-top:3px solid var(--r)"><div class="kpi-v" style="color:var(--r)" id="pr_s3_tax">${fm(pr.total_tax)}</div><div class="kpi-l">TAX</div></div>
          <div class="kpi-c" style="border-top:3px solid var(--o)"><div class="kpi-v" style="color:var(--o)" id="pr_s3_super">${fm(pr.total_super)}</div><div class="kpi-l">SUPER</div></div>
          <div class="kpi-c" style="border-top:3px solid var(--acc)"><div class="kpi-v" id="pr_s3_emps">${pr.employee_count || 0}</div><div class="kpi-l">Employees</div></div>
        </div>

        <div id="pr_s3_summary">
          <div style="font-size:12px;font-weight:700;margin-bottom:6px">Brand Summary</div>
          <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px" id="pr_s3_brand_table">
            <div style="text-align:center;padding:20px;color:var(--t3)">Loading brand details...</div>
          </div>
        </div>

        <div style="background:var(--bbg);border-radius:var(--rd);padding:10px;font-size:11px;color:var(--b);margin-bottom:14px">
          <b>After approval:</b><br>
          → Wages → Wage Payments (Owing per brand, after allocation)<br>
          → Super → accrued per employee<br>
          → PAYG → withheld per employee<br>
          → Pay via MYOB → Mark as Paid here
        </div>

        <div style="display:flex;gap:6px;justify-content:center">
          <button class="btn bo" onclick="App.go('pr_create_s2')">← Edit Import</button>
          <button class="bs" style="font-size:14px;padding:12px 30px" id="pr_s3_approve_btn" onclick="ScrPayroll._approvePayRun()">✔ Approve Pay Run</button>
        </div>
      </div>`,
    };
  }

  async function _loadCreateS3() {
    if (!_wizardPayRun?.id) return;

    try {
      const data = await API.getPayRunDetail({ pay_run_id: _wizardPayRun.id });
      _wizardPayRun = data.pay_run || _wizardPayRun;
      const brands = data.brands || {};

      // Update KPIs
      const pr = _wizardPayRun;
      const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      el('pr_s3_total', fm(pr.grand_total));
      el('pr_s3_payroll', fm(pr.total_payroll));
      el('pr_s3_tax', fm(pr.total_tax));
      el('pr_s3_super', fm(pr.total_super));
      el('pr_s3_emps', pr.employee_count || 0);

      // Build brand summary table
      const tableEl = document.getElementById('pr_s3_brand_table');
      if (tableEl) {
        const brandKeys = Object.keys(brands);
        if (brandKeys.length === 0) {
          tableEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--t3)">No data — please import Excel in Step 2</div>';
          return;
        }

        let rows = '';
        brandKeys.forEach(brand => {
          const lines = brands[brand];
          const emps = lines.length;
          const payroll = lines.reduce((s, l) => s + Number(l.cash_pay || 0) + Number(l.transfer_pay || 0), 0);
          const tax = lines.reduce((s, l) => s + Number(l.tax_withheld || 0), 0);
          const sup = lines.reduce((s, l) => s + Number(l.super_amount || 0), 0);
          const total = lines.reduce((s, l) => s + Number(l.total_amount || 0), 0);
          rows += `<tr>
            <td style="font-weight:600">${esc(brand)}</td>
            <td style="text-align:center">${emps}</td>
            <td style="text-align:right">${fm(payroll)}</td>
            <td style="text-align:right;color:var(--r)">${fm(tax)}</td>
            <td style="text-align:right;color:var(--o)">${fm(sup)}</td>
            <td style="text-align:right;font-weight:700">${fm(total)}</td>
          </tr>`;
        });

        tableEl.innerHTML = `<table class="tbl"><thead><tr>
          <th>Brand</th><th style="text-align:center">Employees</th>
          <th style="text-align:right">Payroll $</th><th style="text-align:right;color:var(--r)">TAX</th>
          <th style="text-align:right;color:var(--o)">SUPER</th><th style="text-align:right;font-weight:700">Total</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
      }
    } catch (e) {
      App.toast(e.message || 'Failed to load review data');
    }
  }

  async function _approvePayRun() {
    if (!_wizardPayRun?.id) return;

    const btn = document.getElementById('pr_s3_approve_btn');
    if (btn) btn.disabled = true;

    App.showDialog({
      title: 'Approve Pay Run',
      message: `Approve <b>${esc(_wizardPayRun.pay_run_no)}</b>?<br>This will lock the pay run for payment.`,
      confirmText: 'Approve',
      onConfirm: async () => {
        try {
          App.showLoader();
          await API.approvePayRun({ pay_run_id: _wizardPayRun.id });
          App.toast('Pay run approved ✔');
          _wizardPayRun = null;
          _wizardLines = [];
          App.go('pr_runs');
        } catch (e) {
          App.toast(e.message || 'Approve failed');
          if (btn) btn.disabled = false;
        } finally {
          App.hideLoader();
        }
      },
      onCancel: () => { if (btn) btn.disabled = false; },
    });
  }

  // ══════════════════════════════════════════
  // S5. PAY RUN DETAIL (pr_detail)
  // ══════════════════════════════════════════

  function renderDetail() {
    return {
      tb: `<div class="tb"><button class="bg" onclick="App.go('pr_runs')">← Pay Runs</button><div class="tb-t" id="pr_det_title">Pay Run Detail</div><span class="sts sts-o" id="pr_det_sts" style="font-size:11px"></span><button class="btn bo" style="font-size:10px" id="pr_det_export" onclick="ScrPayroll._exportCsv()">Export CSV</button><button class="bs" id="pr_det_paid_btn" onclick="ScrPayroll._markPaid()" style="display:none">Mark as Paid</button></div>`,
      ct: '<div style="max-width:1100px;margin:0 auto" id="pr_det_content"><div style="text-align:center;padding:40px;color:var(--t3)">Loading...</div></div>',
    };
  }

  async function _loadDetail() {
    const prId = _detailPayRun?.id;
    if (!prId) {
      const ct = document.getElementById('pr_det_content');
      if (ct) ct.innerHTML = '<div style="text-align:center;padding:40px;color:var(--r)">No pay run selected</div>';
      return;
    }

    try {
      const data = await API.getPayRunDetail({ pay_run_id: prId });
      _detailPayRun = data.pay_run;
      _detailBrands = data.brands || {};

      const pr = _detailPayRun;
      const titleEl = document.getElementById('pr_det_title');
      if (titleEl) titleEl.textContent = `${pr.pay_run_no} — ${_fmtPeriod(pr.period_start, pr.period_end)} ${(pr.period_start || '').substring(0, 4)}`;

      const stsEl = document.getElementById('pr_det_sts');
      if (stsEl) {
        const isApproved = pr.status === 'approved';
        const isPaid = pr.status === 'paid';
        stsEl.className = 'sts ' + (isPaid ? 'sts-c' : (isApproved ? 'sts-r' : 'sts-p'));
        stsEl.textContent = (isPaid ? 'Paid' : (isApproved ? 'Approved · Unpaid' : 'Draft'));
      }

      // Show Mark as Paid button only for approved
      const paidBtn = document.getElementById('pr_det_paid_btn');
      if (paidBtn) paidBtn.style.display = pr.status === 'approved' ? '' : 'none';

      // Build brand tables
      const ct = document.getElementById('pr_det_content');
      if (!ct) return;

      const brandKeys = Object.keys(_detailBrands);
      if (brandKeys.length === 0) {
        ct.innerHTML = '<div style="text-align:center;padding:40px;color:var(--t3)">No payroll lines</div>';
        return;
      }

      ct.innerHTML = brandKeys.map(brand => {
        const lines = _detailBrands[brand];
        const emps = lines.length;
        const totals = lines.reduce((acc, l) => ({
          payroll_hrs: acc.payroll_hrs + Number(l.payroll_hrs || 0),
          cash_hrs: acc.cash_hrs + Number(l.cash_hrs || 0),
          cash_pay: acc.cash_pay + Number(l.cash_pay || 0),
          transfer_pay: acc.transfer_pay + Number(l.transfer_pay || 0),
          tax: acc.tax + Number(l.tax_withheld || 0),
          super_: acc.super_ + Number(l.super_amount || 0),
          total: acc.total + Number(l.total_amount || 0),
        }), { payroll_hrs: 0, cash_hrs: 0, cash_pay: 0, transfer_pay: 0, tax: 0, super_: 0, total: 0 });

        const rows = lines.map(l => {
          const name = (l.employee_name || '') + (l.employee_nickname ? ' (' + l.employee_nickname + ')' : '');
          const isCash = l.pay_type === 'cash';
          const rowBg = l.allocated_from_brand ? 'background:var(--acc2)' : (isCash ? 'background:var(--acc2)' : '');
          return `<tr style="${rowBg}">
            <td><a class="lk" onclick="ScrPayroll.goEmpDetail('${l.employee_id}')" style="font-weight:600">${esc(name)}</a></td>
            <td style="font-size:10px">${esc(l.employee_code)}</td>
            <td style="font-size:10px">${esc(l.pay_type || '')}</td>
            <td style="text-align:right">${isCash ? '—' : Number(l.payroll_hrs || 0).toFixed(1)}</td>
            <td style="text-align:right">${Number(l.cash_hrs || 0).toFixed(2)}</td>
            <td style="text-align:right">${fm(l.cash_pay, 0)}</td>
            <td style="text-align:right">${isCash ? '—' : fm(l.transfer_pay, 0)}</td>
            <td style="text-align:right;color:var(--r)">${isCash ? '—' : fm(l.tax_withheld, 0)}</td>
            <td style="text-align:right;color:var(--o)">${isCash ? '—' : fm(l.super_amount, 0)}</td>
            <td style="text-align:right;font-weight:700">${fm(l.total_amount, 0)}</td>
            <td>${l.allocated_from_brand ? '<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:var(--gbg);color:var(--g)">← ' + esc(l.allocated_from_brand) + '</span>' : '—'}</td>
            <td>${_statusBadge(l.payment_status)}</td>
          </tr>`;
        }).join('');

        return `<div style="font-size:11px;font-weight:700;margin-bottom:4px">${esc(brand)} <span style="font-weight:400;color:var(--t3)">(${emps} employees)</span></div>
        <div class="card" style="padding:0;overflow-x:auto;margin-bottom:14px"><table class="tbl"><thead><tr>
          <th style="min-width:130px">Employee</th><th>Code</th><th>Pay Type</th>
          <th style="text-align:right">Payroll Hrs</th><th style="text-align:right">Cash Hrs</th>
          <th style="text-align:right">Cash Pay</th><th style="text-align:right">Transfer</th>
          <th style="text-align:right;color:var(--r)">TAX</th><th style="text-align:right;color:var(--o)">SUPER</th>
          <th style="text-align:right;font-weight:700">Total</th><th>Alloc</th><th>Status</th>
        </tr></thead><tbody>${rows}</tbody>
        <tfoot><tr style="border-top:2px solid var(--bd);font-weight:700;background:var(--bg2)">
          <td colspan="3">${esc(brand)} Total (${emps})</td>
          <td style="text-align:right">${totals.payroll_hrs.toFixed(2)}</td>
          <td style="text-align:right">${totals.cash_hrs.toFixed(2)}</td>
          <td style="text-align:right">${fm(totals.cash_pay, 0)}</td>
          <td style="text-align:right">${fm(totals.transfer_pay, 0)}</td>
          <td style="text-align:right;color:var(--r)">${fm(totals.tax, 0)}</td>
          <td style="text-align:right;color:var(--o)">${fm(totals.super_, 0)}</td>
          <td style="text-align:right;font-size:14px">${fm(totals.total, 0)}</td>
          <td></td><td></td>
        </tr></tfoot></table></div>`;
      }).join('');

    } catch (e) {
      const ct = document.getElementById('pr_det_content');
      if (ct) ct.innerHTML = `<div style="text-align:center;padding:40px;color:var(--r)">${esc(e.message)}</div>`;
    }
  }

  async function _markPaid() {
    if (!_detailPayRun?.id) return;

    const btn = document.getElementById('pr_det_paid_btn');
    if (btn) btn.disabled = true;

    App.showDialog({
      title: 'Mark as Paid',
      message: `Mark <b>${esc(_detailPayRun.pay_run_no)}</b> as Paid?<br>This confirms wages have been paid via MYOB.`,
      confirmText: 'Mark as Paid',
      onConfirm: async () => {
        try {
          App.showLoader();
          await API.markPayRunPaid({ pay_run_id: _detailPayRun.id });
          App.toast('Pay run marked as Paid ✔');
          App.go('pr_runs');
        } catch (e) {
          App.toast(e.message || 'Failed');
          if (btn) btn.disabled = false;
        } finally {
          App.hideLoader();
        }
      },
      onCancel: () => { if (btn) btn.disabled = false; },
    });
  }

  function _exportCsv() {
    App.toast('Export CSV — coming soon');
  }

  // ══════════════════════════════════════════
  // NAVIGATION HELPERS
  // ══════════════════════════════════════════

  function goCreate() {
    _wizardPayRun = null;
    _wizardLines = [];
    App.go('pr_create_s1');
  }

  function goCreateEdit(payRunId) {
    // Resume editing an existing draft
    _wizardPayRun = _payRuns.find(r => r.id === payRunId) || null;
    _wizardLines = [];
    App.go('pr_create_s1');
  }

  function goDetail(payRunId) {
    _detailPayRun = _payRuns.find(r => r.id === payRunId) || { id: payRunId };
    App.go('pr_detail');
  }

  function goEmpDetail(empId) {
    // Will be implemented in E6a-2
    App.toast('Employee detail — coming in next batch');
  }

  // ══════════════════════════════════════════
  // REGISTER ROUTES
  // ══════════════════════════════════════════

  App.registerRoutes({
    pr_runs:       { render: renderPayRuns,    onLoad: _loadPayRuns },
    pr_create_s1:  { render: renderCreateS1,   onLoad: _loadCreateS1 },
    pr_create_s2:  { render: renderCreateS2 },
    pr_create_s3:  { render: renderCreateS3,   onLoad: _loadCreateS3 },
    pr_detail:     { render: renderDetail,     onLoad: _loadDetail },
  });

  // ══════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════

  window.ScrPayroll = {
    goCreate,
    goCreateEdit,
    goDetail,
    goEmpDetail,
    _applyFilter,
    _saveStep1,
    _onFilePayroll,
    _onFileAllocation,
    _importAndNext,
    _approvePayRun,
    _markPaid,
    _exportCsv,
  };

})();
