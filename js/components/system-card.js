// components/system-card.js — single source of truth for rendering a system
// card. Previously duplicated (near-identically) in index.html's inline
// script and pages/systems.html's inline script.

import { escapeHTML } from '../app.js';

const FEATURES = [
  ['architecture', 'Architecture'],
  ['monitor', 'Monitor'],
  ['data', 'Data'],
  ['api', 'API'],
  ['code', 'Code'],
  ['caseStudy', 'Case study']
];

export function statusClass(status) {
  return status.toLowerCase();
}

/**
 * Every card's primary action now goes to the system detail page, which
 * itself links out to whichever artifacts (architecture, data, API, code,
 * experiments, case study) actually exist for that system. This replaced an
 * earlier per-feature branch that pointed cards at different pages
 * depending on what was available — that meant a card without an
 * architecture diagram silently linked into the systems registry instead,
 * which was inconsistent and easy to misread as "nothing is available here".
 */
function primaryAction(sys, basePath) {
  return { href: `${basePath}system.html?system=${encodeURIComponent(sys.id)}`, label: 'View details' };
}

/**
 * @param {object} sys - a system record from data/systems.json
 * @param {string} basePath - '' when called from a page already inside
 *   /pages/, or 'pages/' when called from index.html at the repo root.
 */
export function systemCard(sys, basePath = '') {
  const action = primaryAction(sys, basePath);
  return `
    <article class="card">
      <div class="card-head">
        <div>
          <h3>${escapeHTML(sys.name)}</h3>
          <span class="category">${escapeHTML(sys.category)}</span>
        </div>
        <span class="status-pill ${statusClass(sys.status)}">${escapeHTML(sys.status)}</span>
      </div>
      <p>${escapeHTML(sys.description)}</p>
      <div class="tag-row">
        ${sys.technologies.map(t => `<span class="tag">${escapeHTML(t)}</span>`).join('')}
      </div>
      <div class="feature-row">
        ${FEATURES.map(([key, label]) => `<span class="${sys.features[key] ? 'on' : ''}">${sys.features[key] ? '●' : '○'} ${label}</span>`).join('')}
      </div>
      <div class="card-actions">
        ${action ? `<a class="btn primary" href="${action.href}">${action.label}</a>` : ''}
        <a class="btn" href="${sys.github}" target="_blank" rel="noopener">GitHub profile</a>
      </div>
    </article>
  `;
}
