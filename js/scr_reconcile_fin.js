/** Version 1.2.0 | 20 MAR 2026 | Siam Palette Group */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_reconcile_fin.js
 * Reconciliation: Statement Upload, Cash Collection, Bank Reconcile
 * Lazy-loaded by app_fin.js on first visit to rc_* routes
 * ═══════════════════════════════════════════
 *
 * CHANGED v1.1 → v1.1.1:
 * - [DELETED] _skeleton() — use App.skeleton()
 * - [FIXED] _today() UTC bug — use App.today() (Sydney timezone)
 * - [DELETED] _fmtDate() — use App.formatDate() with '—' fallback
 * - [DELETED] _brandFilterOpts() — use App.brandFilterOpts()
 * ═══════════════════════════════════════════
 */

(() => {
  const esc = App.esc;
  const fm = App.formatMoney;
  const fd = App.formatDate;

  // ══════════════════════════════════════════
  // SHARED — aliases from App
  // ══════════════════════════════════════════
  const _skeleton = App.skeleton;
  const _today = App.today;
  const _fmtDate = (d) => App.formatDate(d) || '—';
  const _brandFilterOpts = App.brandFilterOpts;
  // TODO: replace with App.bankOpts() when available
  function _bankOptions(selected) {
    return (App.S.bankAccounts || []).map(b =>
      `<option value="${esc(b.id)}"${b.id === selected ? ' selected' : ''}>${esc(b.account_name || b.name)} #${esc(b.account_number || '')}</option>`
    ).join('');
  }
  // ══════════════════════════════════════════
  // 1. STATEMENT UPLOAD (rc_stmt) — Upload CSV → parse → import
  // ══════════════════════════════════════════
  let _stmtFile = null;
  let _stmtParsed = [];
  let _stmtUploading = false;

  function renderStmtUpload() {
    return {
      tb: '<div class="tb"><div class="tb-t">Statement Upload</div></div>',
      ct: `<div class="card" style="max-width:720px;margin:0 auto">
        <div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:8px">Upload bank statement to reconcile. Stays on this page after upload.</div>
        <div style="background:var(--bbg);border-radius:var(--rd);padding:8px 12px;font-size:var(--fs-xxs);color:var(--b);margin-bottom:10px;line-height:1.6">
          <b>Supported formats:</b> CSV (Westpac, Generic), OFX<br>
          <b>Westpac CSV:</b> Bank Account, Date, Narrative, Debit, Credit, Balance, Categories, Serial<br>
          <b>Generic CSV:</b> Date, Description, Debit, Credit, Balance<br>
          <b>Date format:</b> DD/MM/YYYY or YYYY-MM-DD &nbsp;|&nbsp; <b>Auto-detect:</b> Westpac format detected by 12-digit account number<br>
          <select id="st_template_fmt" style="font-size:var(--fs-xxs);padding:1px 4px;border:1px solid var(--b);border-radius:4px">
            <option value="westpac">Westpac template</option><option value="generic">Generic template</option>
          </select>
          <a class="lk" style="font-size:var(--fs-xxs);margin-left:4px" href="#" onclick="ScrReconcile._downloadTemplate();return false">Download</a>
        </div>
        <div class="fg">
          <label class="lb">Bank Account *</label>
          <select class="inp" id="st_bank" style="max-width:350px">${_bankOptions('')}</select>
        </div>
        <div class="fg">
          <label class="lb">File Type</label>
          <select class="inp" id="st_filetype" style="max-width:200px">
            <option value="csv">Bank Statement (CSV)</option>
            <option value="ofx">Bank Statement (OFX)</option>
          </select>
        </div>
        <div id="st_dropzone" style="border:2px dashed var(--bd);border-radius:10px;padding:20px;text-align:center;margin:10px 0;cursor:pointer" onclick="document.getElementById('st_file_input').click()">
          <div style="font-size:20px;color:var(--t4)">📄</div>
          <div style="font-size:var(--fs-xs);color:var(--t3)">Drop CSV/OFX here, or <a style="color:var(--acc);font-weight:600">browse</a></div>
          <div id="st_filename" style="font-size:var(--fs-sm);font-weight:600;color:var(--acc);margin-top:4px;display:none"></div>
        </div>
        <input type="file" id="st_file_input" accept=".csv,.ofx" style="display:none" onchange="ScrReconcile._onFileSelect(event)">

        <!-- Preview table (hidden until file selected) -->
        <div id="st_preview" style="display:none;margin:10px 0">
          <div style="font-size:var(--fs-sm);font-weight:600;margin-bottom:6px">Preview (<span id="st_row_count">0</span> rows)</div>
          <div style="max-height:300px;overflow:auto;border:1px solid var(--bd);border-radius:var(--rd)">
            <table class="tbl"><thead><tr>
              <th>Date</th><th>Description</th><th style="text-align:right">Debit</th>
              <th style="text-align:right">Credit</th><th style="text-align:right">Balance</th>
            </tr></thead>
            <tbody id="st_preview_body"></tbody>
            </table>
          </div>
        </div>

        <!-- Success message (hidden until upload done) -->
        <div id="st_success" style="background:var(--gbg);border-radius:var(--rd);padding:10px;font-size:var(--fs-xs);color:var(--g);margin:10px 0;display:none">
          <span id="st_success_msg"></span> <a class="lk" onclick="App.go('rc_bank')">Go to Bank Reconcile →</a>
        </div>

        <button class="bs" id="st_upload_btn" style="margin-top:10px" onclick="ScrReconcile._uploadStatement()">Upload & Process</button>
      </div>`,
    };
  }

  function _onFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    _stmtFile = file;

    // Show filename
    const fnEl = document.getElementById('st_filename');
    if (fnEl) { fnEl.textContent = file.name; fnEl.style.display = ''; }

    // Parse CSV client-side for preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        _stmtParsed = _parseCsv(text);
        _renderPreview();
      }
    };
    reader.readAsText(file);
  }

  // Detected CSV format after parsing (used by preview)
  let _stmtFormat = 'generic'; // 'westpac' | 'generic'
  let _stmtAccounts = [];      // unique account numbers found in CSV

  function _parseCsv(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    // Try to detect header row
    const header = lines[0].toLowerCase();
    const hasHeader = header.includes('date') || header.includes('description') || header.includes('amount') || header.includes('narrative');
    const startIdx = hasHeader ? 1 : 0;

    // Detect Westpac format: first data row col[0] is a 12-digit bank account number
    const firstDataCols = _splitCsvLine(lines[startIdx]);
    const isWestpac = firstDataCols.length >= 6 && /^\d{12}$/.test(firstDataCols[0].trim());
    _stmtFormat = isWestpac ? 'westpac' : 'generic';

    const acctSet = new Set();
    const rows = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cols = _splitCsvLine(lines[i]);
      if (cols.length < 3) continue;

      let date = '', desc = '', debit = 0, credit = 0, balance = 0;
      let bank_account = '', bank_category = '';

      if (isWestpac) {
        // Westpac 8-col: Bank Account, Date, Narrative, Debit Amount, Credit Amount, Balance, Categories, Serial
        bank_account = cols[0].trim();
        date = cols[1].trim();
        desc = cols[2].trim();
        debit = Math.abs(parseFloat(cols[3].replace(/[,$"]/g, '')) || 0);
        credit = Math.abs(parseFloat(cols[4].replace(/[,$"]/g, '')) || 0);
        balance = parseFloat(cols[5].replace(/[,$"]/g, '')) || 0;
        bank_category = (cols[6] || '').trim();
        acctSet.add(bank_account);
      } else if (cols.length >= 5) {
        // Format A: Date, Description, Debit, Credit, Balance
        date = cols[0].trim();
        desc = cols[1].trim();
        debit = Math.abs(parseFloat(cols[2].replace(/[,$"]/g, '')) || 0);
        credit = Math.abs(parseFloat(cols[3].replace(/[,$"]/g, '')) || 0);
        balance = parseFloat(cols[4].replace(/[,$"]/g, '')) || 0;
      } else if (cols.length >= 4) {
        // Format B: Date, Desc, Amount, Balance
        date = cols[0].trim();
        desc = cols[1].trim();
        const amt = parseFloat(cols[2].replace(/[,$"]/g, '')) || 0;
        if (amt < 0) debit = Math.abs(amt);
        else credit = amt;
        balance = parseFloat(cols[3].replace(/[,$"]/g, '')) || 0;
      } else {
        // Format C: Date, Amount, Description
        date = cols[0].trim();
        const amt = parseFloat(cols[1].replace(/[,$"]/g, '')) || 0;
        desc = cols[2]?.trim() || '';
        if (amt < 0) debit = Math.abs(amt);
        else credit = amt;
      }

      // Normalize date (try DD/MM/YYYY or YYYY-MM-DD)
      date = _normalizeDate(date);
      if (!date) continue;

      const row = { date, description: desc, debit, credit, balance };
      if (isWestpac) {
        row.bank_account = bank_account;
        row.bank_category = bank_category;
      }
      rows.push(row);
    }

    _stmtAccounts = [...acctSet];
    return rows;
  }

  function _splitCsvLine(line) {
    const result = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { result.push(current); current = ''; continue; }
      current += ch;
    }
    result.push(current);
    return result;
  }

  function _normalizeDate(str) {
    if (!str) return '';
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    // DD/MM/YYYY
    const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
    // DD/MM/YY
    const m2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (m2) return `20${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
    return '';
  }

  function _renderPreview() {
    const tbody = document.getElementById('st_preview_body');
    const countEl = document.getElementById('st_row_count');
    const previewDiv = document.getElementById('st_preview');
    if (!tbody || !previewDiv) return;

    previewDiv.style.display = '';
    if (countEl) countEl.textContent = _stmtParsed.length;

    const isW = _stmtFormat === 'westpac';
    const colSpan = isW ? 7 : 5;

    // Update table header based on format
    const thead = previewDiv.querySelector('thead tr');
    if (thead) {
      thead.innerHTML = isW
        ? '<th>Account</th><th>Date</th><th>Narrative</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th><th>Category</th>'
        : '<th>Date</th><th>Description</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th>';
    }

    // Show account filter if multiple accounts detected
    let acctNotice = '';
    if (isW && _stmtAccounts.length > 1) {
      acctNotice = `<tr><td colspan="${colSpan}" style="background:var(--obg);color:var(--o);font-size:var(--fs-xxs);padding:6px 10px">
        Detected ${_stmtAccounts.length} accounts in file: ${_stmtAccounts.map(a => '<b>#' + esc(a) + '</b>').join(', ')}
        — filter: <select id="st_acct_filter" onchange="ScrReconcile._filterByAccount(this.value)" style="font-size:var(--fs-xxs);padding:1px 4px;border:1px solid var(--o);border-radius:4px">
          <option value="">All accounts (${_stmtParsed.length} rows)</option>
          ${_stmtAccounts.map(a => {
            const cnt = _stmtParsed.filter(r => r.bank_account === a).length;
            return '<option value="' + esc(a) + '">#' + esc(a) + ' (' + cnt + ' rows)</option>';
          }).join('')}
        </select>
      </td></tr>`;
    } else if (isW && _stmtAccounts.length === 1) {
      acctNotice = `<tr><td colspan="${colSpan}" style="background:var(--gbg);color:var(--g);font-size:var(--fs-xxs);padding:6px 10px">
        Westpac format detected — Account <b>#${esc(_stmtAccounts[0])}</b> — ${_stmtParsed.length} rows
      </td></tr>`;
    }

    // Show first 20 rows
    const rows = _stmtParsed.slice(0, 20);
    tbody.innerHTML = acctNotice + rows.map(r => isW
      ? `<tr>
          <td style="font-size:var(--fs-xxs);color:var(--t3);font-family:monospace">${esc(r.bank_account || '')}</td>
          <td style="white-space:nowrap">${_fmtDate(r.date)}</td>
          <td style="font-size:var(--fs-xxs);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.description)}">${esc(r.description)}</td>
          <td style="text-align:right${r.debit > 0 ? ';color:var(--r)' : ''}">${r.debit > 0 ? fm(r.debit) : ''}</td>
          <td style="text-align:right${r.credit > 0 ? ';color:var(--g)' : ''}">${r.credit > 0 ? fm(r.credit) : ''}</td>
          <td style="text-align:right;font-weight:600">${fm(r.balance)}</td>
          <td><span style="font-size:var(--fs-xxs);padding:1px 6px;border-radius:8px;background:var(--bg2);color:var(--t3)">${esc(r.bank_category || '')}</span></td>
        </tr>`
      : `<tr>
          <td style="white-space:nowrap">${_fmtDate(r.date)}</td>
          <td>${esc(r.description)}</td>
          <td style="text-align:right${r.debit > 0 ? ';color:var(--r)' : ''}">${r.debit > 0 ? fm(r.debit) : ''}</td>
          <td style="text-align:right${r.credit > 0 ? ';color:var(--g)' : ''}">${r.credit > 0 ? fm(r.credit) : ''}</td>
          <td style="text-align:right;font-weight:600">${fm(r.balance)}</td>
        </tr>`
    ).join('');

    if (_stmtParsed.length > 20) {
      tbody.innerHTML += `<tr><td colspan="${colSpan}" style="text-align:center;color:var(--t3);font-size:var(--fs-xs)">... and ${_stmtParsed.length - 20} more rows</td></tr>`;
    }
  }

  // Filter preview by account (Westpac multi-account)
  let _stmtAccountFilter = '';
  function _filterByAccount(acct) {
    _stmtAccountFilter = acct;
    // Re-render with filtered data
    const tbody = document.getElementById('st_preview_body');
    const countEl = document.getElementById('st_row_count');
    if (!tbody) return;

    const filtered = acct ? _stmtParsed.filter(r => r.bank_account === acct) : _stmtParsed;
    if (countEl) countEl.textContent = filtered.length;

    const rows = filtered.slice(0, 20);
    // Keep the account notice row
    const noticeRow = tbody.querySelector('tr:first-child td[colspan]');
    const noticeHtml = noticeRow ? noticeRow.parentElement.outerHTML : '';

    const isW = _stmtFormat === 'westpac';
    const colSpan = isW ? 7 : 5;
    tbody.innerHTML = noticeHtml + rows.map(r => isW ? `<tr>
      <td style="font-size:var(--fs-xxs);color:var(--t3);font-family:monospace">${esc(r.bank_account || '')}</td>
      <td style="white-space:nowrap">${_fmtDate(r.date)}</td>
      <td style="font-size:var(--fs-xxs);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.description)}">${esc(r.description)}</td>
      <td style="text-align:right${r.debit > 0 ? ';color:var(--r)' : ''}">${r.debit > 0 ? fm(r.debit) : ''}</td>
      <td style="text-align:right${r.credit > 0 ? ';color:var(--g)' : ''}">${r.credit > 0 ? fm(r.credit) : ''}</td>
      <td style="text-align:right;font-weight:600">${fm(r.balance)}</td>
      <td><span style="font-size:var(--fs-xxs);padding:1px 6px;border-radius:8px;background:var(--bg2);color:var(--t3)">${esc(r.bank_category || '')}</span></td>
    </tr>` : `<tr>
      <td style="white-space:nowrap">${_fmtDate(r.date)}</td>
      <td style="font-size:var(--fs-xxs);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.description)}">${esc(r.description)}</td>
      <td style="text-align:right${r.debit > 0 ? ';color:var(--r)' : ''}">${r.debit > 0 ? fm(r.debit) : ''}</td>
      <td style="text-align:right${r.credit > 0 ? ';color:var(--g)' : ''}">${r.credit > 0 ? fm(r.credit) : ''}</td>
      <td style="text-align:right;font-weight:600">${fm(r.balance)}</td>
    </tr>`).join('');

    if (filtered.length > 20) {
      tbody.innerHTML += `<tr><td colspan="${colSpan}" style="text-align:center;color:var(--t3);font-size:var(--fs-xs)">... and ${filtered.length - 20} more rows</td></tr>`;
    }

    // Restore filter selection
    const sel = document.getElementById('st_acct_filter');
    if (sel) sel.value = acct;
  }

  async function _uploadStatement() {
    if (_stmtUploading) return;
    if (_stmtParsed.length === 0) return App.toast('Please select a CSV file first');

    const bankId = document.getElementById('st_bank')?.value;
    if (!bankId) return App.toast('Please select a bank account');

    // Filter by selected account if Westpac multi-account
    let rowsToUpload = _stmtParsed;
    if (_stmtFormat === 'westpac' && _stmtAccountFilter) {
      rowsToUpload = _stmtParsed.filter(r => r.bank_account === _stmtAccountFilter);
    }
    if (rowsToUpload.length === 0) return App.toast('No rows to upload for selected account');

    _stmtUploading = true;
    const btn = document.getElementById('st_upload_btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

    try {
      App.showLoader();
      const result = await API.call('fin_upload_statement', {
        bank_account_id: bankId,
        source_file: _stmtFile?.name || 'upload.csv',
        rows: rowsToUpload,
        format: _stmtFormat,
      });

      // Show success
      const successEl = document.getElementById('st_success');
      const msgEl = document.getElementById('st_success_msg');
      if (successEl) successEl.style.display = '';
      if (msgEl) msgEl.textContent = `✓ Upload successful — ${result.imported || _stmtParsed.length} transactions imported.`;

      App.toast('Statement uploaded');
    } catch (e) {
      App.toast('Error: ' + e.message, 2000);
    } finally {
      _stmtUploading = false;
      App.hideLoader();
      if (btn) { btn.disabled = false; btn.textContent = 'Upload & Process'; }
    }
  }

  // ══════════════════════════════════════════
  // 2. CASH COLLECTION (rc_cash) — Cash reconcile per store
  // ══════════════════════════════════════════
  let _cashAccount = '';
  let _cashData = {};
  let _cashTab = 'stmt'; // stmt | collect | history

  function renderCashReconcile() {
    return {
      tb: `<div class="tb"><div class="tb-t">Cash Reconcile</div>
        <select class="fl" id="cr_account" onchange="ScrReconcile._switchCashAccount(this.value)" style="min-width:200px">${_bankOptions('')}</select>
        <select class="fl" id="cr_brand" style="width:140px">${_brandFilterOpts()}</select>
        <button class="btn bo" onclick="ScrReconcile._showJournalEntry()">+ Journal Entry</button>
        <button class="bs" onclick="ScrReconcile._switchCashTab('collect')">Record Collection</button>
      </div>`,
      ct: `<div style="max-width:1000px;margin:0 auto">
        <!-- Balance banner -->
        <div id="cr_banner" class="card" style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:var(--fs-xs);color:var(--t3)">Confirmed Cash Balance</div>
            <div style="font-size:var(--fs-kpi-xl);font-weight:800" id="cr_balance">—</div>
            <div style="font-size:var(--fs-xs);color:var(--t3)" id="cr_account_label">—</div>
          </div>
          <div style="text-align:right">
            <div style="display:flex;gap:16px;font-size:var(--fs-xs)">
              <div><span style="color:var(--g)">▲ In</span><div style="font-size:var(--fs-kpi-md);font-weight:700;color:var(--g)" id="cr_in">—</div></div>
              <div><span style="color:var(--r)">▼ Out</span><div style="font-size:var(--fs-kpi-md);font-weight:700;color:var(--r)" id="cr_out">—</div></div>
            </div>
            <div style="font-size:var(--fs-xxs);color:var(--o);margin-top:4px" id="cr_last_collect">—</div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs" id="cr_tabs">
          <div class="tab${_cashTab === 'stmt' ? ' a' : ''}" onclick="ScrReconcile._switchCashTab('stmt')">Statement</div>
          <div class="tab${_cashTab === 'collect' ? ' a' : ''}" onclick="ScrReconcile._switchCashTab('collect')">Collect</div>
          <div class="tab${_cashTab === 'history' ? ' a' : ''}" onclick="ScrReconcile._switchCashTab('history')">History</div>
        </div>

        <!-- Statement tab -->
        <div id="cr_stmt_tab">
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">
            <input class="fl" type="date" id="cr_from" style="width:120px">
            <span style="font-size:var(--fs-xs);color:var(--t3)">to</span>
            <input class="fl" type="date" id="cr_to" value="${_today()}" style="width:120px">
          </div>
          <div class="card" style="padding:0;overflow:hidden;margin:0">
            <table class="tbl" id="cr_stmt_tbl"><thead><tr>
              ${App.sth('Date','date','cr_stmt_tbl')}${App.sth('Type','type','cr_stmt_tbl')}${App.sth('Description','desc','cr_stmt_tbl')}${App.sth('Ref','ref','cr_stmt_tbl')}
              ${App.sthR('In ($)','in','cr_stmt_tbl')}${App.sthR('Out ($)','out','cr_stmt_tbl')}
              ${App.sthR('Balance ($)','balance','cr_stmt_tbl')}
            </tr></thead>
            <tbody id="cr_stmt_body">${_skeleton(7)}</tbody>
            </table>
          </div>
        </div>

        <!-- Collect tab -->
        <div id="cr_collect_tab" style="display:none">
          <div class="card" style="border:2px solid var(--acc);max-width:600px;margin:0 auto">
            <div style="font-size:var(--fs-body);font-weight:700;color:var(--acc);margin-bottom:10px">Record Collection</div>
            <div style="text-align:center;margin-bottom:12px">
              <div style="font-size:var(--fs-xs);color:var(--t3)">System expects</div>
              <div style="font-size:var(--fs-kpi-xl);font-weight:800" id="cr_expected">—</div>
              <div style="font-size:var(--fs-xs);color:var(--t3)">in the cash drawer right now</div>
            </div>
            <div class="fr">
              <div class="fg">
                <label class="lb">Collection Date</label>
                <input class="inp" type="date" id="cr_collect_date" value="${_today()}">
              </div>
              <div class="fg">
                <label class="lb">Cash Counted *</label>
                <input class="inp" id="cr_counted" type="number" step="0.01" min="0" style="font-weight:700;font-size:var(--fs-kpi-md);text-align:right" oninput="ScrReconcile._updateVariance()">
              </div>
            </div>
            <div class="fg">
              <label class="lb">Destination</label>
              <select class="inp" id="cr_destination">
                <option value="deposit">Deposit to Bank</option>
                <option value="keep">Keep as Cash on Hand</option>
              </select>
            </div>
            <div id="cr_variance_box" style="background:var(--bg3);border-radius:var(--rd);padding:10px;margin-top:8px;display:none">
              <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);padding:2px 0"><span>Expected</span><b id="cr_var_expected">—</b></div>
              <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);padding:2px 0"><span>Counted</span><b id="cr_var_counted">—</b></div>
              <div id="cr_var_diff_row" style="display:flex;justify-content:space-between;font-size:var(--fs-h1);font-weight:700;padding:4px 0;border-top:2px solid var(--bd);margin-top:4px">
                <span id="cr_var_label">Difference</span><span id="cr_var_diff">—</span>
              </div>
            </div>
            <div style="display:flex;gap:6px;margin-top:12px">
              <button class="bs" style="flex:1;padding:10px" id="cr_collect_btn" onclick="ScrReconcile._confirmCollection()">Confirm & Deposit</button>
              <button class="btn bo" onclick="ScrReconcile._switchCashTab('stmt')">Cancel</button>
            </div>
          </div>
        </div>

        <!-- History tab -->
        <div id="cr_history_tab" style="display:none">
          <div class="card" style="padding:0;overflow:hidden;margin:0">
            <table class="tbl" id="cr_hist_tbl"><thead><tr>
              ${App.sth('Date','date','cr_hist_tbl')}${App.sthR('Expected','expected','cr_hist_tbl')}
              ${App.sthR('Counted','counted','cr_hist_tbl')}${App.sthR('Variance','variance','cr_hist_tbl')}
              ${App.sth('Destination','dest','cr_hist_tbl')}${App.sth('Journal','journal','cr_hist_tbl')}${App.sth('Status','status','cr_hist_tbl')}
            </tr></thead>
            <tbody id="cr_history_body">${_skeleton(7)}</tbody>
            </table>
          </div>
        </div>
      </div>`,
    };
  }

  async function onLoadCash() {
    _cashTab = 'stmt';
    try {
      App.showLoader();
      const bankId = document.getElementById('cr_account')?.value || '';
      if (!bankId) { App.hideLoader(); return; }
      const data = await API.call('fin_get_cash_recon', { bank_account_id: bankId });
      _cashData = data;
      _renderCashBanner();
      _renderCashStatement();
      _renderCashHistory();
    } catch (e) {
      console.warn('Load cash recon failed:', e.message);
    } finally {
      App.hideLoader();
    }
  }

  function _renderCashBanner() {
    const d = _cashData;
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setText('cr_balance', fm(d.balance || 0));
    setText('cr_account_label', d.account_label || '—');
    setText('cr_in', fm(d.total_in || 0));
    setText('cr_out', fm(d.total_out || 0));
    setText('cr_last_collect', d.days_since_collect ? d.days_since_collect + ' days since last collection' : '—');
    setText('cr_expected', fm(d.balance || 0));
    const varExp = document.getElementById('cr_var_expected');
    if (varExp) varExp.textContent = fm(d.balance || 0);
  }

  function _renderCashStatement() {
    const tbody = document.getElementById('cr_stmt_body');
    if (!tbody) return;
    const rows = _cashData.statement || [];
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--t3)">No transactions found</td></tr>`;
      return;
    }
    let runBal = 0;
    tbody.innerHTML = rows.map(r => {
      const isIn = (r.credit || 0) > 0;
      const typeBadge = isIn
        ? '<span class="sts sts-c" style="font-size:var(--fs-xxs)">Sale</span>'
        : '<span class="sts sts-r" style="font-size:var(--fs-xxs)">Expense</span>';
      runBal = r.balance || runBal;
      return `<tr>
        <td>${_fmtDate(r.date || r.statement_date)}</td>
        <td>${typeBadge}</td>
        <td>${esc(r.description || '')}</td>
        <td style="font-size:var(--fs-xs);color:var(--acc)">${esc(r.reference || r.ref || '')}</td>
        <td style="text-align:right;color:var(--g);font-weight:600">${r.credit > 0 ? '+' + fm(r.credit) : ''}</td>
        <td style="text-align:right;color:var(--r)">${r.debit > 0 ? '-' + fm(r.debit) : ''}</td>
        <td style="text-align:right;font-weight:600">${fm(runBal)}</td>
      </tr>`;
    }).join('');
  }

  function _renderCashHistory() {
    const tbody = document.getElementById('cr_history_body');
    if (!tbody) return;
    const rows = _cashData.collections || [];
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--t3)">No collection history</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => {
      const variance = (r.counted || 0) - (r.expected || 0);
      const varColor = variance === 0 ? 'var(--g)' : 'var(--r)';
      return `<tr>
        <td>${_fmtDate(r.date)}</td>
        <td style="text-align:right">${fm(r.expected || 0)}</td>
        <td style="text-align:right">${fm(r.counted || 0)}</td>
        <td style="text-align:right;color:${varColor};font-weight:600">${variance === 0 ? '$0' : (variance > 0 ? '+' : '') + fm(variance)}</td>
        <td>${esc(r.destination || '—')}</td>
        <td>${r.journal_ref ? '<a class="lk">' + esc(r.journal_ref) + '</a>' : '<span style="color:var(--t4)">—</span>'}</td>
        <td><span class="sts sts-c">Confirmed</span></td>
      </tr>`;
    }).join('');
  }

  function _switchCashTab(tab) {
    _cashTab = tab;
    ['stmt', 'collect', 'history'].forEach(t => {
      const el = document.getElementById('cr_' + t + '_tab');
      if (el) el.style.display = t === tab ? '' : 'none';
    });
    // Update tab active state
    const tabs = document.getElementById('cr_tabs');
    if (tabs) {
      tabs.querySelectorAll('.tab').forEach((el, i) => {
        const tabIds = ['stmt', 'collect', 'history'];
        el.className = 'tab' + (tabIds[i] === tab ? ' a' : '');
      });
    }
  }

  function _switchCashAccount(val) {
    _cashAccount = val;
    onLoadCash();
  }

  function _updateVariance() {
    const counted = parseFloat(document.getElementById('cr_counted')?.value) || 0;
    const expected = _cashData.balance || 0;
    const diff = counted - expected;

    const box = document.getElementById('cr_variance_box');
    if (box) box.style.display = counted > 0 ? '' : 'none';

    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setText('cr_var_counted', fm(counted));
    setText('cr_var_expected', fm(expected));

    const diffEl = document.getElementById('cr_var_diff');
    const labelEl = document.getElementById('cr_var_label');
    const diffRow = document.getElementById('cr_var_diff_row');
    if (diffEl) diffEl.textContent = (diff >= 0 ? '+' : '') + fm(diff);
    if (labelEl) labelEl.textContent = diff === 0 ? 'Exact' : diff > 0 ? 'Over' : 'Short';
    if (diffRow) diffRow.style.color = diff === 0 ? 'var(--g)' : 'var(--r)';
  }

  async function _confirmCollection() {
    const counted = parseFloat(document.getElementById('cr_counted')?.value);
    if (isNaN(counted) || counted < 0) return App.toast('Please enter cash counted amount');

    const bankId = document.getElementById('cr_account')?.value;
    const collectDate = document.getElementById('cr_collect_date')?.value || _today();
    const destination = document.getElementById('cr_destination')?.value || 'deposit';

    const btn = document.getElementById('cr_collect_btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

    try {
      App.showLoader();
      await API.call('fin_record_cash_collection', {
        bank_account_id: bankId,
        collection_date: collectDate,
        counted_amount: counted,
        expected_amount: _cashData.balance || 0,
        destination,
      });
      App.toast('Collection recorded');
      _switchCashTab('history');
      await onLoadCash();
    } catch (e) {
      App.toast('Error: ' + e.message, 2000);
    } finally {
      App.hideLoader();
      if (btn) { btn.disabled = false; btn.textContent = 'Confirm & Deposit'; }
    }
  }

  function _showJournalEntry() {
    App.go('ac_journal');
  }

  // ══════════════════════════════════════════
  // 3. BANK RECONCILIATION (rc_bank) — Split-view matching
  // ══════════════════════════════════════════
  let _rcBankId = '';
  let _rcFilter = 'all'; // all | unmatched | matched
  let _rcStmtLines = [];
  let _rcMatches = [];
  let _rcSummary = {};

  function renderBankRecon() {
    return {
      tb: `<div class="tb"><div class="tb-t">Bank Reconciliation</div>
        <select class="fl" id="rc_bank" onchange="ScrReconcile._switchRcBank(this.value)" style="min-width:200px">${_bankOptions('')}</select>
        <select class="fl" id="rc_brand" style="width:140px">${_brandFilterOpts()}</select>
        <button class="btn bo" onclick="App.go('rc_stmt')">Upload Statement</button>
        <button class="bs" id="rc_automatch_btn" onclick="ScrReconcile._runAutoMatch()">Auto-Match</button>
      </div>`,
      ct: `<div style="max-width:1060px;margin:0 auto">
        <!-- Filter bar -->
        <div style="display:flex;gap:4px;margin-bottom:8px;align-items:center;flex-wrap:wrap">
          <input class="fl" type="date" id="rc_from" style="width:120px">
          <span style="font-size:var(--fs-xs);color:var(--t3)">to</span>
          <input class="fl" type="date" id="rc_to" value="${_today()}" style="width:120px">
          <div style="display:flex;gap:3px;margin-left:12px">
            <button class="btn bo rc-flt${_rcFilter === 'all' ? ' rc-flt-a' : ''}" onclick="ScrReconcile._setRcFilter('all')" id="rc_f_all">All</button>
            <button class="btn bo rc-flt${_rcFilter === 'unmatched' ? ' rc-flt-a' : ''}" onclick="ScrReconcile._setRcFilter('unmatched')" id="rc_f_unmatched">Unmatched</button>
            <button class="btn bo rc-flt${_rcFilter === 'matched' ? ' rc-flt-a' : ''}" onclick="ScrReconcile._setRcFilter('matched')" id="rc_f_matched">Matched</button>
          </div>
          <span style="margin-left:auto;font-size:var(--fs-xs);color:var(--t2)" id="rc_summary">—</span>
        </div>

        <!-- Column headers -->
        <div style="display:grid;grid-template-columns:1fr 36px 1fr;margin-bottom:4px;font-size:var(--fs-xs);font-weight:600;color:var(--t3)">
          <div style="padding:0 10px">BANK STATEMENT</div>
          <div></div>
          <div style="padding:0 10px">SYSTEM MATCH</div>
        </div>

        <!-- Rows container -->
        <div id="rc_rows">
          <div style="text-align:center;padding:40px;color:var(--t3)"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div>
        </div>
      </div>`,
    };
  }

  async function onLoadBankRecon() {
    _rcFilter = 'all';
    try {
      App.showLoader();
      const bankId = document.getElementById('rc_bank')?.value || '';
      const data = await API.call('fin_get_bank_recon', {
        bank_account_id: bankId,
        date_from: document.getElementById('rc_from')?.value || undefined,
        date_to: document.getElementById('rc_to')?.value || undefined,
      });
      _rcStmtLines = data.lines || [];
      _rcMatches = data.matches || [];
      _rcSummary = data.summary || {};
      _renderRcSummary();
      _renderRcRows();
    } catch (e) {
      console.warn('Load bank recon failed:', e.message);
      const el = document.getElementById('rc_rows');
      if (el) el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--t3)">No statement data. <a class="lk" onclick="App.go('rc_stmt')">Upload a statement first →</a></div>`;
    } finally {
      App.hideLoader();
    }
  }

  function _renderRcSummary() {
    const s = _rcSummary;
    const el = document.getElementById('rc_summary');
    if (el) {
      el.innerHTML = `Bank <b>${fm(s.bank_total || 0)}</b> · System <b>${fm(s.system_total || 0)}</b> · <b style="color:var(--r)">Diff ${fm(Math.abs((s.bank_total || 0) - (s.system_total || 0)))}</b>`;
    }
    // Update filter counts
    const all = _rcStmtLines.length;
    const matched = _rcStmtLines.filter(l => l.is_matched).length;
    const unmatched = all - matched;
    const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
    setText('rc_f_all', `All (${all})`);
    setText('rc_f_unmatched', `Unmatched (${unmatched})`);
    setText('rc_f_matched', `Matched (${matched})`);
  }

  function _renderRcRows() {
    const container = document.getElementById('rc_rows');
    if (!container) return;

    let lines = _rcStmtLines;
    if (_rcFilter === 'matched') lines = lines.filter(l => l.is_matched);
    else if (_rcFilter === 'unmatched') lines = lines.filter(l => !l.is_matched);

    if (lines.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--t3)">${_rcFilter === 'unmatched' ? 'All matched!' : 'No statement lines found.'} <a class="lk" onclick="App.go('rc_stmt')">Upload statement →</a></div>`;
      return;
    }

    container.innerHTML = lines.map(line => {
      const isMatched = line.is_matched;
      const match = _rcMatches.find(m => m.statement_line_id === line.id);
      const borderColor = isMatched ? 'var(--g)' : 'var(--o)';
      const bgColor = isMatched ? 'rgba(5,150,105,.03)' : 'rgba(217,119,6,.04)';
      const amount = (line.credit || 0) > 0 ? (line.credit) : -(line.debit || 0);
      const amtColor = amount >= 0 ? 'var(--g)' : 'var(--r)';

      // Left side — Bank statement
      const leftHtml = `<div style="border:1.5px solid ${borderColor};background:${bgColor};border-radius:var(--rd);padding:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:2px">
          <span style="font-size:var(--fs-xs);color:var(--t3)">${_fmtDate(line.statement_date)}</span>
          <span style="font-weight:700${amtColor ? ';color:' + amtColor : ''}">${amount >= 0 ? '+' : ''}${fm(Math.abs(amount))}</span>
        </div>
        <div style="font-weight:600;font-size:var(--fs-xs)">${esc(line.description || '')}</div>
      </div>`;

      // Middle — match indicator
      const midHtml = isMatched
        ? `<span style="background:var(--g);color:#fff;font-size:var(--fs-xxs);font-weight:700;padding:3px 8px;border-radius:4px">OK</span>`
        : `<span style="font-size:var(--fs-h1);color:var(--o)">→</span>`;

      // Right side — System match or actions
      let rightHtml;
      if (isMatched && match) {
        const statusBadge = match.match_status === 'confirmed'
          ? '<span style="font-size:var(--fs-xxs);color:var(--g);border:1px solid var(--g);padding:1px 6px;border-radius:3px">Confirmed</span>'
          : '<span style="font-size:var(--fs-xxs);color:var(--t3);border:1px solid var(--bd);padding:1px 6px;border-radius:3px">Pending confirm</span>';
        const typeBadge = match.match_type === 'auto'
          ? '<span style="font-size:var(--fs-xxs);color:#fff;background:var(--b);padding:1px 6px;border-radius:3px">Auto-matched</span>'
          : match.match_type === 'group'
            ? '<span style="font-size:var(--fs-xxs);color:#fff;background:var(--acc);padding:1px 6px;border-radius:3px">Group Match</span>'
            : '<span style="font-size:var(--fs-xxs);color:#fff;background:var(--t3);padding:1px 6px;border-radius:3px">Manual</span>';

        const confirmBtn = match.match_status !== 'confirmed'
          ? ` <button class="bs" style="padding:3px 10px;font-size:var(--fs-xxs)" onclick="ScrReconcile._confirmMatch('${esc(match.id)}')">Confirm</button>`
          : '';

        rightHtml = `<div style="border:1.5px solid ${borderColor};background:${bgColor};border-radius:var(--rd);padding:10px">
          <div style="display:flex;gap:4px;margin-bottom:2px">${typeBadge} ${statusBadge}</div>
          <div style="font-size:var(--fs-xs)">${esc(match.tx_ref || '')} · ${esc(match.tx_payee || '')}</div>
          <div style="font-size:var(--fs-xxs);color:var(--t3)">${esc(match.tx_category || '')}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
            <span style="font-weight:700">${fm(match.matched_amount || 0)}</span>${confirmBtn}
          </div>
        </div>`;
      } else {
        // Unmatched — show action buttons
        rightHtml = `<div style="border:1.5px solid var(--o);background:rgba(217,119,6,.04);border-radius:var(--rd);padding:10px">
          <div style="display:flex;gap:4px;margin-bottom:6px">
            <span style="font-size:var(--fs-xxs);color:var(--t3);border:1px solid var(--bd);padding:1px 8px;border-radius:4px;cursor:pointer" onclick="ScrReconcile._manualMatch('${line.id}')">Match</span>
            <span style="font-size:var(--fs-xxs);color:var(--o);font-weight:600;border:1px solid var(--o);padding:1px 8px;border-radius:4px;background:var(--obg);cursor:pointer" onclick="ScrReconcile._createAndMatch('${line.id}')">Create</span>
            <span style="font-size:var(--fs-xxs);color:var(--t3);border:1px solid var(--bd);padding:1px 8px;border-radius:4px;cursor:pointer">Transfer</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:var(--fs-xs);color:var(--t3)">${fm(Math.abs(amount))}</span>
            <button class="bs" style="padding:4px 12px;font-size:var(--fs-xs)" onclick="ScrReconcile._createAndMatch('${line.id}')">Create & Match</button>
          </div>
        </div>`;
      }

      return `<div style="display:grid;grid-template-columns:1fr 36px 1fr;margin-bottom:6px;align-items:stretch">
        ${leftHtml}
        <div style="display:flex;align-items:center;justify-content:center">${midHtml}</div>
        ${rightHtml}
      </div>`;
    }).join('');
  }

  function _setRcFilter(f) {
    _rcFilter = f;
    document.querySelectorAll('.rc-flt').forEach(el => el.classList.remove('rc-flt-a'));
    const active = document.getElementById('rc_f_' + f);
    if (active) active.classList.add('rc-flt-a');
    _renderRcRows();
  }

  function _switchRcBank(val) {
    _rcBankId = val;
    onLoadBankRecon();
  }

  async function _runAutoMatch() {
    const bankId = document.getElementById('rc_bank')?.value;
    if (!bankId) return App.toast('Select a bank account first');

    const btn = document.getElementById('rc_automatch_btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Matching...'; }

    try {
      App.showLoader();
      const result = await API.call('fin_auto_match', { bank_account_id: bankId });
      App.toast(`Auto-matched ${result.matched || 0} transactions`);
      await onLoadBankRecon();
    } catch (e) {
      App.toast('Error: ' + e.message, 2000);
    } finally {
      App.hideLoader();
      if (btn) { btn.disabled = false; btn.textContent = 'Auto-Match'; }
    }
  }

  async function _confirmMatch(matchId) {
    try {
      App.showLoader();
      await API.call('fin_confirm_match', { match_id: matchId });
      // Update memory
      const m = _rcMatches.find(x => x.id === matchId);
      if (m) m.match_status = 'confirmed';
      _renderRcRows();
      App.toast('Match confirmed');
    } catch (e) {
      App.toast('Error: ' + e.message, 2000);
    } finally {
      App.hideLoader();
    }
  }

  let _mmLineId = null;
  let _mmResults = [];

  function _manualMatch(lineId) {
    _mmLineId = lineId;
    _mmResults = [];
    const line = _rcStmtLines.find(l => l.id === lineId);
    if (!line) return;
    const amount = (line.debit || 0) > 0 ? line.debit : (line.credit || 0);

    // Build modal dialog
    const overlay = document.createElement('div');
    overlay.id = 'mm_overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = `<div style="background:#fff;border-radius:12px;width:600px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.2)">
      <div style="padding:14px 16px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:8px">
        <span style="font-weight:700;font-size:var(--fs-body)">Manual Match</span>
        <span style="flex:1"></span>
        <button onclick="document.getElementById('mm_overlay').remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--t3)">&times;</button>
      </div>
      <div style="padding:12px 16px;background:var(--bbg);border-bottom:1px solid #eee;font-size:var(--fs-xs)">
        <b>Statement:</b> ${_fmtDate(line.statement_date)} · ${esc((line.description || '').substring(0, 60))} · <b>${fm(amount)}</b>
      </div>
      <div style="padding:12px 16px">
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <input class="inp" id="mm_search" placeholder="Search bill #, vendor name..." style="flex:1;font-size:var(--fs-sm)" onkeydown="if(event.key==='Enter')ScrReconcile._mmSearch()">
          <button class="bs" style="padding:6px 14px;font-size:var(--fs-sm)" onclick="ScrReconcile._mmSearch()">Search</button>
        </div>
      </div>
      <div style="flex:1;overflow:auto;padding:0 16px 12px">
        <div id="mm_results" style="font-size:var(--fs-sm);color:var(--t3);text-align:center;padding:20px">
          Search or <a class="lk" onclick="ScrReconcile._mmSearch()">show all transactions</a>
        </div>
      </div>
    </div>`;
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    // Auto-search with amount
    setTimeout(() => {
      const inp = document.getElementById('mm_search');
      if (inp) inp.focus();
      _mmDoSearch('', amount);
    }, 100);
  }

  async function _mmSearch() {
    const query = document.getElementById('mm_search')?.value || '';
    const line = _rcStmtLines.find(l => l.id === _mmLineId);
    const amount = line ? ((line.debit || 0) > 0 ? line.debit : (line.credit || 0)) : 0;
    await _mmDoSearch(query, amount);
  }

  async function _mmDoSearch(query, amount) {
    const el = document.getElementById('mm_results');
    if (!el) return;
    el.innerHTML = '<div style="padding:12px;color:var(--t3)">Searching...</div>';

    try {
      const data = await API.call('fin_search_tx_for_match', { query, amount, limit: 30 });
      _mmResults = data.transactions || [];
      if (_mmResults.length === 0) {
        el.innerHTML = '<div style="padding:20px;color:var(--t3)">No transactions found</div>';
        return;
      }
      el.innerHTML = `<table class="tbl" style="font-size:var(--fs-xs)"><thead><tr>
        <th>Bill #</th><th>Vendor</th><th>Date</th><th style="text-align:right">Amount</th><th style="text-align:right">Balance</th><th>Status</th><th></th>
      </tr></thead><tbody>${_mmResults.map(t => {
        const amtDiff = Math.abs((t.total_amount || 0) - amount);
        const exactMatch = amtDiff < 0.01;
        return `<tr${exactMatch ? ' style="background:var(--gbg)"' : ''}>
          <td style="font-weight:600">${esc(t.bill_no || '')}</td>
          <td>${esc(t.vendor_name || '')}</td>
          <td>${_fmtDate(t.issue_date)}</td>
          <td style="text-align:right">${fm(t.total_amount || 0)}</td>
          <td style="text-align:right;font-weight:600">${fm(t.balance_due || 0)}</td>
          <td><span class="sts sts-${t.status === 'Open' ? 'o' : t.status === 'Closed' ? 'c' : 'r'}" style="font-size:var(--fs-xxs)">${esc(t.status || '')}</span></td>
          <td><button class="bs" style="padding:3px 10px;font-size:var(--fs-xxs)" onclick="ScrReconcile._mmSelect('${t.id}')">Match</button></td>
        </tr>`;
      }).join('')}</tbody></table>`;
    } catch (e) {
      el.innerHTML = `<div style="padding:20px;color:var(--r)">Error: ${esc(e.message)}</div>`;
    }
  }

  async function _mmSelect(txId) {
    if (!_mmLineId || !txId) return;
    try {
      App.showLoader();
      await API.call('fin_manual_match', { statement_line_id: _mmLineId, transaction_id: txId });
      // Close dialog
      document.getElementById('mm_overlay')?.remove();
      // Refresh recon data
      await onLoadBankRecon();
      App.toast('Matched successfully');
    } catch (e) {
      App.toast('Error: ' + e.message, 2000);
    } finally {
      App.hideLoader();
    }
  }

  function _createAndMatch(lineId) {
    const line = _rcStmtLines.find(l => l.id === lineId);
    if (line) {
      App.go('cr_bill', { prefill_stmt: lineId, prefill_vendor: line.description, prefill_amount: line.debit || line.credit || 0 });
    }
  }

  function _downloadTemplate() {
    const fmt = document.getElementById('st_template_fmt')?.value || 'generic';
    let csv, filename;
    if (fmt === 'westpac') {
      csv = 'Bank Account,Date,Narrative,Debit Amount,Credit Amount,Balance,Categories,Serial\n'
        + '032135835976,19/03/2026,"MERCHANT SETTLEMENT 0970001 ISSHO CAFE PTY LTD  0001  HAYMARKET",,8286.65,47109.45,DEP,\n'
        + '032135835976,18/03/2026,"WITHDRAWAL ONLINE MULTI 1548656 PYMT EP000236 P PAYMENT",10793.20,,36106.92,PAYMENT,\n'
        + '032135835941,18/03/2026,"DEBIT CARD PURCHASE COLES 0710 SYDNEY       AUS Card No. ~007002",90.00,,3984.20,PAYMENT,\n'
        + '032135835976,18/03/2026,"DEPOSIT UBER B.V.        STORE ID 241220ISS",,361.24,53424.91,DEP,';
      filename = 'westpac_statement_template.csv';
    } else {
      csv = 'Date,Description,Debit,Credit,Balance\n17/03/2026,Example transaction,100.00,,5000.00\n18/03/2026,Another transaction,,50.00,5050.00';
      filename = 'bank_statement_template.csv';
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ══════════════════════════════════════════
  // REGISTER ROUTES
  // ══════════════════════════════════════════
  App.registerRoutes({
    rc_stmt: { render: renderStmtUpload },
    rc_cash: { render: renderCashReconcile, onLoad: onLoadCash },
    rc_bank: { render: renderBankRecon,     onLoad: onLoadBankRecon },
  });

  // ══════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════
  window.ScrReconcile = {
    _onFileSelect,
    _uploadStatement,
    _switchCashTab,
    _switchCashAccount,
    _updateVariance,
    _confirmCollection,
    _showJournalEntry,
    _setRcFilter,
    _switchRcBank,
    _runAutoMatch,
    _confirmMatch,
    _manualMatch,
    _mmSearch,
    _mmSelect,
    _createAndMatch,
    _downloadTemplate,
    _filterByAccount,
  };

})();
