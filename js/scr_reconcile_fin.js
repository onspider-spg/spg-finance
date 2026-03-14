/** Version 1.0.1 | 15 MAR 2026 | Siam Palette Group */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_reconcile_fin.js
 * Reconciliation: Statement Upload, Cash Collection, Bank Reconcile
 * Lazy-loaded by app_fin.js on first visit to rc_* routes
 * ═══════════════════════════════════════════
 */

(() => {
  const esc = App.esc;
  const fm = App.formatMoney;
  const fd = App.formatDate;

  // ══════════════════════════════════════════
  // SHARED
  // ══════════════════════════════════════════
  function _skeleton(cols) {
    return `<tr><td colspan="${cols}" style="text-align:center;padding:20px;color:var(--t3)"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</td></tr>`;
  }
  function _today() { return new Date().toISOString().substring(0, 10); }
  function _bankOptions(selected) {
    return (App.S.bankAccounts || []).map(b =>
      `<option value="${esc(b.id)}"${b.id === selected ? ' selected' : ''}>${esc(b.account_name || b.name)} #${esc(b.account_number || '')}</option>`
    ).join('');
  }
  function _fmtDate(d) { if (!d) return '—'; const p = d.split('-'); return p[2] + '/' + p[1]; }

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

  function _parseCsv(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    // Try to detect header row
    const header = lines[0].toLowerCase();
    const hasHeader = header.includes('date') || header.includes('description') || header.includes('amount');
    const startIdx = hasHeader ? 1 : 0;

    const rows = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cols = _splitCsvLine(lines[i]);
      if (cols.length < 3) continue;

      // Try common CSV formats:
      // Format A: Date, Description, Debit, Credit, Balance
      // Format B: Date, Description, Amount, Balance
      // Format C: Date, Amount, Description, Balance
      let date = '', desc = '', debit = 0, credit = 0, balance = 0;

      if (cols.length >= 5) {
        // Format A: 5+ columns
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

      rows.push({ date, description: desc, debit, credit, balance });
    }

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

    // Show first 20 rows
    const rows = _stmtParsed.slice(0, 20);
    tbody.innerHTML = rows.map(r => `<tr>
      <td style="white-space:nowrap">${_fmtDate(r.date)}</td>
      <td>${esc(r.description)}</td>
      <td style="text-align:right${r.debit > 0 ? ';color:var(--r)' : ''}">${r.debit > 0 ? fm(r.debit) : ''}</td>
      <td style="text-align:right${r.credit > 0 ? ';color:var(--g)' : ''}">${r.credit > 0 ? fm(r.credit) : ''}</td>
      <td style="text-align:right;font-weight:600">${fm(r.balance)}</td>
    </tr>`).join('');

    if (_stmtParsed.length > 20) {
      tbody.innerHTML += `<tr><td colspan="5" style="text-align:center;color:var(--t3);font-size:var(--fs-xs)">... and ${_stmtParsed.length - 20} more rows</td></tr>`;
    }
  }

  async function _uploadStatement() {
    if (_stmtUploading) return;
    if (_stmtParsed.length === 0) return App.toast('Please select a CSV file first');

    const bankId = document.getElementById('st_bank')?.value;
    if (!bankId) return App.toast('Please select a bank account');

    _stmtUploading = true;
    const btn = document.getElementById('st_upload_btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

    try {
      App.showLoader();
      const result = await API.call('fin_upload_statement', {
        bank_account_id: bankId,
        source_file: _stmtFile?.name || 'upload.csv',
        rows: _stmtParsed,
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
        <select class="fl" id="cr_account" onchange="ScrReconcile._switchCashAccount(this.value)">${_bankOptions('')}</select>
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
        <select class="fl" id="rc_bank" onchange="ScrReconcile._switchRcBank(this.value)">${_bankOptions('')}</select>
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
      const amount = (line.debit || 0) > 0 ? -(line.debit) : (line.credit || 0);
      const amtColor = amount >= 0 ? 'var(--g)' : '';

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
          ? ` <button class="bs" style="padding:3px 10px;font-size:var(--fs-xxs)" onclick="ScrReconcile._confirmMatch('${match.id}')">Confirm</button>`
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

  function _manualMatch(lineId) {
    App.toast('Manual match — coming in next iteration');
  }

  function _createAndMatch(lineId) {
    const line = _rcStmtLines.find(l => l.id === lineId);
    if (line) {
      App.go('cr_bill', { prefill_stmt: lineId, prefill_vendor: line.description, prefill_amount: line.debit || line.credit || 0 });
    }
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
    _createAndMatch,
  };

})();
