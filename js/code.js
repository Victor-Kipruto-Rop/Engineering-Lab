import { escapeHTML } from './app.js';
import { SNIPPETS } from './content/snippets.js';

const KEYWORDS = {
  Python: ['def', 'return', 'with', 'if', 'for', 'in', 'import', 'from', 'try', 'except', 'continue', 'class'],
  'Fraud Detection': ['def', 'return'],
  Streaming: ['def', 'return', 'if'],
  SQL: ['SELECT', 'FROM', 'LEFT JOIN', 'ON', 'WHERE', 'ORDER BY', 'AND', 'IS NULL', 'CREATE INDEX', 'CONCURRENTLY'],
  PostgreSQL: ['CREATE INDEX', 'CONCURRENTLY', 'ON', 'WHERE'],
  Kafka: ['for', 'in', 'try', 'except', 'continue', 'def'],
  Docker: []
};

function highlight(code, language) {
  let escaped = escapeHTML(code);
  escaped = escaped.replace(/(#.*$)/gm, '<span class="tok-com">$1</span>');
  escaped = escaped.replace(/(&quot;.*?&quot;|&#39;.*?&#39;)/g, '<span class="tok-str">$1</span>');
  escaped = escaped.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
  const kws = KEYWORDS[language] || [];
  kws.forEach(kw => {
    const re = new RegExp(`\\b${kw.replace(/\s/g, '\\s')}\\b`, 'g');
    escaped = escaped.replace(re, `<span class="tok-kw">${kw}</span>`);
  });
  return escaped.split('\n').map(line => `<span class="code-line">${line || ' '}</span>`).join('\n');
}

const langSelect = document.getElementById('f-lang');
const tabs = document.getElementById('snippet-tabs');
const detail = document.getElementById('snippet-detail');

let current = SNIPPETS[0];
const requestedSnippet = new URLSearchParams(location.search).get('snippet');
if (requestedSnippet) {
  const found = SNIPPETS.find(s => s.id === requestedSnippet);
  if (found) current = found;
}

function renderTabs(list) {
  tabs.innerHTML = list.map(s => `
    <button data-id="${s.id}" class="${current && current.id === s.id ? 'active' : ''}">${s.title}</button>
  `).join('');
  tabs.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      current = SNIPPETS.find(s => s.id === btn.dataset.id);
      renderTabs(list);
      renderDetail();
    });
  });
}

function renderDetail() {
  if (!current) {
    detail.innerHTML = '<div class="empty-state">No snippets match this filter.</div>';
    return;
  }
  detail.innerHTML = `
    <div class="code-block">
      <div class="code-head">
        <span>${current.filename} · ${current.language}</span>
        <button class="btn" id="copy-code" style="padding:0.2rem 0.55rem;">Copy</button>
      </div>
      <pre><code>${highlight(current.code, current.language)}</code></pre>
    </div>
    <div class="callout" style="margin-top:1rem;">
      <strong style="color:var(--text);">Purpose</strong> — ${current.purpose}
    </div>
    <p style="margin-top:1rem; font-size: var(--fs-0); color: var(--text-2);">${current.explanation}</p>
    <a class="btn" href="${current.github}" target="_blank" rel="noopener" style="margin-top:0.5rem;">GitHub profile</a>
  `;
  document.getElementById('copy-code').addEventListener('click', async (e) => {
    await navigator.clipboard.writeText(current.code);
    e.target.textContent = 'Copied';
    setTimeout(() => { e.target.textContent = 'Copy'; }, 1200);
  });
}

function applyFilter() {
  const lang = langSelect.value;
  const list = lang ? SNIPPETS.filter(s => s.language === lang) : SNIPPETS;
  if (!list.includes(current)) current = list[0];
  renderTabs(list);
  renderDetail();
}

[...new Set(SNIPPETS.map(s => s.language))].sort().forEach(l => {
  const opt = document.createElement('option');
  opt.value = l; opt.textContent = l;
  langSelect.appendChild(opt);
});
langSelect.addEventListener('change', applyFilter);

applyFilter();
