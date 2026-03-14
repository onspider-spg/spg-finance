/** Version 1.0 | 15 MAR 2026 | Siam Palette Group */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_reports_fin.js
 * Reports: P&L Dashboard, Brand Comparison, Profit Flow, Full P&L
 * Lazy-loaded by app_fin.js on first visit to rp_* routes
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
      console.warn('getPnlSummary failed, using mock:', e.message);
      _pnlData = _mockPnlSummary();
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
        <div class="kpi-c" style="border-top:3px solid var(--g);background:#fff"><div class="kpi-l">Revenue</div>
          <div class="kpi-v">${fm(rev, 0)}</div>
          <div style="font-size:9px;color:var(--g)">${_pctBadge(revChg)} vs prev</div></div>
        <div class="kpi-c" style="border-top:3px solid var(--o)"><div class="kpi-l">Gross Profit</div>
          <div class="kpi-v">${fm(gp, 0)}</div>
          <div style="font-size:9px">GP margin: ${gpPct}%</div></div>
        <div class="kpi-c" style="border-top:3px solid var(--b);background:#fff"><div class="kpi-l">EBITDA</div>
          <div class="kpi-v">${fm(ebitda, 0)}</div>
          <div style="font-size:9px">EBITDA margin: ${ebitdaPct}%</div></div>
        <div class="kpi-c" style="border-top:3px solid var(--acc);background:#fff"><div class="kpi-l">Net Profit</div>
          <div class="kpi-v" style="color:${net >= 0 ? 'var(--g)' : 'var(--r)'}">${fm(net, 0)}</div>
          <div style="font-size:9px">${_pctBadge(netChg)} vs prev</div></div>
        <div class="kpi-c" style="background:#fff"><div class="kpi-l">COL / Revenue</div>
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
      console.warn('getPnlBrandCompare failed, using mock:', e.message);
      _pnlBrandData = _mockBrandCompare();
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
      console.warn('getProfitFlow failed, using mock:', e.message);
      _flowData = _mockProfitFlow();
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
      console.warn('getPnlFull failed, using mock:', e.message);
      _fullData = _mockPnlFull();
    }

    const d = _fullData;
    const cols = d.columns || []; // e.g. ['Jan 2026', 'Feb 2026', 'Mar 2026']
    const groups = d.groups || []; // hierarchical data
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

  // ══════════════════════════════════════════
  // MOCK DATA (fallback if API not connected)
  // ══════════════════════════════════════════
  function _mockPnlSummary() {
    return {
      revenue: 211000, cogs: 142700, opex: 57700, wages: 30100, rent: 12000,
      depreciation: 800, interest: 330,
      prev_revenue: 201700, prev_net: 6560,
      cogs_chg: 3.6, gp_chg: 6.7, opex_chg: 2.5, wages_chg: 3.1, ebitda_chg: 37.7,
      months: [
        { label: 'Jan', revenue: 192000, expenses: 188000 },
        { label: 'Feb', revenue: 202000, expenses: 195000 },
        { label: 'Mar', revenue: 211000, expenses: 201000 },
      ],
    };
  }

  function _mockBrandCompare() {
    return {
      brands: [
        { name: 'Mango Coco', revenue: 107500, cogs: 69900, gp: 37600, wages: 15200, rent: 5000, other_opex: 9400, ebitda: 8000, net: 6200, gp_pct: 35.0, net_pct: 5.8, ebitda_pct: 7.4 },
        { name: 'Flying Tigress', revenue: 64200, cogs: 44100, gp: 20100, wages: 9400, rent: 4500, other_opex: 3700, ebitda: 2500, net: 2100, gp_pct: 31.3, net_pct: 3.1, ebitda_pct: 3.9 },
        { name: 'Issho Cafe', revenue: 39300, cogs: 28700, gp: 10600, wages: 5500, rent: 2500, other_opex: 2500, ebitda: 100, net: 1170, gp_pct: 27.0, net_pct: 3.0, ebitda_pct: 0.3 },
      ],
      totals: { revenue: 211000, cogs: 142700, gp: 68300, wages: 30100, rent: 12000, other_opex: 15600, ebitda: 10600, net: 9470 },
    };
  }

  function _mockProfitFlow() {
    return {
      revenue: 211000, total_costs: 201530, net: 9470,
      waterfall: [
        { label: 'Revenue', color: 'var(--g)', amount: 211000, display: '$211,000', is_subtotal: false },
        { label: 'Food & Beverage', color: 'var(--r)', amount: 105800, display: '($105,800)' },
        { label: 'Packaging', color: 'var(--r)', amount: 13600, display: '($13,600)' },
        { label: 'Other COGs', color: 'var(--r)', amount: 23300, display: '($23,300)' },
        { label: '= Gross Profit', color: 'var(--g)', amount: 68300, display: '$68,300 · 32.4%', is_subtotal: true },
        { label: 'Wages & Salaries', color: 'var(--o)', amount: 30100, display: '($30,100)' },
        { label: 'Rent', color: 'var(--o)', amount: 12000, display: '($12,000)' },
        { label: 'Other OpEx', color: 'var(--o)', amount: 15600, display: '($15,600)' },
        { label: '= EBITDA', color: 'var(--b)', amount: 10600, display: '$10,600 · 5.0%', is_subtotal: true },
        { label: 'Depreciation + Interest', color: 'var(--t3)', amount: 1130, display: '($1,130)' },
        { label: '= Net Profit', color: 'var(--acc)', amount: 9470, display: '$9,470 · 4.5%', is_subtotal: true },
      ],
      cost_drivers: ['Food & Beverage (50.1% of revenue)', 'Wages (14.3%)', 'Rent (5.7%)', 'Platform commissions (2.6%)'],
    };
  }

  function _mockPnlFull() {
    return {
      columns: ['Jan 2026', 'Feb 2026', 'Mar 2026', 'YTD Total'],
      groups: [
        { label: 'Revenue', is_negative: false, items: [
          { label: 'In-store Cash', values: [58200, 62100, 64800, 185100] },
          { label: 'Card (Eftpos)', values: [95400, 98300, 102500, 296200] },
          { label: 'UberEats', values: [22800, 24500, 26200, 73500] },
          { label: 'Easi', values: [8900, 9600, 10100, 28600] },
          { label: 'Other channels', values: [6700, 7200, 7400, 21300] },
        ], totals: [192000, 201700, 211000, 604700], total_label: 'Total Revenue' },
        { label: 'Cost of Goods Sold', is_negative: true, items: [
          { label: 'Food & Beverage', values: [98500, 102200, 105800, 306500] },
          { label: 'Packaging', values: [12400, 13100, 13600, 39100] },
          { label: 'Ingredients', values: [18200, 19000, 19800, 57000] },
          { label: 'Other COGs', values: [3200, 3400, 3500, 10100] },
        ], totals: [132300, 137700, 142700, 412700], total_label: 'Total COGs',
        subtotal: { label: 'Gross Profit', values: [59700, 64000, 68300, 192000], pcts: ['31.1', '31.7', '32.4', '31.7'] } },
        { label: 'Operating Expenses', is_negative: true, items: [
          { label: 'Wages & Salaries', values: [28500, 29200, 30100, 87800] },
          { label: 'Rent & Occupancy', values: [12000, 12000, 12000, 36000] },
          { label: 'Utilities', values: [3800, 4100, 3900, 11800] },
          { label: 'Marketing', values: [2200, 2500, 2800, 7500] },
          { label: 'Platform commissions', values: [4700, 5100, 5400, 15200] },
          { label: 'Insurance', values: [1800, 1800, 1800, 5400] },
          { label: 'Other OpEx', values: [1500, 1600, 1700, 4800] },
        ], totals: [54500, 56300, 57700, 168500], total_label: 'Total Operating Expenses',
        subtotal: { label: 'EBITDA', values: [5200, 7700, 10600, 23500], pcts: ['2.7', '3.8', '5.0', '3.9'] } },
        { label: 'Below EBITDA', is_negative: true, items: [
          { label: 'Depreciation', values: [800, 800, 800, 2400] },
          { label: 'Interest', values: [350, 340, 330, 1020] },
        ], subtotal: { label: 'Net Profit', values: [4050, 6560, 9470, 20080], pcts: ['2.1', '3.3', '4.5', '3.3'] } },
      ],
    };
  }

  // ══════════════════════════════════════════
  // REGISTER ROUTES
  // ══════════════════════════════════════════
  App.registerRoutes({
    rp_pnl:       { render: renderPnlDashboard, onLoad: _loadPnlDashboard },
    rp_pnl_brand: { render: renderPnlBrand,     onLoad: _loadPnlBrand },
    rp_pnl_flow:  { render: renderPnlFlow,      onLoad: _loadPnlFlow },
    rp_pnl_full:  { render: renderPnlFull,       onLoad: _loadPnlFull },
  });

  // ══════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════
  window.ScrReports = {
    _onFilter,
    _onBrandFilter,
    _onFlowFilter,
    _loadPnlFull,
    _exportPdf,
    _exportCsv,
  };

})();
