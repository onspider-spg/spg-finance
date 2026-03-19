/** Version 1.4.1 | 15 MAR 2026 | Siam Palette Group */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_reports_fin.js
 * Reports (11) + Performance (4) + Dashboard (1) = 16 screens total
 * Lazy-loaded by app_fin.js on first visit to rp_ / fp_ / dashboard routes
 * ═══════════════════════════════════════════
 */

(() => {
  const esc = App.esc;
  const fm = App.formatMoney;

  // ── Local state ──
  let _pnlData = null;       // P&L summary data
  let _pnlBrandData = null;  // brand comparison data
  let _flowData = null;       // profit flow data
  let _fullData = null;       // full P&L statement data
  let _filters = { month: '', brand: 'All' };
  let _fullFilters = { period: 'Monthly', from: '', to: '', brand: 'All', compare: 'None' };
  let _bsData = null;        // balance sheet data
  let _cfData = null;         // cash flow data
  let _aparData = null;       // AP/AR tracker data
  let _aparTab = 'ap';        // active tab: ap / ar / aging
  let _assetData = null;      // fixed assets data
  let _bankData = null;       // bank summary data
  let _cashData = null;       // cash summary data
  let _loanData = null;       // loan & equity data
  let _loanTab = 'interco';   // active tab: interco / director / capital
  let _fpBrandData = null;    // performance: brand comparison
  let _fpBudgetData = null;   // performance: budget vs actual
  let _fpRevData = null;      // performance: revenue analysis
  let _fpExpData = null;      // performance: expense trend
  let _dashData = null;       // CFO dashboard data

  // ── Helpers ──

  /** Get current month as YYYY-MM */
  function _curMonth() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }).substring(0, 7);
  }

  /** Get month options (last 12 months) */
  function _monthOpts(selected) {
    const now = new Date();
    let html = '';
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = d.toLocaleDateString('en-CA').substring(0, 7);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      html += `<option value="${val}"${val === selected ? ' selected' : ''}>${esc(label)}</option>`;
    }
    return html;
  }

  /** Brand dropdown options */
  function _brandOpts(selected) {
    let html = `<option value="All"${selected === 'All' ? ' selected' : ''}>All Brands</option>`;
    (App.S.brands || []).forEach(b => {
      html += `<option value="${esc(b)}"${b === selected ? ' selected' : ''}>${esc(b)}</option>`;
    });
    return html;
  }

  /** Format number as compact K (e.g. 211000 → $211K) */
  function _fmK(n) {
    if (n == null || isNaN(n)) return '$0';
    const abs = Math.abs(Number(n));
    const neg = Number(n) < 0;
    if (abs >= 1000) return (neg ? '-$' : '$') + (abs / 1000).toFixed(0) + 'K';
    return fm(n, 0);
  }

  /** Format number for tables (no $ sign, with commas, parens for negative) */
  function _fmTbl(n) {
    if (n == null || isNaN(n)) return '0';
    const num = Number(n);
    const abs = Math.abs(num).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return num < 0 ? `(${abs})` : abs;
  }

  /** Percentage badge */
  function _pctBadge(pct) {
    if (pct == null || isNaN(pct)) return '—';
    const val = Number(pct);
    if (val === 0) return '—';
    const cls = val > 0 ? 'rp-chg-up' : 'rp-chg-dn';
    const arrow = val > 0 ? '▲' : '▼';
    return `<span class="rp-chg ${cls}">${arrow}${Math.abs(val).toFixed(1)}%</span>`;
  }

  /** Percentage of revenue */
  function _pctRev(amount, revenue) {
    if (!revenue) return '0%';
    return ((Math.abs(amount) / Math.abs(revenue)) * 100).toFixed(1) + '%';
  }

  // ══════════════════════════════════════════
  // SHARED: P&L sub-nav pill tabs
  // ══════════════════════════════════════════
  function _pnlTabs(active) {
    const tabs = [
      { id: 'rp_pnl', label: 'P&L Dashboard' },
      { id: 'rp_pnl_brand', label: 'Brand Comparison' },
      { id: 'rp_pnl_flow', label: 'Profit Flow' },
      { id: 'rp_pnl_full', label: 'Full P&L Statement' },
    ];
    return '<div class="rp-pills">' +
      tabs.map(t =>
        `<button class="rp-pill${t.id === active ? ' a' : ''}" onclick="App.go('${t.id}')">${esc(t.label)}</button>`
      ).join('') + '</div>';
  }

  // ══════════════════════════════════════════
  // rp_pnl: P&L DASHBOARD
  // ══════════════════════════════════════════
  function renderPnlDashboard() {
    if (!_filters.month) _filters.month = _curMonth();
    return {
      tb: '<div class="tb"><div class="tb-t">Profit & Loss Summary</div>' +
          '<button class="btn bo" onclick="ScrReports._exportPdf()">Export PDF</button>' +
          '<button class="btn bo" onclick="ScrReports._exportCsv()">Export CSV</button></div>',
      ct: `<div style="max-width:1060px;margin:0 auto">
        ${_pnlTabs('rp_pnl')}
        <div class="rp-filters">
          <div class="rp-fl-group"><div class="rp-fl-label">Month</div>
            <select class="fl" id="rp_month" onchange="ScrReports._onFilter()" style="width:110px">${_monthOpts(_filters.month)}</select>
          </div>
          <div class="rp-fl-group"><div class="rp-fl-label">Brand</div>
            <select class="fl" id="rp_brand" onchange="ScrReports._onFilter()" style="width:140px">${_brandOpts(_filters.brand)}</select>
          </div>
        </div>
        <div id="rp_pnl_content"><div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading P&L data...</div></div>
      </div>`,
    };
  }

  async function _loadPnlDashboard() {
    const el = document.getElementById('rp_pnl_content');
    if (!el) return;

    try {
      _pnlData = await API.getPnlSummary({
        month: _filters.month,
        brand: _filters.brand === 'All' ? null : _filters.brand,
      });
    } catch (e) {
      console.warn('getPnlSummary failed:', e.message);
      const el = document.getElementById('rp_pnl_content');
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load P&L data. Please try again.</div>';
      return;
    }

    const d = _pnlData;
    const rev = d.revenue || 0;
    const cogs = d.cogs || 0;
    const gp = rev - cogs;
    const opex = d.opex || 0;
    const wages = d.wages || 0;
    const rent = d.rent || 0;
    const ebitda = gp - opex;
    const dep = d.depreciation || 0;
    const interest = d.interest || 0;
    const net = ebitda - dep - interest;
    const gpPct = rev ? ((gp / rev) * 100).toFixed(1) : '0.0';
    const ebitdaPct = rev ? ((ebitda / rev) * 100).toFixed(1) : '0.0';
    const netPct = rev ? ((net / rev) * 100).toFixed(1) : '0.0';
    const colPct = rev ? ((cogs / rev) * 100).toFixed(1) : '0.0';

    // Previous month comparison
    const prevRev = d.prev_revenue || 0;
    const prevNet = d.prev_net || 0;
    const revChg = prevRev ? (((rev - prevRev) / prevRev) * 100) : 0;
    const netChg = prevNet ? (((net - prevNet) / Math.abs(prevNet)) * 100) : 0;

    // Expense breakdown for donut
    const totalExp = cogs + opex;
    const cogsPct = totalExp ? ((cogs / totalExp) * 100).toFixed(0) : 0;
    const wagesPct = totalExp ? ((wages / totalExp) * 100).toFixed(0) : 0;
    const rentPct = totalExp ? ((rent / totalExp) * 100).toFixed(0) : 0;
    const otherExp = opex - wages - rent;
    const otherPct = totalExp ? ((otherExp / totalExp) * 100).toFixed(0) : 0;

    // Bar chart data (3 months)
    const months = d.months || [];

    el.innerHTML = `
      <div class="kpi" style="flex-wrap:nowrap;margin-bottom:14px">
        <div class="kpi-c" style="border-top:3px solid var(--g);background:#fff"><div class="kpi-l" title="Total income from all sales channels">Revenue</div>
          <div class="kpi-v">${fm(rev, 0)}</div>
          <div style="font-size:9px;color:var(--g)">${_pctBadge(revChg)} vs prev</div></div>
        <div class="kpi-c" style="border-top:3px solid var(--o)"><div class="kpi-l" title="Revenue minus Cost of Goods Sold (COGS)">Gross Profit</div>
          <div class="kpi-v">${fm(gp, 0)}</div>
          <div style="font-size:9px">GP margin: ${gpPct}%</div></div>
        <div class="kpi-c" style="border-top:3px solid var(--b);background:#fff"><div class="kpi-l" title="Earnings Before Interest, Tax, Depreciation &amp; Amortisation">EBITDA</div>
          <div class="kpi-v">${fm(ebitda, 0)}</div>
          <div style="font-size:9px">EBITDA margin: ${ebitdaPct}%</div></div>
        <div class="kpi-c" style="border-top:3px solid var(--acc);background:#fff"><div class="kpi-l" title="Final profit after all expenses, depreciation, and interest">Net Profit</div>
          <div class="kpi-v" style="color:${net >= 0 ? 'var(--g)' : 'var(--r)'}">${fm(net, 0)}</div>
          <div style="font-size:9px">${_pctBadge(netChg)} vs prev</div></div>
        <div class="kpi-c" style="background:#fff"><div class="kpi-l" title="Cost of Living (COGS) as a percentage of Revenue — F&amp;B target: 30-35%">COL / Revenue</div>
          <div class="kpi-v" style="color:${Number(colPct) > 30 ? 'var(--r)' : 'var(--o)'}">${colPct}%</div>
          <div style="font-size:9px">Target &lt;30% ${Number(colPct) <= 30 ? '<span style="color:var(--g)">OK</span>' : '<span style="color:var(--r)">Over</span>'}</div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div class="card" style="margin:0"><div style="font-size:10px;font-weight:700;margin-bottom:8px">Revenue vs Expenses (3 months)</div>
          ${_renderBarChart(months, rev)}</div>
        <div class="card" style="margin:0"><div style="font-size:10px;font-weight:700;margin-bottom:8px">Expense Breakdown — ${_monthLabel(_filters.month)}</div>
          ${_renderDonut(totalExp, cogs, wages, rent, otherExp, cogsPct, wagesPct, rentPct, otherPct)}</div>
      </div>

      <div class="card" style="padding:0;overflow:hidden">
        <table class="tbl">
          <thead><tr>
            <th>${_monthLabel(_filters.month)} — Summary</th>
            <th style="text-align:right">Amount</th>
            <th style="text-align:right">% Rev</th>
            <th style="text-align:right">vs Prev</th>
          </tr></thead>
          <tbody>
            <tr style="background:var(--bg2)"><td style="font-weight:600">Revenue</td>
              <td style="text-align:right;color:var(--g);font-weight:600">${_fmTbl(rev)}</td>
              <td style="text-align:right">100%</td>
              <td style="text-align:right">${_pctBadge(revChg)}</td></tr>
            <tr><td style="padding-left:28px">COGs</td>
              <td style="text-align:right;color:var(--r)">(${_fmTbl(cogs)})</td>
              <td style="text-align:right">${_pctRev(cogs, rev)}</td>
              <td style="text-align:right">${_pctBadge(d.cogs_chg)}</td></tr>
            <tr style="background:var(--gbg)"><td style="font-weight:700">Gross Profit</td>
              <td style="text-align:right;color:var(--g);font-weight:700">${_fmTbl(gp)}</td>
              <td style="text-align:right;font-weight:700">${gpPct}%</td>
              <td style="text-align:right">${_pctBadge(d.gp_chg)}</td></tr>
            <tr><td style="padding-left:28px">Operating Expenses</td>
              <td style="text-align:right;color:var(--r)">(${_fmTbl(opex)})</td>
              <td style="text-align:right">${_pctRev(opex, rev)}</td>
              <td style="text-align:right">${_pctBadge(d.opex_chg)}</td></tr>
            <tr><td style="padding-left:28px">Wages & Salaries</td>
              <td style="text-align:right;color:var(--r)">(${_fmTbl(wages)})</td>
              <td style="text-align:right">${_pctRev(wages, rev)}</td>
              <td style="text-align:right">${_pctBadge(d.wages_chg)}</td></tr>
            <tr><td style="padding-left:28px">Rent & Occupancy</td>
              <td style="text-align:right;color:var(--r)">(${_fmTbl(rent)})</td>
              <td style="text-align:right">${_pctRev(rent, rev)}</td>
              <td style="text-align:right">—</td></tr>
            <tr style="background:var(--bbg)"><td style="font-weight:700">EBITDA</td>
              <td style="text-align:right;font-weight:700">${_fmTbl(ebitda)}</td>
              <td style="text-align:right;font-weight:700">${ebitdaPct}%</td>
              <td style="text-align:right">${_pctBadge(d.ebitda_chg)}</td></tr>
            <tr><td style="padding-left:28px">Depreciation</td>
              <td style="text-align:right;color:var(--r)">(${_fmTbl(dep)})</td>
              <td style="text-align:right">${_pctRev(dep, rev)}</td>
              <td style="text-align:right">—</td></tr>
            <tr><td style="padding-left:28px">Interest</td>
              <td style="text-align:right;color:var(--r)">(${_fmTbl(interest)})</td>
              <td style="text-align:right">${_pctRev(interest, rev)}</td>
              <td style="text-align:right">—</td></tr>
            <tr style="border-top:2px solid var(--t1);border-bottom:2px solid var(--t1)">
              <td style="font-weight:700;font-size:13px">Net Profit</td>
              <td style="text-align:right;color:${net >= 0 ? 'var(--g)' : 'var(--r)'};font-weight:700;font-size:13px">${net >= 0 ? _fmTbl(net) : '(' + _fmTbl(Math.abs(net)) + ')'}</td>
              <td style="text-align:right;font-weight:700">${netPct}%</td>
              <td style="text-align:right">${_pctBadge(netChg)}</td></tr>
          </tbody>
        </table>
      </div>`;
  }

  function _renderBarChart(months, maxRev) {
    if (!months || months.length === 0) {
      // Fallback: show empty
      return '<div style="text-align:center;padding:20px;color:var(--t3);font-size:11px">No monthly data</div>';
    }
    const max = Math.max(...months.map(m => Math.max(m.revenue || 0, m.expenses || 0)), 1);
    let html = '<div class="rp-bars">';
    months.forEach((m, i) => {
      const rH = ((m.revenue || 0) / max * 100).toFixed(0);
      const eH = ((m.expenses || 0) / max * 100).toFixed(0);
      const bold = i === months.length - 1;
      html += `<div class="rp-bar-group"><div class="rp-bar-pair">
        <div class="rp-bar" style="height:${rH}%;background:var(--gbg);border:1px solid var(--g)"></div>
        <div class="rp-bar" style="height:${eH}%;background:var(--rbg);border:1px solid var(--r)"></div>
      </div><div class="rp-bar-lbl">${bold ? '<b>' : ''}${esc(m.label || '')}${bold ? '</b>' : ''}<br>${bold ? '<b>' : ''}${_fmK(m.revenue)} / ${_fmK(m.expenses)}${bold ? '</b>' : ''}</div></div>`;
    });
    html += '</div>';
    html += '<div class="rp-legend"><span><span class="rp-legend-dot" style="background:var(--gbg);border:1px solid var(--g)"></span>Revenue</span>';
    html += '<span><span class="rp-legend-dot" style="background:var(--rbg);border:1px solid var(--r)"></span>Total Expenses</span></div>';
    return html;
  }

  function _renderDonut(total, cogs, wages, rent, other, cogsPct, wagesPct, rentPct, otherPct) {
    const c1 = Number(cogsPct);
    const c2 = c1 + Number(wagesPct);
    const c3 = c2 + Number(rentPct);
    return `<div style="display:flex;gap:12px;align-items:center">
      <div class="rp-donut" style="background:conic-gradient(var(--r) 0% ${c1}%, var(--o) ${c1}% ${c2}%, var(--b) ${c2}% ${c3}%, var(--t4) ${c3}% 100%)">
        <div class="rp-donut-inner"><div style="font-size:13px;font-weight:700">${_fmK(total)}</div><div style="font-size:8px;color:var(--t3)">total</div></div>
      </div>
      <div style="font-size:11px;line-height:2.2">
        <div><span class="rp-legend-dot" style="background:var(--r)"></span>COGs — ${fm(cogs, 0)} (${cogsPct}%)</div>
        <div><span class="rp-legend-dot" style="background:var(--o)"></span>Wages — ${fm(wages, 0)} (${wagesPct}%)</div>
        <div><span class="rp-legend-dot" style="background:var(--b)"></span>Rent & Utilities — ${fm(rent, 0)} (${rentPct}%)</div>
        <div><span class="rp-legend-dot" style="background:var(--t4)"></span>Other — ${fm(other, 0)} (${otherPct}%)</div>
      </div>
    </div>`;
  }

  function _monthLabel(ym) {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  // ══════════════════════════════════════════
  // rp_pnl_brand: BRAND COMPARISON
  // ══════════════════════════════════════════
  function renderPnlBrand() {
    if (!_filters.month) _filters.month = _curMonth();
    return {
      tb: '<div class="tb"><button class="bg" onclick="App.go(\'rp_pnl\')">← P&L</button><div class="tb-t">Brand Comparison</div>' +
          '<button class="btn bo" onclick="ScrReports._exportPdf()">Export PDF</button>' +
          '<button class="btn bo" onclick="ScrReports._exportCsv()">Export CSV</button></div>',
      ct: `<div style="max-width:1060px;margin:0 auto">
        ${_pnlTabs('rp_pnl_brand')}
        <div class="rp-filters">
          <div class="rp-fl-group"><div class="rp-fl-label">Month</div>
            <select class="fl" id="rp_month" onchange="ScrReports._onBrandFilter()" style="width:110px">${_monthOpts(_filters.month)}</select>
          </div>
        </div>
        <div id="rp_brand_content"><div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading brand data...</div></div>
      </div>`,
    };
  }

  async function _loadPnlBrand() {
    const el = document.getElementById('rp_brand_content');
    if (!el) return;

    try {
      _pnlBrandData = await API.getPnlBrandCompare({ month: _filters.month });
    } catch (e) {
      console.warn('getPnlBrandCompare failed:', e.message);
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load brand comparison data. Please try again.</div>';
      return;
    }

    const d = _pnlBrandData;
    const brands = d.brands || [];
    const totals = d.totals || {};

    // Brand summary cards
    let cardsHtml = '<div style="display:grid;grid-template-columns:repeat(' + Math.min(brands.length + 1, 5) + ',1fr);gap:10px;margin-bottom:14px">';
    // All brands total card
    cardsHtml += `<div class="card" style="margin:0;text-align:center;border-top:3px solid var(--t1)">
      <div style="font-size:11px;font-weight:600;margin-bottom:6px">All Brands</div>
      <div style="font-size:20px;font-weight:700;color:${(totals.net || 0) >= 0 ? 'var(--g)' : 'var(--r)'}">${fm(totals.net || 0, 0)}</div>
      <div style="font-size:10px;color:var(--t3)">Net · ${totals.revenue ? ((totals.net / totals.revenue) * 100).toFixed(1) : '0'}%</div>
    </div>`;

    const brandColors = ['#f59e0b', '#ec4899', '#0ea5e9', '#10b981', '#8b5cf6'];
    brands.forEach((b, i) => {
      const color = brandColors[i % brandColors.length];
      const netPct = b.revenue ? ((b.net / b.revenue) * 100).toFixed(1) : '0';
      const barW = totals.revenue ? ((b.revenue / totals.revenue) * 100).toFixed(0) : 0;
      cardsHtml += `<div class="card" style="margin:0;text-align:center;border-top:3px solid ${color}">
        <div style="font-size:11px;font-weight:600;margin-bottom:6px">${esc(b.name)}</div>
        <div style="font-size:20px;font-weight:700;color:${b.net >= 0 ? 'var(--g)' : 'var(--r)'}">${fm(b.net, 0)}</div>
        <div style="font-size:10px;color:var(--t3)">Net · ${netPct}%</div>
        <div style="height:4px;background:var(--bg3);border-radius:2px;margin-top:6px;overflow:hidden">
          <div style="height:100%;width:${barW}%;background:${color};border-radius:2px"></div></div>
      </div>`;
    });
    cardsHtml += '</div>';

    // Detail table
    let tblHtml = '<div class="card" style="padding:0;overflow:hidden"><table class="tbl"><thead><tr>';
    tblHtml += `<th style="width:25%">${_monthLabel(_filters.month)}</th>`;
    brands.forEach(b => { tblHtml += `<th style="text-align:right;width:${Math.floor(55 / brands.length)}%">${esc(b.name)}</th>`; });
    tblHtml += '<th style="text-align:right;width:20%">Total</th></tr></thead><tbody>';

    const rows = [
      { label: 'Revenue', key: 'revenue', bold: true, bg: 'var(--bg2)', color: '' },
      { label: 'COGs', key: 'cogs', indent: true, neg: true },
      { label: 'Gross Profit', key: 'gp', bold: true, bg: 'var(--gbg)', color: 'var(--g)', showPct: true },
      { label: 'Wages', key: 'wages', indent: true, neg: true },
      { label: 'Rent', key: 'rent', indent: true, neg: true },
      { label: 'Other OpEx', key: 'other_opex', indent: true, neg: true },
      { label: 'EBITDA', key: 'ebitda', bold: true, bg: 'var(--bbg)', showPct: true },
      { label: 'Net Profit', key: 'net', bold: true, border: true, color: 'auto', showPct: true, big: true },
    ];

    rows.forEach(r => {
      let style = '';
      if (r.bg) style += `background:${r.bg};`;
      if (r.border) style += 'border-top:2px solid var(--t1);';
      tblHtml += `<tr style="${style}">`;
      tblHtml += `<td style="${r.indent ? 'padding-left:24px' : ''}${r.bold ? ';font-weight:700' : ''}${r.big ? ';font-size:13px' : ''}">${esc(r.label)}</td>`;

      brands.forEach(b => {
        const val = b[r.key] || 0;
        let tdColor = '';
        if (r.color === 'auto') tdColor = val >= 0 ? 'color:var(--g)' : 'color:var(--r)';
        else if (r.color) tdColor = `color:${r.color}`;
        else if (r.neg) tdColor = 'color:var(--r)';
        const pctStr = r.showPct && b.revenue ? ` <span style="font-size:9px;color:var(--t3)">${((Math.abs(val) / b.revenue) * 100).toFixed(1)}%</span>` : '';
        const display = r.neg ? `(${_fmTbl(Math.abs(val))})` : _fmTbl(val);
        tblHtml += `<td style="text-align:right;${tdColor}${r.bold ? ';font-weight:' + (r.big ? '700' : '600') : ''}">${display}${pctStr}</td>`;
      });

      // Totals column
      const tVal = totals[r.key] || 0;
      let tColor = '';
      if (r.color === 'auto') tColor = tVal >= 0 ? 'color:var(--g)' : 'color:var(--r)';
      else if (r.color) tColor = `color:${r.color}`;
      else if (r.neg) tColor = 'color:var(--r)';
      const tPct = r.showPct && totals.revenue ? ` <span style="font-size:9px;color:var(--t3)">${((Math.abs(tVal) / totals.revenue) * 100).toFixed(1)}%</span>` : '';
      const tDisplay = r.neg ? `(${_fmTbl(Math.abs(tVal))})` : _fmTbl(tVal);
      tblHtml += `<td style="text-align:right;font-weight:700;${tColor}${r.big ? ';font-size:13px' : ''}">${tDisplay}${tPct}</td>`;
      tblHtml += '</tr>';
    });

    tblHtml += '</tbody></table></div>';

    // Best/Watch summary
    let bestGP = brands.reduce((best, b) => (b.gp_pct || 0) > (best.gp_pct || 0) ? b : best, { gp_pct: 0 });
    let bestNet = brands.reduce((best, b) => (b.net_pct || 0) > (best.net_pct || 0) ? b : best, { net_pct: 0 });
    let worst = brands.reduce((w, b) => (b.ebitda_pct || 100) < (w.ebitda_pct || 100) ? b : w, { ebitda_pct: 100 });
    let footHtml = `<div style="font-size:10px;color:var(--t3);margin-top:10px">`;
    if (bestGP.name) footHtml += `Best GP%: <b style="color:var(--g)">${esc(bestGP.name)} ${(bestGP.gp_pct || 0).toFixed(1)}%</b> · `;
    if (bestNet.name) footHtml += `Highest Net margin: <b style="color:var(--g)">${esc(bestNet.name)} ${(bestNet.net_pct || 0).toFixed(1)}%</b> · `;
    if (worst.name) footHtml += `Watch: <b style="color:var(--o)">${esc(worst.name)} EBITDA ${(worst.ebitda_pct || 0).toFixed(1)}%</b>`;
    footHtml += '</div>';

    el.innerHTML = cardsHtml + tblHtml + footHtml;
  }

  // ══════════════════════════════════════════
  // rp_pnl_flow: PROFIT FLOW (Waterfall)
  // ══════════════════════════════════════════
  function renderPnlFlow() {
    if (!_filters.month) _filters.month = _curMonth();
    return {
      tb: '<div class="tb"><button class="bg" onclick="App.go(\'rp_pnl\')">← P&L</button><div class="tb-t">Profit Flow</div>' +
          '<button class="btn bo" onclick="ScrReports._exportPdf()">Export PDF</button>' +
          '<button class="btn bo" onclick="ScrReports._exportCsv()">Export CSV</button></div>',
      ct: `<div style="max-width:1000px;margin:0 auto">
        ${_pnlTabs('rp_pnl_flow')}
        <div class="rp-filters">
          <div class="rp-fl-group"><div class="rp-fl-label">Month</div>
            <select class="fl" id="rp_month" onchange="ScrReports._onFlowFilter()" style="width:110px">${_monthOpts(_filters.month)}</select>
          </div>
          <div class="rp-fl-group"><div class="rp-fl-label">Brand</div>
            <select class="fl" id="rp_brand" onchange="ScrReports._onFlowFilter()" style="width:140px">${_brandOpts(_filters.brand)}</select>
          </div>
        </div>
        <div id="rp_flow_content"><div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
      </div>`,
    };
  }

  async function _loadPnlFlow() {
    const el = document.getElementById('rp_flow_content');
    if (!el) return;

    try {
      _flowData = await API.getProfitFlow({
        month: _filters.month,
        brand: _filters.brand === 'All' ? null : _filters.brand,
      });
    } catch (e) {
      console.warn('getProfitFlow failed:', e.message);
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load profit flow data. Please try again.</div>';
      return;
    }

    const d = _flowData;
    const rev = d.revenue || 0;
    const net = d.net || 0;
    const netPct = rev ? ((net / rev) * 100).toFixed(1) : '0';

    // KPI row
    let html = `<div class="kpi" style="flex-wrap:nowrap;margin-bottom:14px">
      <div class="kpi-c" style="border-top:3px solid var(--g);background:#fff"><div class="kpi-l">Revenue</div><div class="kpi-v">${_fmK(rev)}</div></div>
      <div class="kpi-c" style="border-top:3px solid var(--r);background:#fff"><div class="kpi-l">Total Costs</div><div class="kpi-v" style="color:var(--r)">(${_fmK(d.total_costs || 0)})</div></div>
      <div class="kpi-c" style="border-top:3px solid var(--acc);background:#fff"><div class="kpi-l">Net Profit</div><div class="kpi-v" style="color:${net >= 0 ? 'var(--g)' : 'var(--r)'}">${fm(net, 0)}</div><div style="font-size:9px;color:var(--t3)">${netPct}% net margin</div></div>
    </div>`;

    // Waterfall chart
    html += `<div class="card"><div style="font-size:12px;font-weight:700;margin-bottom:14px">Revenue → Net Profit Flow — ${_monthLabel(_filters.month)}</div>`;

    const items = d.waterfall || [];
    items.forEach(w => {
      const pct = rev ? ((Math.abs(w.amount) / rev) * 100) : 0;
      const color = w.color || 'var(--t3)';
      const isSub = w.is_subtotal || false;
      html += `<div class="wf-row${isSub ? ' sub' : ''}">
        <div class="wf-lbl" style="color:${color}">${esc(w.label)}</div>
        <div class="wf-bar"><div class="wf-bar-fill" style="width:${pct.toFixed(1)}%;background:${color};opacity:${isSub ? 1 : 0.6}"></div></div>
        <div class="wf-val" style="color:${color}">${esc(w.display)}</div>
      </div>`;
    });

    html += '</div>';

    // Cost drivers summary
    const drivers = d.cost_drivers || [];
    if (drivers.length) {
      html += `<div style="font-size:10px;color:var(--t3);margin-top:10px">Biggest cost drivers: ${drivers.map(d => esc(d)).join(' · ')}</div>`;
    }

    el.innerHTML = html;
  }

  // ══════════════════════════════════════════
  // rp_pnl_full: FULL P&L STATEMENT (Classic)
  // ══════════════════════════════════════════
  function renderPnlFull() {
    const now = _curMonth();
    const yr = now.substring(0, 4);
    if (!_fullFilters.from) _fullFilters.from = yr + '-01';
    if (!_fullFilters.to) _fullFilters.to = now;
    return {
      tb: '<div class="tb"><button class="bg" onclick="App.go(\'rp_pnl\')">← P&L</button><div class="tb-t">Full P&L Statement</div>' +
          '<button class="btn bo" onclick="ScrReports._exportPdf()">Export PDF</button>' +
          '<button class="btn bo" onclick="ScrReports._exportCsv()">Export CSV</button></div>',
      ct: `<div style="max-width:1060px;margin:0 auto">
        ${_pnlTabs('rp_pnl_full')}
        <div class="rp-filters">
          <div class="rp-fl-group"><div class="rp-fl-label">Period</div>
            <select class="fl" id="rp_period" style="width:100px"><option>Monthly</option><option>Quarterly</option><option>Yearly</option></select></div>
          <div class="rp-fl-group"><div class="rp-fl-label">From</div>
            <input class="fl" type="month" id="rp_from" value="${_fullFilters.from}" style="width:120px"></div>
          <div class="rp-fl-group"><div class="rp-fl-label">To</div>
            <input class="fl" type="month" id="rp_to" value="${_fullFilters.to}" style="width:120px"></div>
          <div class="rp-fl-group"><div class="rp-fl-label">Brand</div>
            <select class="fl" id="rp_full_brand" style="width:140px">${_brandOpts(_fullFilters.brand)}</select></div>
          <div class="rp-fl-group"><div class="rp-fl-label">Compare</div>
            <select class="fl" id="rp_compare" style="width:120px"><option>None</option><option>vs Last Year</option><option>vs Budget</option></select></div>
          <button class="bs" onclick="ScrReports._loadPnlFull()" style="align-self:flex-end">Apply</button>
        </div>
        <div id="rp_full_content"><div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
      </div>`,
    };
  }

  async function _loadPnlFull() {
    const el = document.getElementById('rp_full_content');
    if (!el) return;

    // Read filter values
    const from = document.getElementById('rp_from')?.value || _fullFilters.from;
    const to = document.getElementById('rp_to')?.value || _fullFilters.to;
    const brand = document.getElementById('rp_full_brand')?.value || 'All';
    _fullFilters.from = from;
    _fullFilters.to = to;
    _fullFilters.brand = brand;

    el.innerHTML = '<div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div>';

    try {
      _fullData = await API.getPnlFull({
        from, to,
        brand: brand === 'All' ? null : brand,
      });
    } catch (e) {
      console.warn('getPnlFull failed:', e.message);
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load Full P&L data. Please try again.</div>';
      return;
    }

    const d = _fullData;
    const cols = d.columns || []; // e.g. ['Jan 2026', 'Feb 2026', 'Mar 2026']
    const groups = d.groups || []; // hierarchical data

    // Issue #18: Check if all values are zero — show empty state instead of rows of zeros
    const allZero = groups.every(grp => {
      const itemsZero = (grp.items || []).every(item => (item.values || []).every(v => !v || v === 0));
      const totalsZero = (grp.totals || []).every(v => !v || v === 0);
      const subtotalZero = !grp.subtotal || (grp.subtotal.values || []).every(v => !v || v === 0);
      return itemsZero && totalsZero && subtotalZero;
    });
    if (allZero) {
      el.innerHTML = '<div class="empty" style="padding:40px;color:var(--t3);text-align:center"><div style="font-size:24px;margin-bottom:8px">📊</div>No financial data recorded for this period</div>';
      return;
    }

    const S = 'style="text-align:right"';
    const N = 'style="text-align:right;color:var(--r)"';
    const G = 'style="text-align:right;color:var(--g)"';

    let html = '<div class="card" style="padding:0;overflow:hidden"><table class="tbl" style="font-size:12px"><thead><tr>';
    html += `<th style="width:30%">Account</th>`;
    cols.forEach(c => { html += `<th ${S} style="width:${Math.floor(70 / cols.length)}%">${esc(c)}</th>`; });
    html += '</tr></thead><tbody>';

    groups.forEach(grp => {
      // Group header
      html += `<tr style="background:var(--bg2)"><td colspan="${cols.length + 1}" style="font-weight:700;font-size:11px;padding-top:10px">${esc(grp.label)}</td></tr>`;

      // Sub-items
      (grp.items || []).forEach(item => {
        html += '<tr>';
        html += `<td style="padding-left:28px">${esc(item.label)}</td>`;
        (item.values || []).forEach((v, ci) => {
          const isLast = ci === item.values.length - 1;
          const style = grp.is_negative ? N : S;
          html += `<td ${style}${isLast ? ';font-weight:600' : ''}>${grp.is_negative ? '(' + _fmTbl(Math.abs(v)) + ')' : _fmTbl(v)}</td>`;
        });
        html += '</tr>';
      });

      // Group total
      if (grp.totals) {
        html += `<tr style="background:var(--bg2)"><td style="font-weight:600">${esc(grp.total_label || 'Total ' + grp.label)}</td>`;
        grp.totals.forEach((v, ci) => {
          const isLast = ci === grp.totals.length - 1;
          const style = grp.is_negative ? N : S;
          html += `<td ${style}${isLast ? ';font-weight:600' : ''}>${grp.is_negative ? '(' + _fmTbl(Math.abs(v)) + ')' : _fmTbl(v)}</td>`;
        });
        html += '</tr>';
      }

      // Subtotal row (Gross Profit, EBITDA, Net Profit)
      if (grp.subtotal) {
        const st = grp.subtotal;
        const bgMap = { 'Gross Profit': 'var(--gbg)', 'EBITDA': 'var(--bbg)', 'Net Profit': '' };
        const bg = bgMap[st.label] || '';
        const isFinal = st.label === 'Net Profit';
        html += `<tr style="${bg ? 'background:' + bg : ''}${isFinal ? ';border-top:2px solid var(--t1);border-bottom:2px solid var(--t1)' : ''}">`;
        html += `<td style="font-weight:700${isFinal ? ';font-size:13px' : ''}">${esc(st.label)}</td>`;
        (st.values || []).forEach((v, ci) => {
          const isLast = ci === st.values.length - 1;
          const pctStr = st.pcts ? ` <span style="font-size:9px;color:var(--t3)">${st.pcts[ci]}%</span>` : '';
          html += `<td ${G} style="font-weight:700${isFinal ? ';font-size:' + (isLast ? '14px' : '13px') : ''}">${_fmTbl(v)}${pctStr}</td>`;
        });
        html += '</tr>';
      }
    });

    html += '</tbody></table></div>';
    el.innerHTML = html;
  }

  // ══════════════════════════════════════════
  // FILTER HANDLERS
  // ══════════════════════════════════════════
  function _onFilter() {
    _filters.month = document.getElementById('rp_month')?.value || _filters.month;
    _filters.brand = document.getElementById('rp_brand')?.value || 'All';
    _pnlData = null; // force re-fetch
    _loadPnlDashboard();
  }

  function _onBrandFilter() {
    _filters.month = document.getElementById('rp_month')?.value || _filters.month;
    _pnlBrandData = null;
    _loadPnlBrand();
  }

  function _onFlowFilter() {
    _filters.month = document.getElementById('rp_month')?.value || _filters.month;
    _filters.brand = document.getElementById('rp_brand')?.value || 'All';
    _flowData = null;
    _loadPnlFlow();
  }

  // ══════════════════════════════════════════
  // STUBS (export, future screens)
  // ══════════════════════════════════════════
  function _exportPdf() { App.toast('Export PDF — coming soon'); }
  function _exportCsv() { App.toast('Export CSV — coming soon'); }

  // (Mock data functions removed — all screens use live API data)

  // ══════════════════════════════════════════
  // rp_bs: BALANCE SHEET
  // ══════════════════════════════════════════
  function renderBalanceSheet() {
    if (!_filters.month) _filters.month = _curMonth();
    return {
      tb: '<div class="tb"><div class="tb-t">Balance Sheet</div>' +
          '<select class="fl" id="rp_bs_brand" onchange="ScrReports._onBsFilter()" style="width:140px">' + _brandOpts(_filters.brand) + '</select>' +
          '<select class="fl" id="rp_bs_month" onchange="ScrReports._onBsFilter()" style="width:110px">' + _monthOpts(_filters.month) + '</select></div>',
      ct: `<div style="max-width:1000px;margin:0 auto">
        <div id="rp_bs_content"><div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading Balance Sheet...</div></div>
      </div>`,
    };
  }

  async function _loadBalanceSheet() {
    const el = document.getElementById('rp_bs_content');
    if (!el) return;

    try {
      _bsData = await API.getBalanceSheet({
        month: _filters.month,
        brand: _filters.brand === 'All' ? null : _filters.brand,
      });
    } catch (e) {
      console.warn('getBalanceSheet failed:', e.message);
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load Balance Sheet data. Please try again.</div>';
      return;
    }

    const d = _bsData;
    const totalAssets = d.total_assets || 0;
    const totalLiabilities = d.total_liabilities || 0;
    const equity = d.equity || 0;
    const balanced = Math.abs(totalAssets - (totalLiabilities + equity)) < 1;

    // KPI bar
    let html = `<div class="kpi" style="flex-wrap:nowrap">
      <div class="kpi-c"><div class="kpi-l">Total Assets</div><div class="kpi-v">${fm(totalAssets, 0)}</div></div>
      <div class="kpi-c"><div class="kpi-l">Total Liabilities</div><div class="kpi-v" style="color:var(--r)">${fm(totalLiabilities, 0)}</div></div>
      <div class="kpi-c"><div class="kpi-l">Equity</div><div class="kpi-v" style="color:${equity >= 0 ? 'var(--g)' : 'var(--r)'}">${fm(equity, 0)}</div></div>
    </div>`;

    // P&L hierarchical layout
    const cols = d.columns || [_monthLabel(_filters.month)];
    const prevCol = d.prev_column || null;
    const gridCols = prevCol ? '1fr 100px 100px' : '1fr 100px';

    html += '<div class="pl">';
    // Header
    html += `<div class="pl-hd" style="grid-template-columns:${gridCols}"><div>Account</div>`;
    cols.forEach(c => { html += `<div style="text-align:right">${esc(c)}</div>`; });
    if (prevCol) html += `<div style="text-align:right">${esc(prevCol)}</div>`;
    html += '</div>';

    // Sections
    (d.sections || []).forEach(sec => {
      // Section header
      html += `<div class="pl-r cat" style="grid-template-columns:${gridCols}"><div>${esc(sec.label)}</div></div>`;
      // Items
      (sec.items || []).forEach(item => {
        html += `<div class="pl-r sub" style="grid-template-columns:${gridCols}"><div>${esc(item.label)}</div>`;
        html += `<div class="pl-v">${_fmTbl(item.current)}</div>`;
        if (prevCol) html += `<div class="pl-v" style="color:var(--t3)">${_fmTbl(item.previous)}</div>`;
        html += '</div>';
      });
      // Section total
      html += `<div class="pl-r total" style="grid-template-columns:${gridCols}"><div>${esc(sec.total_label || 'Total ' + sec.label)}</div>`;
      html += `<div class="pl-v"${sec.total_color ? ' style="color:' + sec.total_color + '"' : ''}>${_fmTbl(sec.total_current)}</div>`;
      if (prevCol) html += `<div class="pl-v" style="color:var(--t3)">${_fmTbl(sec.total_previous)}</div>`;
      html += '</div>';
    });

    // L + E grand total
    if (d.le_total) {
      html += `<div class="pl-r grand" style="grid-template-columns:${gridCols}"><div>L + E</div>`;
      html += `<div class="pl-v">${_fmTbl(d.le_total.current)}</div>`;
      if (prevCol) html += `<div class="pl-v" style="color:var(--t3)">${_fmTbl(d.le_total.previous)}</div>`;
      html += '</div>';
    }

    html += '</div>';

    // Balanced badge
    html += `<div style="margin-top:6px;padding:8px;background:${balanced ? 'var(--gbg)' : 'var(--rbg)'};border-radius:var(--rd);text-align:center">
      <span style="font-size:11px;font-weight:700;color:${balanced ? 'var(--g)' : 'var(--r)'}">${balanced ? '✓ Balanced' : '✗ Not Balanced'}</span>
      <span style="font-size:10px;color:var(--t3)">Assets ${fm(totalAssets, 0)} ${balanced ? '=' : '≠'} L + E ${fm(totalLiabilities + equity, 0)}</span>
    </div>`;

    el.innerHTML = html;
  }

  function _onBsFilter() {
    _filters.month = document.getElementById('rp_bs_month')?.value || _filters.month;
    _filters.brand = document.getElementById('rp_bs_brand')?.value || 'All';
    _bsData = null;
    _loadBalanceSheet();
  }

  // ══════════════════════════════════════════
  // rp_cf: CASH FLOW STATEMENT
  // ══════════════════════════════════════════
  function renderCashFlow() {
    if (!_filters.month) _filters.month = _curMonth();
    return {
      tb: '<div class="tb"><div class="tb-t">Cash Flow Statement</div>' +
          '<select class="fl" id="rp_cf_month" onchange="ScrReports._onCfFilter()" style="width:110px">' + _monthOpts(_filters.month) + '</select>' +
          '<select class="fl" id="rp_cf_brand" onchange="ScrReports._onCfFilter()" style="width:140px">' + _brandOpts(_filters.brand) + '</select></div>',
      ct: `<div style="max-width:1000px;margin:0 auto">
        <div id="rp_cf_content"><div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading Cash Flow...</div></div>
      </div>`,
    };
  }

  async function _loadCashFlow() {
    const el = document.getElementById('rp_cf_content');
    if (!el) return;

    try {
      _cfData = await API.getCashFlow({
        month: _filters.month,
        brand: _filters.brand === 'All' ? null : _filters.brand,
      });
    } catch (e) {
      console.warn('getCashFlow failed:', e.message);
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load Cash Flow data. Please try again.</div>';
      return;
    }

    const d = _cfData;

    // KPI bar
    let html = `<div class="kpi" style="flex-wrap:nowrap">
      <div class="kpi-c"><div class="kpi-l">Operating</div><div class="kpi-v" style="color:${(d.operating || 0) >= 0 ? 'var(--g)' : 'var(--r)'}">${_fmK(d.operating)}</div></div>
      <div class="kpi-c"><div class="kpi-l">Investing</div><div class="kpi-v" style="color:${(d.investing || 0) >= 0 ? 'var(--g)' : 'var(--r)'}">${_fmK(d.investing)}</div></div>
      <div class="kpi-c"><div class="kpi-l">Financing</div><div class="kpi-v" style="color:${(d.financing || 0) >= 0 ? 'var(--g)' : 'var(--r)'}">${_fmK(d.financing)}</div></div>
      <div class="kpi-c"><div class="kpi-l">Net Cash</div><div class="kpi-v" style="color:${(d.net_cash || 0) >= 0 ? 'var(--g)' : 'var(--r)'}">${_fmK(d.net_cash)}</div></div>
    </div>`;

    // P&L layout
    const gridCols = '1fr 100px 100px';
    html += '<div class="pl">';
    html += `<div class="pl-hd" style="grid-template-columns:${gridCols}"><div>Item</div><div style="text-align:right">This Month</div><div style="text-align:right">YTD</div></div>`;

    (d.sections || []).forEach(sec => {
      // Section header
      html += `<div class="pl-r cat" style="grid-template-columns:${gridCols}"><div>${esc(sec.label)}</div></div>`;
      // Items
      (sec.items || []).forEach(item => {
        html += `<div class="pl-r sub" style="grid-template-columns:${gridCols}"><div>${esc(item.label)}</div>`;
        const mColor = item.month >= 0 ? 'var(--g)' : 'var(--r)';
        html += `<div class="pl-v" style="color:${mColor}">${item.month >= 0 ? _fmTbl(item.month) : '(' + _fmTbl(Math.abs(item.month)) + ')'}</div>`;
        html += `<div class="pl-v" style="color:var(--t3)">${item.ytd >= 0 ? _fmTbl(item.ytd) : '(' + _fmTbl(Math.abs(item.ytd)) + ')'}</div>`;
        html += '</div>';
      });
      // Section total
      if (sec.total_label) {
        const tColor = (sec.total_month || 0) >= 0 ? 'var(--g)' : 'var(--r)';
        html += `<div class="pl-r total" style="grid-template-columns:${gridCols}"><div>${esc(sec.total_label)}</div>`;
        html += `<div class="pl-v" style="color:${tColor}">${_fmTbl(sec.total_month)}</div>`;
        html += `<div class="pl-v" style="color:var(--t3)">${_fmTbl(sec.total_ytd)}</div>`;
        html += '</div>';
      }
    });

    // Grand total
    const netColor = (d.net_cash || 0) >= 0 ? 'var(--g)' : 'var(--r)';
    html += `<div class="pl-r grand" style="grid-template-columns:${gridCols}"><div>Net Cash Change</div>`;
    html += `<div class="pl-v" style="color:${netColor}">${_fmTbl(d.net_cash)}</div>`;
    html += `<div class="pl-v" style="color:var(--t3)">${_fmTbl(d.net_cash_ytd)}</div>`;
    html += '</div></div>';

    el.innerHTML = html;
  }

  function _onCfFilter() {
    _filters.month = document.getElementById('rp_cf_month')?.value || _filters.month;
    _filters.brand = document.getElementById('rp_cf_brand')?.value || 'All';
    _cfData = null;
    _loadCashFlow();
  }

  /** Helper: prev month string */
  function _prevMonthStr(ym) {
    if (!ym) return '';
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // ══════════════════════════════════════════
  // rp_apar: AP/AR TRACKER
  // ══════════════════════════════════════════
  function renderApar() {
    return {
      tb: '<div class="tb"><div class="tb-t">AP/AR Tracker</div>' +
          '<select class="fl" id="rp_apar_brand" onchange="ScrReports._onAparFilter()" style="width:140px">' + _brandOpts(_filters.brand) + '</select></div>',
      ct: `<div style="max-width:1000px;margin:0 auto">
        <div id="rp_apar_kpi"></div>
        <div class="tabs" id="rp_apar_tabs">
          <div class="tab a" onclick="ScrReports._aparTab('ap')">Accounts Payable</div>
          <div class="tab" onclick="ScrReports._aparTab('ar')">Accounts Receivable</div>
          <div class="tab" onclick="ScrReports._aparTab('aging')">Aging Summary</div>
        </div>
        <div id="rp_apar_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
      </div>`,
    };
  }

  async function _loadApar() {
    try {
      _aparData = await API.getApArTracker({ brand: _filters.brand === 'All' ? null : _filters.brand });
    } catch (e) {
      console.warn('getApArTracker failed:', e.message);
      const el = document.getElementById('rp_apar_content');
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load AP/AR data. Please try again.</div>';
      return;
    }
    _renderAparKpi();
    _renderAparTable();
  }

  function _renderAparKpi() {
    const el = document.getElementById('rp_apar_kpi');
    if (!el || !_aparData) return;
    const d = _aparData;
    el.innerHTML = `<div class="kpi" style="flex-wrap:nowrap">
      <div class="kpi-c"><div class="kpi-l">Total AP</div><div class="kpi-v" style="color:var(--r)">${_fmK(d.total_ap)}</div></div>
      <div class="kpi-c"><div class="kpi-l">Overdue AP</div><div class="kpi-v" style="color:var(--r)">${_fmK(d.overdue_ap)}</div></div>
      <div class="kpi-c"><div class="kpi-l">Total AR</div><div class="kpi-v" style="color:var(--g)">${_fmK(d.total_ar)}</div></div>
      <div class="kpi-c"><div class="kpi-l">Overdue AR</div><div class="kpi-v" style="color:var(--g)">${_fmK(d.overdue_ar)}</div></div>
    </div>`;
  }

  function _renderAparTable() {
    const el = document.getElementById('rp_apar_content');
    if (!el || !_aparData) return;
    // Update tab highlight
    document.querySelectorAll('#rp_apar_tabs .tab').forEach(t => t.classList.remove('a'));
    const tabMap = { ap: 0, ar: 1, aging: 2 };
    const tabs = document.querySelectorAll('#rp_apar_tabs .tab');
    if (tabs[tabMap[_aparTab]]) tabs[tabMap[_aparTab]].classList.add('a');

    const rows = _aparTab === 'ar' ? (_aparData.ar_rows || []) : (_aparData.ap_rows || []);
    if (_aparTab === 'aging') {
      // Aging summary
      const aging = _aparData.aging || {};
      el.innerHTML = `<div class="card" style="padding:16px"><div style="font-size:11px;font-weight:700;margin-bottom:10px">AP Aging Summary</div>
        <div style="display:flex;gap:10px;margin-bottom:10px">
          <div style="flex:1;padding:10px;background:var(--gbg);border-radius:var(--rd);text-align:center"><div style="font-size:10px;color:var(--t3)">Current</div><div style="font-size:16px;font-weight:700">${fm(aging.current || 0, 0)}</div></div>
          <div style="flex:1;padding:10px;background:var(--obg);border-radius:var(--rd);text-align:center"><div style="font-size:10px;color:var(--t3)">1-30 days</div><div style="font-size:16px;font-weight:700">${fm(aging.d30 || 0, 0)}</div></div>
          <div style="flex:1;padding:10px;background:var(--rbg);border-radius:var(--rd);text-align:center"><div style="font-size:10px;color:var(--t3)">31-60 days</div><div style="font-size:16px;font-weight:700">${fm(aging.d60 || 0, 0)}</div></div>
          <div style="flex:1;padding:10px;background:var(--rbg);border-radius:var(--rd);text-align:center"><div style="font-size:10px;color:var(--t3)">60+ days</div><div style="font-size:16px;font-weight:700;color:var(--r)">${fm(aging.d90 || 0, 0)}</div></div>
        </div></div>`;
      return;
    }
    let html = '<table class="tbl" id="rp_aging_tbl"><thead><tr>' + App.sth('Supplier','supplier','rp_aging_tbl') + App.sthR('Current','current','rp_aging_tbl') + App.sthR('1-30 days','d30','rp_aging_tbl') + App.sthR('31-60 days','d60','rp_aging_tbl') + App.sthR('60+ days','d60p','rp_aging_tbl') + App.sthR('Total','total','rp_aging_tbl') + '</tr></thead><tbody>';
    if (rows.length === 0) {
      html += `<tr><td colspan="6" style="text-align:center;color:var(--t3);padding:20px">No ${_aparTab === 'ar' ? 'receivables' : 'payables'} found</td></tr>`;
    }
    rows.forEach(r => {
      const hasOverdue = (r.d30 || 0) + (r.d60 || 0) + (r.d90 || 0) > 0;
      html += `<tr><td>${esc(r.name)}</td>
        <td style="text-align:right">${_fmTbl(r.current)}</td>
        <td style="text-align:right">${_fmTbl(r.d30)}</td>
        <td style="text-align:right">${_fmTbl(r.d60)}</td>
        <td style="text-align:right">${_fmTbl(r.d90)}</td>
        <td style="text-align:right;font-weight:600${hasOverdue ? ';color:var(--r)' : ''}">${_fmTbl(r.total)}</td></tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function _aparTabSwitch(tab) { _aparTab = tab; _renderAparTable(); }
  function _onAparFilter() {
    _filters.brand = document.getElementById('rp_apar_brand')?.value || 'All';
    _aparData = null; _loadApar();
  }

  // ══════════════════════════════════════════
  // rp_asset: FIXED ASSET MANAGEMENT
  // ══════════════════════════════════════════
  function renderAsset() {
    return {
      tb: '<div class="tb"><div class="tb-t">Fixed Asset Management</div><button class="bs" onclick="ScrReports._addAsset()">+ Register Asset</button></div>',
      ct: `<div style="max-width:1000px;margin:0 auto">
        <div id="rp_asset_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
      </div>`,
    };
  }

  async function _loadAsset() {
    const el = document.getElementById('rp_asset_content');
    if (!el) return;
    try {
      _assetData = await API.getAssetSummary({});
    } catch (e) {
      console.warn('getAssetSummary failed:', e.message);
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load asset data. Please try again.</div>';
      return;
    }
    const d = _assetData;
    let html = `<div class="kpi" style="flex-wrap:nowrap">
      <div class="kpi-c"><div class="kpi-l">Total Assets</div><div class="kpi-v">${d.count || 0}</div></div>
      <div class="kpi-c"><div class="kpi-l">Original Cost</div><div class="kpi-v">${fm(d.total_cost || 0, 0)}</div></div>
      <div class="kpi-c"><div class="kpi-l">Accumulated Dep.</div><div class="kpi-v" style="color:var(--r)">${fm(d.total_dep || 0, 0)}</div></div>
      <div class="kpi-c"><div class="kpi-l">Net Book Value</div><div class="kpi-v" style="color:var(--g)">${fm(d.total_nbv || 0, 0)}</div></div>
    </div>`;
    html += '<table class="tbl" id="rp_asset_tbl"><thead><tr>' + App.sth('Asset ID','id','rp_asset_tbl') + App.sth('Name','name','rp_asset_tbl') + App.sth('Category','cat','rp_asset_tbl') + App.sth('Brand','brand','rp_asset_tbl') + App.sth('Purchase Date','date','rp_asset_tbl') + App.sthR('Cost','cost','rp_asset_tbl') + App.sthR('NBV','nbv','rp_asset_tbl') + App.sth('Status','status','rp_asset_tbl') + '</tr></thead><tbody>';
    (d.rows || []).forEach(r => {
      html += `<tr><td><a class="lk">${esc(r.asset_id)}</a></td><td>${esc(r.name)}</td><td>${esc(r.category)}</td><td>${esc(r.brand)}</td><td>${esc(r.purchase_date)}</td>
        <td style="text-align:right">${fm(r.cost)}</td><td style="text-align:right">${fm(r.nbv)}</td>
        <td>${r.nbv <= 0 ? '<span class="sts sts-o">Fully Dep.</span>' : '<span class="sts sts-c">Active</span>'}</td></tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function _addAsset() { App.toast('Register Asset — coming soon'); }

  // ══════════════════════════════════════════
  // rp_bank: BANK ACCOUNT SUMMARY
  // ══════════════════════════════════════════
  function renderBank() {
    return {
      tb: '<div class="tb"><div class="tb-t">Bank Account Summary</div>' +
          '<select class="fl" id="rp_bank_brand" onchange="ScrReports._onBankFilter()" style="width:140px">' + _brandOpts(_filters.brand) + '</select></div>',
      ct: `<div style="max-width:1000px;margin:0 auto">
        <div style="font-size:11px;color:var(--t3);margin-bottom:8px">Book balance (SPG) vs Bank statement balance — shows reconciliation status</div>
        <div id="rp_bank_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
      </div>`,
    };
  }

  async function _loadBank() {
    const el = document.getElementById('rp_bank_content');
    if (!el) return;
    try {
      _bankData = await API.getBankSummary({ brand: _filters.brand === 'All' ? null : _filters.brand });
    } catch (e) {
      console.warn('getBankSummary failed:', e.message);
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load bank summary data. Please try again.</div>';
      return;
    }
    const d = _bankData;
    let html = '<table class="tbl" id="rp_bank_tbl"><thead><tr>' + App.sth('Account','acct','rp_bank_tbl') + App.sth('Brand','brand','rp_bank_tbl') + App.sthR('SPG Balance','spg','rp_bank_tbl') + App.sthR('Bank Balance','bank','rp_bank_tbl') + App.sthR('Difference','diff','rp_bank_tbl') + App.sth('Reconciled?','recon','rp_bank_tbl') + App.sth('Last reconciled','last','rp_bank_tbl') + '</tr></thead><tbody>';
    (d.rows || []).forEach(r => {
      const diff = (r.spg_balance || 0) - (r.bank_balance || 0);
      const diffColor = Math.abs(diff) < 0.01 ? 'var(--g)' : (Math.abs(diff) > 500 ? 'var(--r)' : 'var(--o)');
      const reconBadge = Math.abs(diff) < 0.01 ? '<span class="sts sts-c">Yes</span>' : (Math.abs(diff) > 500 ? '<span class="sts sts-r">No</span>' : '<span class="sts sts-p">Partial</span>');
      html += `<tr><td style="font-weight:600">${esc(r.account)}</td><td>${esc(r.brand)}</td>
        <td style="text-align:right">${fm(r.spg_balance)}</td>
        <td style="text-align:right">${fm(r.bank_balance)}</td>
        <td style="text-align:right;color:${diffColor};font-weight:600">${fm(diff)}</td>
        <td>${reconBadge}</td><td>${esc(r.last_reconciled || '')}</td></tr>`;
    });
    html += '</tbody></table>';
    const totalSpg = (d.rows || []).reduce((s, r) => s + (r.spg_balance || 0), 0);
    html += `<div style="text-align:right;font-size:12px;margin-top:8px"><b>Total SPG Balance: ${fm(totalSpg)}</b></div>`;
    el.innerHTML = html;
  }

  function _onBankFilter() {
    _filters.brand = document.getElementById('rp_bank_brand')?.value || 'All';
    _bankData = null; _loadBank();
  }

  // ══════════════════════════════════════════
  // rp_cash: CASH ACCOUNT SUMMARY
  // ══════════════════════════════════════════
  function renderCash() {
    return {
      tb: '<div class="tb"><div class="tb-t">Cash Account Summary</div>' +
          '<select class="fl" id="rp_cash_brand" onchange="ScrReports._onCashFilter()" style="width:140px">' + _brandOpts(_filters.brand) + '</select></div>',
      ct: `<div style="max-width:1000px;margin:0 auto">
        <div style="font-size:11px;color:var(--t3);margin-bottom:8px">Cash-in-hand accounts — must match physical cash count</div>
        <div id="rp_cash_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
      </div>`,
    };
  }

  async function _loadCash() {
    const el = document.getElementById('rp_cash_content');
    if (!el) return;
    try {
      _cashData = await API.getCashSummary({ brand: _filters.brand === 'All' ? null : _filters.brand });
    } catch (e) {
      console.warn('getCashSummary failed:', e.message);
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load cash summary data. Please try again.</div>';
      return;
    }
    let html = '<table class="tbl" id="rp_cash_tbl"><thead><tr>' + App.sth('Account','acct','rp_cash_tbl') + App.sth('Brand','brand','rp_cash_tbl') + App.sthR('System Balance','sys','rp_cash_tbl') + App.sthR('Last Count','count','rp_cash_tbl') + App.sthR('Difference','diff','rp_cash_tbl') + App.sth('Last counted','last','rp_cash_tbl') + App.sth('Status','status','rp_cash_tbl') + '</tr></thead><tbody>';
    (_cashData.rows || []).forEach(r => {
      const diff = (r.system || 0) - (r.count || 0);
      const diffColor = Math.abs(diff) < 0.01 ? 'var(--g)' : 'var(--r)';
      const badge = Math.abs(diff) < 0.01 ? '<span class="sts sts-c">Matched</span>' : '<span class="sts sts-r">Short</span>';
      html += `<tr><td style="font-weight:600">${esc(r.account)}</td><td>${esc(r.brand)}</td>
        <td style="text-align:right">${fm(r.system)}</td><td style="text-align:right">${fm(r.count)}</td>
        <td style="text-align:right;color:${diffColor};font-weight:600">${diff >= 0 ? fm(diff) : '-' + fm(Math.abs(diff))}</td>
        <td>${esc(r.last_counted || '')}</td><td>${badge}</td></tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function _onCashFilter() {
    _filters.brand = document.getElementById('rp_cash_brand')?.value || 'All';
    _cashData = null; _loadCash();
  }

  // ══════════════════════════════════════════
  // rp_loan: LOAN & EQUITY REPORT
  // ══════════════════════════════════════════
  function renderLoan() {
    return {
      tb: '<div class="tb"><div class="tb-t">Loan & Equity Report</div>' +
          '<select class="fl" id="rp_loan_brand" style="width:140px">' + _brandOpts('All') + '</select></div>',
      ct: `<div style="max-width:1000px;margin:0 auto">
        <div class="tabs" id="rp_loan_tabs">
          <div class="tab a" onclick="ScrReports._loanTab('interco')">Intercompany Matrix</div>
          <div class="tab" onclick="ScrReports._loanTab('director')">Director Loans</div>
          <div class="tab" onclick="ScrReports._loanTab('capital')">Capital Structure</div>
        </div>
        <div id="rp_loan_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
      </div>`,
    };
  }

  async function _loadLoan() {
    try {
      _loanData = await API.getLoanReport({});
    } catch (e) {
      console.warn('getLoanReport failed:', e.message);
      const el = document.getElementById('rp_loan_content');
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load loan data. Please try again.</div>';
      return;
    }
    _renderLoanTab();
  }

  function _renderLoanTab() {
    const el = document.getElementById('rp_loan_content');
    if (!el || !_loanData) return;
    // Update tab highlight
    document.querySelectorAll('#rp_loan_tabs .tab').forEach(t => t.classList.remove('a'));
    const tabMap = { interco: 0, director: 1, capital: 2 };
    const tabs = document.querySelectorAll('#rp_loan_tabs .tab');
    if (tabs[tabMap[_loanTab]]) tabs[tabMap[_loanTab]].classList.add('a');

    const d = _loanData;
    let html = '';

    if (_loanTab === 'interco') {
      const matrix = d.intercompany_matrix || {};
      const brands = d.brand_names || [];
      html += '<div class="card" style="margin:0 0 10px"><div style="font-size:11px;font-weight:700;margin-bottom:6px">Intercompany Loan Matrix</div>';
      html += '<table class="tbl"><thead><tr><th>From \\ To</th>';
      brands.forEach(b => { html += `<th style="text-align:right">${esc(b.substring(0, 8))}</th>`; });
      html += '</tr></thead><tbody>';
      (d.intercompany_rows || []).forEach(row => {
        html += `<tr><td style="font-weight:600">${esc(row.from)}</td>`;
        (row.amounts || []).forEach(a => {
          const color = a > 100000 ? ';color:var(--r);font-weight:700' : (a > 10000 ? ';color:var(--g)' : '');
          html += `<td style="text-align:right${color}">${a === null ? '—' : _fmTbl(a)}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      if (d.interco_note) html += `<div style="font-size:10px;color:var(--t3);margin-top:6px">${esc(d.interco_note)}</div>`;
      html += '</div>';
    } else if (_loanTab === 'director') {
      html += '<div class="card" style="margin:0 0 10px"><div style="font-size:11px;font-weight:700;margin-bottom:6px">Director Loans Summary</div>';
      html += '<table class="tbl" id="rp_dir_tbl"><thead><tr>' + App.sth('Director','director','rp_dir_tbl') + App.sth('Entity','entity','rp_dir_tbl') + App.sthR('Lent','lent','rp_dir_tbl') + App.sthR('Repaid','repaid','rp_dir_tbl') + App.sthR('Outstanding','outstanding','rp_dir_tbl') + App.sth('Is Capital?','capital','rp_dir_tbl') + '</tr></thead><tbody>';
      (d.director_loans || []).forEach(r => {
        html += `<tr><td>${esc(r.director)}</td><td>${esc(r.entity)}</td>
          <td style="text-align:right">${fm(r.lent)}</td><td style="text-align:right">${fm(r.repaid)}</td>
          <td style="text-align:right;font-weight:600">${fm(r.outstanding)}</td><td>${esc(r.is_capital)}</td></tr>`;
      });
      html += '</tbody></table></div>';
    } else {
      // Capital structure
      html += '<div class="card" style="margin:0 0 10px"><div style="font-size:11px;font-weight:700;margin-bottom:6px">Capital Structure</div>';
      html += '<table class="tbl" id="rp_equity_tbl"><thead><tr>' + App.sth('Entity','entity','rp_equity_tbl') + App.sthR('Share Capital','share','rp_equity_tbl') + App.sthR('Director Loans','loans','rp_equity_tbl') + App.sthR('Retained Earnings','retained','rp_equity_tbl') + App.sthR('Total Equity','total','rp_equity_tbl') + '</tr></thead><tbody>';
      (d.capital_structure || []).forEach(r => {
        html += `<tr><td style="font-weight:600">${esc(r.entity)}</td>
          <td style="text-align:right">${fm(r.share_capital)}</td><td style="text-align:right">${fm(r.director_loans)}</td>
          <td style="text-align:right">${fm(r.retained)}</td><td style="text-align:right;font-weight:700">${fm(r.total_equity)}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }
    el.innerHTML = html;
  }

  function _loanTabSwitch(tab) { _loanTab = tab; _renderLoanTab(); }

  // (Mock data functions for E6b-3 screens removed — all screens use live API data)

  // ══════════════════════════════════════════
  // fp_brand: BRAND COMPARISON (Performance)
  // ══════════════════════════════════════════
  function renderFpBrand() {
    if (!_filters.month) _filters.month = _curMonth();
    return {
      tb: '<div class="tb"><div class="tb-t">Brand Comparison</div>' +
          '<select class="fl" id="fp_month" onchange="ScrReports._onFpBrandFilter()" style="width:110px">' + _monthOpts(_filters.month) + '</select></div>',
      ct: `<div style="max-width:1000px;margin:0 auto">
        <div id="fp_brand_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
      </div>`,
    };
  }

  async function _loadFpBrand() {
    const el = document.getElementById('fp_brand_content');
    if (!el) return;
    try {
      _fpBrandData = await API.getBrandComparison({ month: _filters.month });
    } catch (e) {
      console.warn('getBrandComparison failed:', e.message);
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load brand comparison data. Please try again.</div>';
      return;
    }
    const d = _fpBrandData;
    const brands = d.brands || [];
    // KPI highlights
    const bestRev = brands.reduce((b, c) => (c.revenue || 0) > (b.revenue || 0) ? c : b, { revenue: 0 });
    const bestGP = brands.reduce((b, c) => (c.gp_pct || 0) > (b.gp_pct || 0) ? c : b, { gp_pct: 0 });
    const worstRev = brands.reduce((b, c) => (c.rev_chg || 0) < (b.rev_chg || 0) ? c : b, { rev_chg: 0 });

    let html = `<div class="kpi" style="flex-wrap:nowrap">
      <div class="kpi-c"><div class="kpi-v" style="color:var(--g)">${esc(bestRev.name || '')}</div><div class="kpi-l">Best Revenue ${_fmK(bestRev.revenue)}</div></div>
      <div class="kpi-c"><div class="kpi-v" style="color:var(--g)">${esc(bestGP.name || '')}</div><div class="kpi-l">Best GP ${(bestGP.gp_pct || 0).toFixed(0)}%</div></div>
      <div class="kpi-c"><div class="kpi-v" style="color:var(--o)">${esc(worstRev.name || '')}</div><div class="kpi-l">Revenue ${(worstRev.rev_chg || 0) >= 0 ? '+' : ''}${(worstRev.rev_chg || 0).toFixed(0)}%</div></div>
    </div>`;

    // Table
    html += '<table class="tbl"><thead><tr><th></th>';
    brands.forEach(b => { html += `<th style="text-align:right">${esc(b.name)}</th>`; });
    html += '<th style="text-align:right;font-weight:700">Total</th></tr></thead><tbody>';

    const totals = d.totals || {};
    const metrics = [
      { label: 'Revenue', key: 'revenue', fmt: (v) => _fmK(v) },
      { label: 'GP%', key: 'gp_pct', fmt: (v) => (v || 0).toFixed(0) + '%', colorHigh: true },
      { label: 'COL%', key: 'col_pct', fmt: (v) => (v || 0).toFixed(0) + '%', colorOver30: true },
      { label: 'Net Profit', key: 'net', fmt: (v) => (v >= 0 ? '+' : '') + _fmK(v), colorSign: true },
    ];

    metrics.forEach(m => {
      html += `<tr><td style="font-weight:600">${esc(m.label)}</td>`;
      brands.forEach(b => {
        const v = b[m.key] || 0;
        let style = 'text-align:right';
        if (m.colorSign) style += v >= 0 ? ';color:var(--g)' : ';color:var(--r)';
        if (m.colorHigh && v > 70) style += ';color:var(--g)';
        if (m.colorOver30 && v > 30) style += ';color:var(--r)';
        html += `<td style="${style}">${m.fmt(v)}</td>`;
      });
      const tv = totals[m.key] || 0;
      let tStyle = 'text-align:right;font-weight:700';
      if (m.colorSign) tStyle += tv >= 0 ? ';color:var(--g)' : ';color:var(--r)';
      html += `<td style="${tStyle}">${m.fmt(tv)}</td></tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function _onFpBrandFilter() {
    _filters.month = document.getElementById('fp_month')?.value || _filters.month;
    _fpBrandData = null; _loadFpBrand();
  }

  // ══════════════════════════════════════════
  // fp_budget: BUDGET vs ACTUAL
  // ══════════════════════════════════════════
  function renderFpBudget() {
    if (!_filters.month) _filters.month = _curMonth();
    return {
      tb: '<div class="tb"><div class="tb-t">Budget vs Actual</div>' +
          '<select class="fl" id="fp_bud_month" onchange="ScrReports._onFpBudgetFilter()" style="width:110px">' + _monthOpts(_filters.month) + '</select>' +
          '<select class="fl" id="fp_bud_brand" onchange="ScrReports._onFpBudgetFilter()" style="width:140px">' + _brandOpts(_filters.brand) + '</select></div>',
      ct: `<div style="max-width:1000px;margin:0 auto">
        <div id="fp_budget_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
      </div>`,
    };
  }

  async function _loadFpBudget() {
    const el = document.getElementById('fp_budget_content');
    if (!el) return;
    try {
      _fpBudgetData = await API.getBudgetVsActual({ month: _filters.month, brand: _filters.brand === 'All' ? null : _filters.brand });
    } catch (e) {
      console.warn('getBudgetVsActual failed:', e.message);
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load budget data. Please try again.</div>';
      return;
    }
    const d = _fpBudgetData;
    const achievement = d.budget_rev ? ((d.actual_rev / d.budget_rev) * 100).toFixed(0) : '0';

    let html = `<div class="kpi" style="flex-wrap:nowrap">
      <div class="kpi-c"><div class="kpi-l">Actual Revenue</div><div class="kpi-v" style="color:var(--g)">${_fmK(d.actual_rev)}</div></div>
      <div class="kpi-c"><div class="kpi-l">Budget Revenue</div><div class="kpi-v" style="color:var(--t3)">${_fmK(d.budget_rev)}</div></div>
      <div class="kpi-c"><div class="kpi-l">Achievement</div><div class="kpi-v" style="color:${Number(achievement) >= 100 ? 'var(--g)' : 'var(--r)'}">${achievement}%</div></div>
    </div>`;
    html += '<table class="tbl" id="rp_budget_tbl"><thead><tr>' + App.sth('Category','cat','rp_budget_tbl') + App.sthR('Budget','budget','rp_budget_tbl') + App.sthR('Actual','actual','rp_budget_tbl') + App.sthR('Variance','variance','rp_budget_tbl') + App.sthR('%','pct','rp_budget_tbl') + '</tr></thead><tbody>';
    (d.rows || []).forEach(r => {
      const variance = (r.actual || 0) - (r.budget || 0);
      const isExpense = r.category !== 'Revenue';
      const isGood = isExpense ? variance <= 0 : variance >= 0;
      const vColor = isGood ? 'var(--g)' : 'var(--r)';
      const pct = r.budget ? ((variance / r.budget) * 100).toFixed(1) : '0';
      html += `<tr><td>${esc(r.category)}</td>
        <td style="text-align:right">${_fmTbl(r.budget)}</td>
        <td style="text-align:right${!isGood ? ';color:var(--r)' : ''}">${_fmTbl(r.actual)}</td>
        <td style="text-align:right;color:${vColor}">${variance >= 0 ? '+' : ''}${_fmTbl(variance)}</td>
        <td style="text-align:right;color:${vColor}">${variance >= 0 ? '+' : ''}${pct}%</td></tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function _onFpBudgetFilter() {
    _filters.month = document.getElementById('fp_bud_month')?.value || _filters.month;
    _filters.brand = document.getElementById('fp_bud_brand')?.value || 'All';
    _fpBudgetData = null; _loadFpBudget();
  }

  // ══════════════════════════════════════════
  // fp_rev: REVENUE ANALYSIS
  // ══════════════════════════════════════════
  function renderFpRev() {
    if (!_filters.month) _filters.month = _curMonth();
    return {
      tb: '<div class="tb"><div class="tb-t">Revenue Analysis</div>' +
          '<select class="fl" id="fp_rev_month" onchange="ScrReports._onFpRevFilter()" style="width:110px">' + _monthOpts(_filters.month) + '</select>' +
          '<select class="fl" id="fp_rev_brand" onchange="ScrReports._onFpRevFilter()" style="width:140px">' + _brandOpts(_filters.brand) + '</select></div>',
      ct: `<div style="max-width:1000px;margin:0 auto">
        <div id="fp_rev_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
      </div>`,
    };
  }

  async function _loadFpRev() {
    const el = document.getElementById('fp_rev_content');
    if (!el) return;
    try {
      _fpRevData = await API.getRevenueAnalysis({ month: _filters.month, brand: _filters.brand === 'All' ? null : _filters.brand });
    } catch (e) {
      console.warn('getRevenueAnalysis failed:', e.message);
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load revenue analysis data. Please try again.</div>';
      return;
    }
    const d = _fpRevData;
    let html = `<div class="kpi" style="flex-wrap:nowrap">
      <div class="kpi-c"><div class="kpi-l">Total Revenue</div><div class="kpi-v" style="color:var(--g)">${_fmK(d.total)}</div></div>
      <div class="kpi-c"><div class="kpi-l">In-store</div><div class="kpi-v" style="color:var(--b)">${_fmK(d.instore)}</div></div>
      <div class="kpi-c"><div class="kpi-l">Delivery</div><div class="kpi-v" style="color:var(--o)">${_fmK(d.delivery)}</div></div>
      <div class="kpi-c"><div class="kpi-l">Other</div><div class="kpi-v" style="color:var(--acc)">${_fmK(d.other)}</div></div>
    </div>`;
    html += '<table class="tbl" id="rp_rev_tbl"><thead><tr>' + App.sth('Channel','channel','rp_rev_tbl') + App.sthR('This Month','this','rp_rev_tbl') + App.sthR('Last Month','last','rp_rev_tbl') + App.sthR('Change','change','rp_rev_tbl') + App.sthR('% of Total','pct','rp_rev_tbl') + '</tr></thead><tbody>';
    (d.rows || []).forEach(r => {
      const chg = r.prev ? (((r.amount - r.prev) / r.prev) * 100) : 0;
      const pctTotal = d.total ? ((r.amount / d.total) * 100).toFixed(1) : '0';
      const chgColor = chg >= 0 ? 'var(--g)' : 'var(--r)';
      html += `<tr><td>${esc(r.channel)}</td>
        <td style="text-align:right">${_fmTbl(r.amount)}</td>
        <td style="text-align:right">${_fmTbl(r.prev)}</td>
        <td style="text-align:right;color:${chgColor}${Math.abs(chg) > 20 ? ';font-weight:700' : ''}">${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%</td>
        <td style="text-align:right">${pctTotal}%</td></tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function _onFpRevFilter() {
    _filters.month = document.getElementById('fp_rev_month')?.value || _filters.month;
    _filters.brand = document.getElementById('fp_rev_brand')?.value || 'All';
    _fpRevData = null; _loadFpRev();
  }

  // ══════════════════════════════════════════
  // fp_exp: EXPENSE TREND
  // ══════════════════════════════════════════
  function renderFpExp() {
    if (!_filters.month) _filters.month = _curMonth();
    return {
      tb: '<div class="tb"><div class="tb-t">Expense Trend</div>' +
          '<select class="fl" id="fp_exp_month" onchange="ScrReports._onFpExpFilter()" style="width:110px">' + _monthOpts(_filters.month) + '</select>' +
          '<select class="fl" id="fp_exp_brand" onchange="ScrReports._onFpExpFilter()" style="width:140px">' + _brandOpts(_filters.brand) + '</select></div>',
      ct: `<div style="max-width:1000px;margin:0 auto">
        <div id="fp_exp_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
      </div>`,
    };
  }

  async function _loadFpExp() {
    const el = document.getElementById('fp_exp_content');
    if (!el) return;
    try {
      _fpExpData = await API.getExpenseTrend({ month: _filters.month, brand: _filters.brand === 'All' ? null : _filters.brand });
    } catch (e) {
      console.warn('getExpenseTrend failed:', e.message);
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load expense trend data. Please try again.</div>';
      return;
    }
    const d = _fpExpData;
    const momChg = d.prev_total ? (((d.total - d.prev_total) / d.prev_total) * 100).toFixed(0) : '0';
    const largest = (d.rows || []).reduce((b, c) => (c.amount || 0) > (b.amount || 0) ? c : b, { amount: 0 });

    let html = `<div class="kpi" style="flex-wrap:nowrap">
      <div class="kpi-c"><div class="kpi-l">Total Overheads</div><div class="kpi-v" style="color:var(--r)">${_fmK(d.total)}</div></div>
      <div class="kpi-c"><div class="kpi-l">MoM Change</div><div class="kpi-v" style="color:var(--o)">${Number(momChg) >= 0 ? '+' : ''}${momChg}%</div></div>
      <div class="kpi-c"><div class="kpi-l">Largest: ${esc(largest.category || '')}</div><div class="kpi-v">${_fmK(largest.amount)}</div></div>
    </div>`;
    html += '<table class="tbl" id="rp_exp_tbl"><thead><tr>' + App.sth('Category','cat','rp_exp_tbl') + App.sthR('This Month','this','rp_exp_tbl') + App.sthR('Last Month','last','rp_exp_tbl') + App.sthR('Change','change','rp_exp_tbl') + App.sthR('% of Revenue','pct','rp_exp_tbl') + '</tr></thead><tbody>';
    (d.rows || []).forEach(r => {
      const chg = r.prev ? (((r.amount - r.prev) / r.prev) * 100) : 0;
      const revPct = d.revenue ? ((r.amount / d.revenue) * 100).toFixed(1) : '0';
      const chgColor = Math.abs(chg) > 5 ? (chg > 0 ? 'var(--r)' : 'var(--g)') : ''; // expense increase = bad
      html += `<tr><td>${esc(r.category)}</td>
        <td style="text-align:right">${_fmTbl(r.amount)}</td>
        <td style="text-align:right">${_fmTbl(r.prev)}</td>
        <td style="text-align:right${chgColor ? ';color:' + chgColor : ''}">${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%</td>
        <td style="text-align:right${Number(revPct) > 30 ? ';color:var(--r)' : ''}">${revPct}%</td></tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function _onFpExpFilter() {
    _filters.month = document.getElementById('fp_exp_month')?.value || _filters.month;
    _filters.brand = document.getElementById('fp_exp_brand')?.value || 'All';
    _fpExpData = null; _loadFpExp();
  }

  // (Mock data functions for E6c Performance removed — all screens use live API data)

  // ══════════════════════════════════════════
  // dashboard: CFO BRIEF (E6d)
  // ══════════════════════════════════════════
  function renderDashboard() {
    if (!_filters.month) _filters.month = _curMonth();
    return {
      tb: '<div class="tb"><div class="tb-t">Financial Dashboard</div>' +
          '<select class="fl" id="dash_month" onchange="ScrReports._onDashFilter()" style="width:110px">' + _monthOpts(_filters.month) + '</select>' +
          '<select class="fl" id="dash_brand" onchange="ScrReports._onDashFilter()" style="width:140px">' + _brandOpts(_filters.brand) + '</select></div>',
      ct: `<div style="max-width:1100px;margin:0 auto">
        <div id="dash_content"><div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading CFO Brief...</div></div>
      </div>`,
    };
  }

  async function _loadDashboard() {
    const el = document.getElementById('dash_content');
    if (!el) return;

    try {
      _dashData = await API.getCfoDashboard({
        month: _filters.month,
        brand: _filters.brand === 'All' ? null : _filters.brand,
      });
    } catch (e) {
      console.warn('getCfoDashboard failed:', e.message);
      if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--r)">Failed to load dashboard data. Please try again.</div>';
      return;
    }

    const d = _dashData;
    let h = '';

    // ── Brand Scoreboard ──
    h += '<div style="display:flex;gap:8px;margin-bottom:14px">';
    (d.brands || []).forEach(b => {
      const dotColor = b.net >= 0 ? 'var(--g)' : 'var(--r)';
      const borderColor = b.net >= 0 ? 'var(--g)' : (b.rev_chg < -5 ? 'var(--r)' : 'var(--o)');
      h += `<div class="card" style="flex:1;margin:0;border-top:3px solid ${borderColor};padding:10px 12px;cursor:pointer" onclick="App.go('tx_log')">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:11px;font-weight:700">${esc(b.name)}</span><span style="width:8px;height:8px;border-radius:50%;background:${dotColor}"></span></div>
        <div style="font-size:16px;font-weight:800">${_fmK(b.revenue)}</div>
        <div style="font-size:9px;color:var(--t3)">Revenue · ${b.rev_chg >= 0 ? '▲' : '▼'} ${Math.abs(b.rev_chg || 0).toFixed(1)}%</div>
        <div style="font-size:11px;font-weight:600;color:${b.net >= 0 ? 'var(--g)' : 'var(--r)'};margin-top:4px">Net ${b.net >= 0 ? '+' : ''}${fm(b.net, 0)} (${(b.net_pct || 0).toFixed(1)}%)</div>
      </div>`;
    });
    h += '</div>';

    // ── Mini Indicator Badges ──
    h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap">';
    (d.indicators || []).forEach(ind => {
      const color = ind.color || 'var(--t3)';
      const bg = ind.bg || 'transparent';
      h += `<div style="display:flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;font-size:10px;font-weight:500;border:1px solid ${color};background:${bg}"><span style="width:6px;height:6px;border-radius:50%;background:${color}"></span><span style="color:${color}">${esc(ind.label)}</span></div>`;
    });
    h += '</div>';

    // ── Grid Row 1: Cash / P&L / AP ──
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">';

    // Cash Position
    const cp = d.cash_position || {};
    const cpTotal = cp.total || 0;
    const pnlRev = (d.pnl_snapshot || {}).revenue || 0;
    const cashWarning = (cpTotal === 0 && pnlRev > 0) ? '<div style="font-size:var(--fs-xxs);color:var(--o);margin-top:4px">\u26a0\ufe0f Cash position may not reflect all transactions. <a class="lk" style="font-size:var(--fs-xxs)" onclick="App.go(\'rc_bank\')">Reconcile \u2192</a></div>' : '';
    h += `<div class="card" style="margin:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:11px;font-weight:700">Cash Position</span><a class="lk" onclick="App.go('rc_bank')">Bank Reconcile \u2192</a></div>
      <div style="font-size:24px;font-weight:800;margin-bottom:6px">${fm(cpTotal, 0)}</div>
      <div style="font-size:10px;color:var(--t2)">${esc(cp.breakdown || '')}</div>${cashWarning}</div>`;

    // P&L Snapshot
    const pnl = d.pnl_snapshot || {};
    h += `<div class="card" style="margin:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:11px;font-weight:700">P&L Snapshot</span><a class="lk" onclick="App.go('rp_pnl')">Full P&L →</a></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">
        <div><div style="color:var(--t3);font-size:9px">Revenue</div><div style="font-weight:600">${_fmK(pnl.revenue)} ${pnl.rev_chg ? '<span style="color:var(--g);font-size:9px">▲' + pnl.rev_chg + '%</span>' : ''}</div></div>
        <div><div style="color:var(--t3);font-size:9px">GP%</div><div style="font-weight:600;color:var(--g)">${(pnl.gp_pct || 0).toFixed(1)}%</div></div>
        <div><div style="color:var(--t3);font-size:9px">EBITDA</div><div style="font-weight:600">${_fmK(pnl.ebitda)}</div></div>
        <div><div style="color:var(--t3);font-size:9px">Net Profit</div><div style="font-weight:600;color:${(pnl.net || 0) >= 0 ? 'var(--g)' : 'var(--r)'}">${fm(pnl.net || 0, 0)}</div></div>
      </div></div>`;

    // Accounts Payable
    const ap = d.ap || {};
    h += `<div class="card" style="margin:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:11px;font-weight:700">Accounts Payable</span><a class="lk" onclick="App.go('rp_apar')">AP/AR →</a></div>
      <div style="display:flex;gap:8px;margin-bottom:6px"><div><div style="font-size:16px;font-weight:700;color:var(--r)">${fm(ap.total || 0, 0)}</div><div style="font-size:9px;color:var(--t3)">total payable</div></div>
      <div><div style="font-size:16px;font-weight:700;color:var(--r)">${fm(ap.overdue || 0, 0)}</div><div style="font-size:9px;color:var(--t3)">overdue</div></div></div>
      ${ap.note ? '<div style="font-size:10px;color:var(--r)">' + esc(ap.note) + '</div>' : ''}</div>`;

    h += '</div>';

    // ── Grid Row 2: Recon / Loans / Tax ──
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">';

    // Reconciliation
    const rc = d.reconciliation || {};
    h += `<div class="card" style="margin:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:11px;font-weight:700">Reconciliation</span><a class="lk" onclick="App.go('rc_bank')">Reconcile →</a></div>
      <div style="display:flex;gap:8px;margin-bottom:6px"><div><div style="font-size:16px;font-weight:700;color:var(--g)">${esc(rc.days_done || '0/0')}</div><div style="font-size:9px;color:var(--t3)">days done</div></div>
      <div><div style="font-size:16px;font-weight:700;color:var(--o)">${fm(rc.unmatched || 0, 0)}</div><div style="font-size:9px;color:var(--t3)">unmatched</div></div></div>
      ${rc.note ? '<div style="font-size:10px;color:var(--o)">' + esc(rc.note) + '</div>' : ''}</div>`;

    // Loans
    const ln = d.loans || {};
    h += `<div class="card" style="margin:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:11px;font-weight:700">Loans & Intercompany</span><a class="lk" onclick="App.go('ac_loan')">Loans →</a></div>
      <div style="font-size:11px;line-height:1.8">
        <div style="display:flex;justify-content:space-between"><span>Loans outstanding</span><span style="font-weight:600;color:var(--r)">${_fmK(ln.outstanding)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Intercompany owing</span><span style="font-weight:600;color:var(--o)">${_fmK(ln.interco)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Next repayment</span><span style="font-weight:600">${esc(ln.next_repayment || 'N/A')}</span></div>
      </div></div>`;

    // Tax
    const tx = d.tax || {};
    h += `<div class="card" style="margin:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:11px;font-weight:700">Tax & Obligations</span><a class="lk" onclick="App.go('pr_super')">Obligations →</a></div>
      <div style="font-size:11px;line-height:1.8">
        <div style="display:flex;justify-content:space-between"><span>GST refund</span><span style="font-weight:600;color:var(--g)">${fm(tx.gst || 0, 0)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Super payable</span><span style="font-weight:600">${fm(tx.super || 0, 0)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>PAYG</span><span style="font-weight:600">${fm(tx.payg || 0, 0)}</span></div>
      </div></div>`;

    h += '</div>';

    // ── Action Items ──
    const actions = d.actions || [];
    if (actions.length > 0) {
      h += `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:11px;font-weight:700">Action Items</span><span style="font-size:10px;color:var(--t3)">${actions.length} items</span></div>`;
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">';
      actions.forEach(a => {
        const bgMap = { High: 'var(--rbg)', Med: 'var(--obg)', Low: 'var(--bg3)' };
        const colorMap = { High: 'var(--r)', Med: 'var(--o)', Low: 'var(--t3)' };
        h += `<div style="padding:5px 10px;border-radius:var(--rd);font-size:11px;display:flex;align-items:center;gap:6px;background:${bgMap[a.priority] || 'var(--bg3)'}">
          <span style="color:${colorMap[a.priority] || 'var(--t3)'};font-weight:600;min-width:36px">${esc(a.priority)}</span> ${esc(a.text)}</div>`;
      });
      h += '</div></div>';
    }

    el.innerHTML = h;
  }

  function _onDashFilter() {
    _filters.month = document.getElementById('dash_month')?.value || _filters.month;
    _filters.brand = document.getElementById('dash_brand')?.value || 'All';
    _dashData = null;
    _loadDashboard();
  }

  // (Mock dashboard data removed — uses live API data)

  // ══════════════════════════════════════════
  // REGISTER ROUTES
  // ══════════════════════════════════════════
  App.registerRoutes({
    dashboard:    { render: renderDashboard,     onLoad: _loadDashboard },
    rp_pnl:       { render: renderPnlDashboard, onLoad: _loadPnlDashboard },
    rp_pnl_brand: { render: renderPnlBrand,     onLoad: _loadPnlBrand },
    rp_pnl_flow:  { render: renderPnlFlow,      onLoad: _loadPnlFlow },
    rp_pnl_full:  { render: renderPnlFull,       onLoad: _loadPnlFull },
    rp_bs:        { render: renderBalanceSheet,  onLoad: _loadBalanceSheet },
    rp_cf:        { render: renderCashFlow,      onLoad: _loadCashFlow },
    rp_apar:      { render: renderApar,          onLoad: _loadApar },
    rp_asset:     { render: renderAsset,         onLoad: _loadAsset },
    rp_bank:      { render: renderBank,          onLoad: _loadBank },
    rp_cash:      { render: renderCash,          onLoad: _loadCash },
    rp_loan:      { render: renderLoan,          onLoad: _loadLoan },
    fp_brand:     { render: renderFpBrand,       onLoad: _loadFpBrand },
    fp_budget:    { render: renderFpBudget,      onLoad: _loadFpBudget },
    fp_rev:       { render: renderFpRev,         onLoad: _loadFpRev },
    fp_exp:       { render: renderFpExp,         onLoad: _loadFpExp },
  });

  // ══════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════
  window.ScrReports = {
    _onFilter,
    _onBrandFilter,
    _onFlowFilter,
    _loadPnlFull,
    _onBsFilter,
    _onCfFilter,
    _aparTab: _aparTabSwitch,
    _onAparFilter,
    _addAsset,
    _onBankFilter,
    _onCashFilter,
    _loanTab: _loanTabSwitch,
    _onFpBrandFilter,
    _onFpBudgetFilter,
    _onFpRevFilter,
    _onFpExpFilter,
    _onDashFilter,
    _exportPdf,
    _exportCsv,
  };

})();
