import { escapeHTML } from './app.js';
import { EXPERIMENTS } from './content/experiments-data.js';

// Every experiment has: id, title, date, status (PASS | FAIL), hypothesis,
// environment, configuration, method, conclusion.
// PASS experiments additionally have: results, observations.
// FAIL experiments additionally have: expected, actual, rootCause, fix,
// retestResult, retestStatus (PASS | MITIGATED) — because "fixed" and
// "the risk is now bounded but not eliminated" are different, honest outcomes.
const tabs = document.getElementById('exp-tabs');
const detail = document.getElementById('exp-detail');
let current = EXPERIMENTS[0];

function statusPill(status) {
  const cls = status === 'PASS' ? 'live' : 'experimental';
  return `<span class="status-pill ${cls}">${status}</span>`;
}

function renderTabs() {
  tabs.innerHTML = EXPERIMENTS.map(e => `
    <button data-id="${e.id}" class="${current.id === e.id ? 'active' : ''}">${e.id} \u00b7 ${escapeHTML(e.title)}</button>
  `).join('');
  tabs.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      current = EXPERIMENTS.find(e => e.id === btn.dataset.id);
      renderTabs();
      renderDetail();
    });
  });
}

function row(label, val) {
  if (!val) return '';
  return `<dt style="font-family:var(--font-mono); font-size:var(--fs-00); color:var(--text-2); margin-top:1rem;">${label}</dt><dd style="margin:0.25rem 0 0; max-width:70ch;">${escapeHTML(val)}</dd>`;
}

function renderDetail() {
  const e = current;
  const isFail = e.status === 'FAIL';

  const rows = [
    row('Hypothesis', e.hypothesis),
    row('Environment', e.environment),
    row('Configuration', e.configuration),
    row('Method', e.method),
    isFail ? row('Expected', e.expected) : '',
    isFail ? row('Actual', e.actual) : '',
    isFail ? row('Root cause', e.rootCause) : '',
    isFail ? row('Fix', e.fix) : '',
    isFail ? row('Retest result', e.retestResult) : '',
    !isFail ? row('Results', e.results) : '',
    !isFail ? row('Observations', e.observations) : '',
    row('Conclusion', e.conclusion)
  ].join('');

  detail.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap; margin-bottom:0.25rem;">
      <h2 style="margin:0;">${escapeHTML(e.title)}</h2>
      ${statusPill(e.status)}
      ${e.retestStatus ? `<span class="status-pill ${e.retestStatus === 'PASS' ? 'live' : 'demo'}">RETEST: ${e.retestStatus}</span>` : ''}
    </div>
    <p style="font-family:var(--font-mono); font-size:var(--fs-00); color:var(--text-2); margin:0;">${e.id} \u00b7 ${e.date}</p>
    <dl>${rows}</dl>
  `;
}

renderTabs();
renderDetail();
