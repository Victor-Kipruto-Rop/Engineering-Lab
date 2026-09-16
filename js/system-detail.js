import { loadJSON, renderEmptyState, escapeHTML, formatNumber } from './app.js';
import { statusClass } from './components/system-card.js';
import { SNIPPETS } from './content/snippets.js';
import { ENDPOINTS } from './content/endpoints.js';
import { EXPERIMENTS } from './content/experiments-data.js';

const root = document.getElementById('detail-root');
const crumb = document.getElementById('crumb-name');

// Which code snippets and experiments genuinely belong to which system.
// Kept explicit rather than fuzzy-matched on category strings, since a
// wrong match here would be exactly the kind of overclaim this page exists
// to avoid.
const CODE_CATEGORY_MAP = {
  pesaguard: ['Fraud Detection', 'FinTech'],
  'streaming-fraud': ['Streaming'],
  'cloud-etl': ['ETL', 'Cloud']
};
const EXPERIMENT_SYSTEM_MAP = {
  pesaguard: EXPERIMENTS.map(e => e.id) // all 6 experiments are PesaGuard's
};

function notDocumented(label) {
  return `<div class="empty-state" style="text-align:left; padding:1rem 1.25rem;">${escapeHTML(label)} isn't documented for this system yet.</div>`;
}

function section(num, title, bodyHTML) {
  return `
    <div class="step">
      <span class="num">${num}</span>
      <div>
        <h3>${escapeHTML(title)}</h3>
        ${bodyHTML}
      </div>
    </div>
  `;
}

function render(sys) {
  document.getElementById('page-title').textContent = `${sys.name} | Engineering Lab`;
  document.getElementById('page-description').content = `${sys.tagline} Status: ${sys.status}.`;
  crumb.textContent = sys.name;

  const evidenceChips = (sys.evidence || []).map(e => `<span class="tag">${escapeHTML(e)}</span>`).join('');
  const techChips = sys.technologies.map(t => `<span class="tag">${escapeHTML(t)}</span>`).join('');

  const architectureBody = sys.features.architecture
    ? `<p>An interactive, node-by-node architecture diagram exists for this system.</p>
       <a class="btn primary" href="architecture.html?system=${encodeURIComponent(sys.id)}">Open interactive architecture →</a>`
    : notDocumented('An architecture diagram');

  const dataBody = sys.features.data
    ? `<p>This system's demo dataset is explorable, including its schema and computed data-quality metrics.</p>
       <a class="btn primary" href="data.html">Open data explorer →</a>`
    : notDocumented('An explorable dataset');

  const apiEndpoints = sys.features.api ? ENDPOINTS : [];
  const apiBody = sys.features.api
    ? `<div class="table-wrap"><table><thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead><tbody>
        ${apiEndpoints.map(e => `<tr><td><code>${escapeHTML(e.method)}</code></td><td><code>${escapeHTML(e.path)}</code></td><td>${escapeHTML(e.description)}</td></tr>`).join('')}
       </tbody></table></div>
       <a class="btn primary" style="margin-top:0.75rem;" href="api-playground.html">Try these in the API playground →</a>`
    : notDocumented('An API surface');

  const codeCategories = CODE_CATEGORY_MAP[sys.id] || [];
  const codeSnippets = SNIPPETS.filter(s => codeCategories.includes(s.category));
  const codeBody = sys.features.code && codeSnippets.length
    ? `<ul style="margin:0; padding-left:1.1rem;">
        ${codeSnippets.map(s => `<li style="margin-bottom:0.35rem;"><a href="code.html?snippet=${encodeURIComponent(s.id)}" style="color:var(--accent);">${escapeHTML(s.title)}</a> <span style="color:var(--text-2); font-size:var(--fs-00);">— ${escapeHTML(s.filename)}</span></li>`).join('')}
       </ul>`
    : notDocumented('Representative code');

  const expIds = EXPERIMENT_SYSTEM_MAP[sys.id] || [];
  const experiments = EXPERIMENTS.filter(e => expIds.includes(e.id));
  const experimentsBody = experiments.length
    ? `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Date</th></tr></thead><tbody>
        ${experiments.map(e => `<tr><td><code>${e.id}</code></td><td>${escapeHTML(e.title)}</td><td><span class="status-pill ${e.status === 'PASS' ? 'live' : 'experimental'}">${e.status}</span></td><td>${e.date}</td></tr>`).join('')}
       </tbody></table></div>
       <a class="btn primary" style="margin-top:0.75rem;" href="experiments.html">Open experiment log →</a>`
    : notDocumented('Experiment records');

  const caseStudyBody = sys.features.caseStudy
    ? `<p>A full case study covers the problem, architecture, decisions, bottlenecks, and measured results for this system.</p>
       <a class="btn primary" href="case-studies.html">Read the case study →</a>`
    : notDocumented('A written case study');

  const monitorBody = sys.features.monitor
    ? `<p>Demo telemetry and incident-simulation controls are available for this system.</p>
       <a class="btn primary" href="monitor.html">Open monitor →</a>`
    : notDocumented('A monitoring dashboard');

  root.innerHTML = `
    <div class="page-header">
      <span class="eyebrow">${escapeHTML(sys.category.toUpperCase())}</span>
      <h1>${escapeHTML(sys.name)}</h1>
      <p>${escapeHTML(sys.tagline)}</p>
      <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; margin-top:0.75rem;">
        <span class="status-pill ${statusClass(sys.status)}">${escapeHTML(sys.status)}</span>
        ${evidenceChips}
      </div>
    </div>

    <div class="sequence">
      ${section('01', 'Overview', `
        <p>${escapeHTML(sys.description)}</p>
        <div class="metric-grid" style="margin-top:0.75rem;">
          <div class="metric-cell"><span class="label">Throughput / result</span><span class="value">${escapeHTML(sys.metrics.throughput)}</span></div>
          <div class="metric-cell"><span class="label">Environment</span><span class="value">${escapeHTML(sys.metrics.environment)}</span></div>
        </div>
        <div class="tag-row" style="margin-top:0.75rem;">${techChips}</div>
      `)}
      ${section('02', 'Architecture', architectureBody)}
      ${section('03', 'Data', dataBody)}
      ${section('04', 'API', apiBody)}
      ${section('05', 'Code', codeBody)}
      ${section('06', 'Experiments', experimentsBody)}
      ${section('07', 'Observability', monitorBody)}
      ${section('08', 'Case study', caseStudyBody)}
      ${section('09', 'Source', `<a class="btn" href="${sys.github}" target="_blank" rel="noopener">GitHub profile</a>
        <p style="color:var(--text-2); font-size:var(--fs-00); margin-top:0.5rem;">This links to the GitHub profile, not a specific repository — per-repo links aren't wired up yet.</p>`)}
    </div>
  `;
}

(async () => {
  const params = new URLSearchParams(location.search);
  const id = params.get('system');
  const result = await loadJSON('../data/systems.json');
  if (!result.ok) {
    renderEmptyState(root, `Unable to load system registry (${result.error}).`);
    return;
  }
  const sys = result.data.systems.find(s => s.id === id);
  if (!sys) {
    crumb.textContent = 'Not found';
    renderEmptyState(root, id
      ? `No system with id "${id}" in the registry.`
      : `No system specified. Open a system from the registry instead.`);
    const link = document.createElement('div');
    link.style.marginTop = '1rem';
    link.innerHTML = `<a class="btn primary" href="systems.html">← Back to registry</a>`;
    root.appendChild(link);
    return;
  }
  render(sys);
})();
