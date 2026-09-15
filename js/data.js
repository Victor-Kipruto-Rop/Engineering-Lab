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

const PAGE_SIZE = 15;
let rows = [];
let sortKey = 'timestamp';
let sortDir = -1;
let page = 1;
let expandedId = null;

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
})();
