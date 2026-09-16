import { loadJSON, renderEmptyState, escapeHTML, debounce, formatNumber } from './app.js';

const qInput = document.getElementById('q');
const typeSelect = document.getElementById('f-type');
const statusSelect = document.getElementById('f-status');
const tbody = document.getElementById('data-tbody');
const countEl = document.getElementById('result-count');
const summaryStats = document.getElementById('summary-stats');
const pageInfo = document.getElementById('page-info');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const viewTabs = document.getElementById('view-tabs');
const panels = {
  table: document.getElementById('panel-table'),
  schema: document.getElementById('panel-schema'),
  quality: document.getElementById('panel-quality'),
  lineage: document.getElementById('panel-lineage')
};

const PAGE_SIZE = 15;
let rows = [];
let sortKey = 'timestamp';
let sortDir = -1;
let page = 1;
let expandedId = null;

// This describes the fields actually present in transactions.json — kept in
// sync by hand since there's no schema registry behind this static site.
const SCHEMA = [
  { column: 'id', type: 'string', nullable: 'No', example: 'DEMO-00001', constraints: 'Unique per row; DEMO-##### format' },
  { column: 'timestamp', type: 'string (ISO 8601)', nullable: 'No', example: '2026-09-10T08:00:00Z', constraints: 'UTC' },
  { column: 'type', type: 'string (enum)', nullable: 'No', example: 'PAYMENT', constraints: 'PAYMENT · WITHDRAWAL · DEPOSIT · TRANSFER · REVERSAL' },
  { column: 'amount', type: 'number', nullable: 'No', example: '674.02', constraints: '> 0' },
  { column: 'currency', type: 'string', nullable: 'No', example: 'KES', constraints: 'Fixed to KES in this demo' },
  { column: 'status', type: 'string (enum)', nullable: 'No', example: 'SETTLED', constraints: 'SETTLED · PENDING · FLAGGED · FAILED' },
  { column: 'anomalyScore', type: 'number', nullable: 'No', example: '0.223', constraints: '0.0 – 1.0' },
  { column: 'channel', type: 'string (enum)', nullable: 'No', example: 'USSD', constraints: 'USSD · APP · API · AGENT' }
];

const LINEAGE_STEPS = [
  { name: 'transactions', desc: 'Raw M-Pesa/Daraja webhook events, keyed by transaction ID (this dataset).' },
  { name: 'validation', desc: 'Schema and idempotency checks (EXP-003); malformed payloads route to a DLQ instead.' },
  { name: 'reconciliation', desc: 'Set-difference match against ledger state (EXP-005); produces matched/unmatched rows.' },
  { name: 'fraud_features', desc: 'Amount and 1-hour velocity are derived per transaction.' },
  { name: 'fraud_scores', desc: 'The rule-based scorer (see Code page) combines features into anomalyScore.' },
  { name: 'alerts', desc: 'Transactions crossing the risk threshold are flagged for review — status: FLAGGED above.' }
];

function populate(select, values) {
  values.sort().forEach(v => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    select.appendChild(opt);
  });
}

function filteredSorted() {
  const q = qInput.value.trim().toLowerCase();
  const type = typeSelect.value;
  const status = statusSelect.value;

  let result = rows.filter(r => {
    if (type && r.type !== type) return false;
    if (status && r.status !== status) return false;
    if (q && !r.id.toLowerCase().includes(q)) return false;
    return true;
  });

  result.sort((a, b) => {
    if (a[sortKey] < b[sortKey]) return -1 * sortDir;
    if (a[sortKey] > b[sortKey]) return 1 * sortDir;
    return 0;
  });

  return result;
}

function renderSummary(data) {
  const total = data.length;
  const flagged = data.filter(r => r.status === 'FLAGGED').length;
  const avgAmount = data.reduce((s, r) => s + r.amount, 0) / total;
  const avgAnomaly = data.reduce((s, r) => s + r.anomalyScore, 0) / total;
  summaryStats.innerHTML = `
    <div class="cell"><div class="label">Total transactions</div><div class="value">${formatNumber(total)}</div></div>
    <div class="cell"><div class="label">Flagged</div><div class="value">${flagged}</div></div>
    <div class="cell"><div class="label">Avg amount</div><div class="value">${avgAmount.toFixed(0)}</div></div>
    <div class="cell"><div class="label">Avg anomaly score</div><div class="value">${avgAnomaly.toFixed(2)}</div></div>
  `;
}

function renderSchema() {
  document.getElementById('schema-tbody').innerHTML = SCHEMA.map(f => `
    <tr>
      <td><code>${escapeHTML(f.column)}</code></td>
      <td>${escapeHTML(f.type)}</td>
      <td>${escapeHTML(f.nullable)}</td>
      <td><code>${escapeHTML(f.example)}</code></td>
      <td>${escapeHTML(f.constraints)}</td>
    </tr>
  `).join('');
}

const VALID = {
  type: ['PAYMENT', 'WITHDRAWAL', 'DEPOSIT', 'TRANSFER', 'REVERSAL'],
  status: ['SETTLED', 'PENDING', 'FLAGGED', 'FAILED'],
  channel: ['USSD', 'APP', 'API', 'AGENT']
};

function computeQuality(data) {
  const fields = SCHEMA.map(f => f.column);
  let nullCells = 0;
  const totalCells = data.length * fields.length;
  const seenIds = new Map();
  const invalid = [];

  data.forEach(r => {
    fields.forEach(f => {
      const v = r[f];
      if (v === null || v === undefined || v === '') nullCells += 1;
    });
    seenIds.set(r.id, (seenIds.get(r.id) || 0) + 1);

    const reasons = [];
    if (typeof r.amount !== 'number' || !(r.amount > 0)) reasons.push('amount not > 0');
    if (r.currency !== 'KES') reasons.push('currency ≠ KES');
    if (!VALID.type.includes(r.type)) reasons.push('unrecognized type');
    if (!VALID.status.includes(r.status)) reasons.push('unrecognized status');
    if (!VALID.channel.includes(r.channel)) reasons.push('unrecognized channel');
    if (typeof r.anomalyScore !== 'number' || r.anomalyScore < 0 || r.anomalyScore > 1) reasons.push('anomalyScore out of [0,1]');
    if (reasons.length) invalid.push({ id: r.id, reasons });
  });

  const duplicateIds = [...seenIds.entries()].filter(([, count]) => count > 1);
  const timestamps = data.map(r => new Date(r.timestamp).getTime()).filter(n => !Number.isNaN(n));
  const mostRecent = timestamps.length ? new Date(Math.max(...timestamps)) : null;

  return {
    rows: data.length,
    columns: fields.length,
    nullRatePct: totalCells ? (nullCells / totalCells) * 100 : 0,
    duplicateRatePct: data.length ? (duplicateIds.length / data.length) * 100 : 0,
    duplicateIds,
    invalidCount: invalid.length,
    invalidSamples: invalid.slice(0, 3),
    completenessPct: totalCells ? ((totalCells - nullCells) / totalCells) * 100 : 0,
    mostRecent
  };
}

function renderQuality(data) {
  const q = computeQuality(data);
  document.getElementById('quality-stats').innerHTML = `
    <div class="cell"><div class="label">Rows</div><div class="value">${formatNumber(q.rows)}</div></div>
    <div class="cell"><div class="label">Columns</div><div class="value">${q.columns}</div></div>
    <div class="cell"><div class="label">Completeness</div><div class="value">${q.completenessPct.toFixed(1)}%</div></div>
    <div class="cell"><div class="label">Null rate</div><div class="value">${q.nullRatePct.toFixed(1)}%</div></div>
    <div class="cell"><div class="label">Duplicate rate</div><div class="value">${q.duplicateRatePct.toFixed(1)}%</div></div>
    <div class="cell"><div class="label">Invalid records</div><div class="value">${q.invalidCount}</div></div>
  `;

  const notes = [];
  notes.push(`<p style="margin:0 0 0.5rem;"><strong style="color:var(--text);">Freshness</strong> — most recent record: ${q.mostRecent ? q.mostRecent.toLocaleString() : 'n/a'}. This is a fixed demo snapshot generated once, not a live feed, so this timestamp will not advance.</p>`);
  if (q.duplicateIds.length) {
    notes.push(`<p style="margin:0 0 0.5rem; color:var(--warning);">${q.duplicateIds.length} transaction ID(s) appear more than once: ${q.duplicateIds.slice(0, 5).map(([id]) => escapeHTML(id)).join(', ')}.</p>`);
  } else {
    notes.push(`<p style="margin:0 0 0.5rem; color:var(--accent);">No duplicate transaction IDs found.</p>`);
  }
  if (q.invalidCount) {
    notes.push(`<p style="margin:0; color:var(--warning);">${q.invalidCount} record(s) fail basic validation, e.g. ${q.invalidSamples.map(s => `${escapeHTML(s.id)} (${s.reasons.join(', ')})`).join('; ')}.</p>`);
  } else {
    notes.push(`<p style="margin:0; color:var(--accent);">All ${q.rows} rows pass basic type/range/enum validation.</p>`);
  }
  document.getElementById('quality-notes').innerHTML = `<div class="callout">${notes.join('')}</div>`;
}

function renderLineage() {
  document.getElementById('lineage-diagram').innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0;">
      ${LINEAGE_STEPS.map((s, i) => `
        <div style="display:flex; gap:0.85rem; align-items:flex-start;">
          <div style="display:flex; flex-direction:column; align-items:center;">
            <span style="width:10px; height:10px; border-radius:50%; background:var(--accent); flex-shrink:0;"></span>
            ${i < LINEAGE_STEPS.length - 1 ? '<span style="width:2px; flex:1; background:var(--border); min-height:2.25rem;"></span>' : ''}
          </div>
          <div style="padding-bottom:1.25rem;">
            <div style="font-family:var(--font-mono); color:var(--text);">${escapeHTML(s.name)}</div>
            <div style="color:var(--text-2); font-size:var(--fs-0);">${escapeHTML(s.desc)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function switchView(view) {
  Object.entries(panels).forEach(([key, el]) => { el.hidden = key !== view; });
  viewTabs.querySelectorAll('button').forEach(btn => {
    const active = btn.dataset.view === view;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
}

viewTabs.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function render() {
  const result = filteredSorted();
  countEl.textContent = `${result.length} of ${rows.length} transactions`;

  if (!result.length) {
    renderEmptyState(tbody.closest('.table-wrap'), 'No transactions match these filters.');
    pageInfo.textContent = '';
    prevBtn.disabled = true; nextBtn.disabled = true;
    return;
  }

  const totalPages = Math.max(1, Math.ceil(result.length / PAGE_SIZE));
  page = Math.min(page, totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = result.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = pageRows.map(r => `
    <tr data-id="${r.id}" tabindex="0">
      <td data-label="ID">${r.id}</td>
      <td data-label="Timestamp">${new Date(r.timestamp).toLocaleString()}</td>
      <td data-label="Type">${r.type}</td>
      <td data-label="Amount">${r.amount.toLocaleString()}</td>
      <td data-label="Status"><span class="status-flag ${r.status.toLowerCase()}">${r.status}</span></td>
      <td data-label="Anomaly">${r.anomalyScore.toFixed(3)}</td>
      <td data-label="Channel">${r.channel}</td>
    </tr>
    ${expandedId === r.id ? `<tr><td colspan="7" class="row-detail">
      Full record — id: ${r.id} · timestamp: ${r.timestamp} · type: ${r.type} · amount: ${r.amount} KES ·
      status: ${r.status} · anomaly score: ${r.anomalyScore} · channel: ${r.channel}
    </td></tr>` : ''}
  `).join('');

  pageInfo.textContent = `Page ${page} of ${totalPages}`;
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;

  tbody.querySelectorAll('tr[data-id]').forEach(tr => {
    const open = () => {
      expandedId = expandedId === tr.dataset.id ? null : tr.dataset.id;
      render();
    };
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
  });
}

document.querySelectorAll('#data-table thead th').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.key;
    if (sortKey === key) sortDir *= -1;
    else { sortKey = key; sortDir = 1; }
    render();
  });
});

prevBtn.addEventListener('click', () => { page -= 1; render(); });
nextBtn.addEventListener('click', () => { page += 1; render(); });
[qInput].forEach(el => el.addEventListener('input', debounce(() => { page = 1; render(); }, 150)));
[typeSelect, statusSelect].forEach(el => el.addEventListener('change', () => { page = 1; render(); }));

(async () => {
  const result = await loadJSON('../data/transactions.json');
  if (!result.ok) {
    renderEmptyState(document.querySelector('main'), `Dataset unavailable (${result.error}).`);
    return;
  }
  rows = result.data.transactions;
  populate(typeSelect, [...new Set(rows.map(r => r.type))]);
  populate(statusSelect, [...new Set(rows.map(r => r.status))]);
  renderSummary(rows);
  render();
  renderSchema();
  renderQuality(rows);
  renderLineage();
})();
