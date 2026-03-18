/** Version 1.0.1 | 15 MAR 2026 | Siam Palette Group */
/**
 * ═══════════════════════════════════════════
 * SPG Finance Module — scr_settings_fin.js
 * Settings screens: Alert Rules, Permissions, Audit Log
 * ═══════════════════════════════════════════
 */

(() => {
  const esc = App.esc;

  // ══════════════════════════════════════════
  // SHARED: Settings sub-nav tabs
  // ══════════════════════════════════════════
  function settingsTabs(active) {
    const tabs = [
      { id: 'st_alert', label: 'Alert Rules' },
      { id: 'st_perm', label: 'Permissions' },
      { id: 'st_audit', label: 'Audit Log' },
    ];
    return '<div style="display:flex;gap:0;border-bottom:1px solid var(--bd2);margin-bottom:12px">'
      + tabs.map(t =>
        `<div class="tab${t.id === active ? ' a' : ''}" onclick="App.go('${t.id}')" style="padding:8px 16px;cursor:pointer;font-size:var(--fs-sm);font-weight:${t.id === active ? '600' : '400'};color:${t.id === active ? 'var(--acc)' : 'var(--t3)'};border-bottom:2px solid ${t.id === active ? 'var(--acc)' : 'transparent'}">${esc(t.label)}</div>`
      ).join('')
      + '</div>';
  }

  // ══════════════════════════════════════════
  // S52. ALERT RULES
  // ══════════════════════════════════════════
  function renderAlertRules() {
    return {
      tb: '<div class="tb"><div class="tb-t">Settings</div></div>',
      ct: `
        <div style="max-width:900px;margin:0 auto">
          ${settingsTabs('st_alert')}
          <div style="background:var(--obg);border-radius:var(--rd);padding:6px 10px;font-size:var(--fs-xxs);color:var(--o);margin-bottom:10px">\u26a0\ufe0f Settings data is currently static. Dynamic configuration will be available in the next release.</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:var(--fs-xs);color:var(--t3)">Configure alert thresholds for CFO Brief</div>
            <button class="bs" onclick="ScrSettings._addAlert()">+ Add New</button>
          </div>
          <div class="card" style="padding:0;overflow:hidden">
            <table class="tbl" id="st_alert_tbl" style="margin:0">
              <thead><tr>
                ${App.sth('Rule Name','rule','st_alert_tbl')}${App.sth('Metric','metric','st_alert_tbl')}${App.sth('Threshold','threshold','st_alert_tbl')}
                ${App.sth('Severity','severity','st_alert_tbl')}${App.sth('Action','action','st_alert_tbl')}${App.sth('Status','status','st_alert_tbl')}
              </tr></thead>
              <tbody id="st_alert_body">
                <tr>
                  <td style="font-weight:500">COL Over Budget</td>
                  <td>COL % of Revenue</td>
                  <td>&gt;30%</td>
                  <td><span class="sts sts-r">Critical</span></td>
                  <td>Flag in CFO Brief</td>
                  <td><span class="sts sts-c">Active</span></td>
                </tr>
                <tr>
                  <td style="font-weight:500">Overdue AP</td>
                  <td>Days past due</td>
                  <td>&gt;7 days</td>
                  <td><span class="sts sts-p">Warning</span></td>
                  <td>Email + Dashboard</td>
                  <td><span class="sts sts-c">Active</span></td>
                </tr>
                <tr>
                  <td style="font-weight:500">Cash Low</td>
                  <td>Bank balance</td>
                  <td>&lt;$5,000</td>
                  <td><span class="sts sts-r">Critical</span></td>
                  <td>SMS + Email</td>
                  <td><span class="sts sts-c">Active</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>`,
    };
  }

  function _addAlert() {
    App.toast('Add Alert — coming soon');
  }

  // ══════════════════════════════════════════
  // S53. PERMISSIONS
  // ══════════════════════════════════════════
  function renderPermissions() {
    return {
      tb: '<div class="tb"><div class="tb-t">Settings</div></div>',
      ct: `
        <div style="max-width:900px;margin:0 auto">
          ${settingsTabs('st_perm')}
          <div style="background:var(--obg);border-radius:var(--rd);padding:6px 10px;font-size:var(--fs-xxs);color:var(--o);margin-bottom:10px">\u26a0\ufe0f Settings data is currently static. Dynamic configuration will be available in the next release.</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:var(--fs-xs);color:var(--t3)">Manage user access to Finance module</div>
            <button class="bs" onclick="ScrSettings._addUser()">+ Add User</button>
          </div>
          <div class="card" style="padding:0;overflow:hidden">
            <table class="tbl" id="st_perm_tbl" style="margin:0">
              <thead><tr>
                ${App.sth('User','user','st_perm_tbl')}${App.sth('Email','email','st_perm_tbl')}${App.sth('Role','role','st_perm_tbl')}
                ${App.sth('Access Level','access','st_perm_tbl')}${App.sth('Last Login','login','st_perm_tbl')}${App.sth('Status','status','st_perm_tbl')}
              </tr></thead>
              <tbody id="st_perm_body">
                <tr>
                  <td style="font-weight:600">Khun Or</td>
                  <td>or@siampalette.com</td>
                  <td>Admin</td>
                  <td>T1 — Full Access</td>
                  <td>12/03/2026</td>
                  <td><span class="sts sts-c">Active</span></td>
                </tr>
                <tr>
                  <td>Finance Staff</td>
                  <td>finance@siampalette.com</td>
                  <td>Finance Manager</td>
                  <td>T2 — All Brands Read/Write</td>
                  <td>11/03/2026</td>
                  <td><span class="sts sts-c">Active</span></td>
                </tr>
                <tr>
                  <td>Store Manager MC</td>
                  <td>mc@siampalette.com</td>
                  <td>Brand Manager</td>
                  <td>T3 — Mango Coco only</td>
                  <td>10/03/2026</td>
                  <td><span class="sts sts-c">Active</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>`,
    };
  }

  function _addUser() {
    App.toast('Add User — coming soon');
  }

  // ══════════════════════════════════════════
  // S54. AUDIT LOG
  // ══════════════════════════════════════════
  function renderAuditLog() {
    return {
      tb: '<div class="tb"><div class="tb-t">Settings</div></div>',
      ct: `
        <div style="max-width:1000px;margin:0 auto">
          ${settingsTabs('st_audit')}
          <div style="background:var(--obg);border-radius:var(--rd);padding:6px 10px;font-size:var(--fs-xxs);color:var(--o);margin-bottom:10px">\u26a0\ufe0f Settings data is currently static. Dynamic configuration will be available in the next release.</div>
          <div style="display:flex;gap:6px;margin-bottom:10px">
            <select class="fl" id="st_audit_user"><option value="">All Users</option></select>
            <select class="fl" id="st_audit_action">
              <option value="">All Actions</option>
              <option>Created bill</option>
              <option>Recorded payment</option>
              <option>Uploaded document</option>
              <option>Imported CSV</option>
              <option>Auto-match</option>
            </select>
            <input class="inp" id="st_audit_search" placeholder="Search..." style="flex:1;max-width:200px">
            <button class="btn bo" onclick="ScrSettings._exportAudit()">Export</button>
          </div>
          <div class="card" style="padding:0;overflow:hidden">
            <table class="tbl" id="st_audit_tbl" style="margin:0">
              <thead><tr>
                ${App.sth('Timestamp','time','st_audit_tbl')}${App.sth('User','user','st_audit_tbl')}${App.sth('Action','action','st_audit_tbl')}${App.sth('Details','details','st_audit_tbl')}
              </tr></thead>
              <tbody id="st_audit_body">
                <tr>
                  <td style="white-space:nowrap">12/03 14:23</td>
                  <td>Khun Or</td>
                  <td>Created bill</td>
                  <td>FIN-0051 Pro Bros $303.20</td>
                </tr>
                <tr>
                  <td style="white-space:nowrap">12/03 14:20</td>
                  <td>Khun Or</td>
                  <td>Uploaded document</td>
                  <td>INV1052323.pdf</td>
                </tr>
                <tr>
                  <td style="white-space:nowrap">11/03 16:45</td>
                  <td>System</td>
                  <td>Auto-match recurring</td>
                  <td>Pro Bros weekly → FIN-0049</td>
                </tr>
                <tr>
                  <td style="white-space:nowrap">11/03 14:00</td>
                  <td>Khun Or</td>
                  <td>Recorded payment</td>
                  <td>PAY-1284 Mind.RBuakl $582.82</td>
                </tr>
                <tr>
                  <td style="white-space:nowrap">11/03 13:30</td>
                  <td>Finance Staff</td>
                  <td>Imported CSV</td>
                  <td>45 transactions from invoices_mar.csv</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>`,
    };
  }

  function _exportAudit() {
    App.toast('Export Audit Log — coming soon');
  }

  // ══════════════════════════════════════════
  // REGISTER ROUTES
  // ══════════════════════════════════════════
  App.registerRoutes({
    st_alert: { render: renderAlertRules },
    st_perm:  { render: renderPermissions },
    st_audit: { render: renderAuditLog },
  });

  // ══════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════
  window.ScrSettings = {
    _addAlert,
    _addUser,
    _exportAudit,
  };

})();
