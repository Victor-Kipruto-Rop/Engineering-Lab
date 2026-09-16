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
 * Pick the primary action for a card based on what artifacts the system
 * actually has (per its `features` flags), rather than always pointing at
 * the architecture page regardless of whether one exists for that system.
 * This is what keeps a card from linking to a diagram that isn't there.
 */
function primaryAction(sys, basePath) {
  if (sys.features.architecture) {
    return { href: `${basePath}architecture.html?system=${encodeURIComponent(sys.id)}`, label: 'Inspect architecture' };
  }
  if (sys.features.caseStudy) {
    return { href: `${basePath}case-studies.html`, label: 'Read case study' };
  }
  if (sys.features.data) {
    return { href: `${basePath}data.html`, label: 'Explore data' };
  }
  if (sys.features.code) {
    return { href: `${basePath}code.html`, label: 'View code' };
  }
  if (sys.features.api) {
    return { href: `${basePath}api-playground.html`, label: 'Try API' };
  }
  if (sys.features.monitor) {
    return { href: `${basePath}monitor.html`, label: 'View monitor' };
  }
  return null;
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
