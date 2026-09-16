// app.js — shared shell behavior for every page

export const NAV_ITEMS = [
  { href: 'index.html', label: 'Home', root: true },
  { href: 'pages/systems.html', label: 'Systems' },
  { href: 'pages/architecture.html', label: 'Architecture' },
  { href: 'pages/monitor.html', label: 'Monitor' },
  { href: 'pages/data.html', label: 'Data' },
  { href: 'pages/api-playground.html', label: 'API Playground' },
  { href: 'pages/code.html', label: 'Code' },
  { href: 'pages/case-studies.html', label: 'Case Studies' },
  { href: 'pages/experiments.html', label: 'Experiments' }
];

/**
 * Resolve a nav href relative to the current page's depth.
 */
function resolveHref(href, inPages) {
  if (!inPages) return href;
  if (href === 'index.html') return '../index.html';
  return href.replace('pages/', '');
}

/**
 * The rail brand block and footer link are identical on every page.
 * Defined once here so a future change to either is a one-file edit,
 * not a nine-file find-and-replace.
 */
function buildBrand() {
  const div = document.createElement('div');
  div.className = 'rail-brand';
  div.innerHTML = `
    <span class="mark" aria-hidden="true">VK</span>
    <span class="name">Engineering Lab</span>
    <span class="role">Victor Kipruto Rop</span>
  `;
  return div;
}

function buildFooter() {
  const div = document.createElement('div');
  div.className = 'rail-footer';
  div.innerHTML = `<a href="https://www.victorkipruto.com">&larr; Back to Victor Kipruto</a>`;
  return div;
}

export function initShell(activeHref) {
  const inPages = location.pathname.includes('/pages/');
  const rail = document.getElementById('rail') || document.querySelector('.rail');
  if (!rail) return;

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Primary');
  nav.id = 'primary-rail';
  NAV_ITEMS.forEach(item => {
    const a = document.createElement('a');
    a.href = resolveHref(item.href, inPages);
    a.innerHTML = `<span class="dot" aria-hidden="true"></span>${item.label}`;
    if (item.href === activeHref) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
    nav.appendChild(a);
  });

  rail.innerHTML = '';
  rail.append(buildBrand(), nav, buildFooter());

  // Mobile rail toggle — the toggle button itself is built here too, so
  // every page only needs an empty `#rail-toggle` container.
  const toggleContainer = document.getElementById('rail-toggle');
  const scrim = document.querySelector('.rail-scrim');
  if (toggleContainer) {
    toggleContainer.innerHTML = `
      <button type="button" aria-expanded="false" aria-controls="primary-rail" class="btn" style="padding:0.3rem 0.6rem;">☰</button>
      ENGINEERING LAB
    `;
    const toggle = toggleContainer.querySelector('button');
    if (toggle && scrim) {
      toggle.addEventListener('click', () => {
        rail.classList.toggle('open');
        scrim.classList.toggle('open');
        toggle.setAttribute('aria-expanded', rail.classList.contains('open'));
      });
      scrim.addEventListener('click', () => {
        rail.classList.remove('open');
        scrim.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
      nav.addEventListener('click', (e) => {
        if (e.target.closest('a')) {
          rail.classList.remove('open');
          scrim.classList.remove('open');
        }
      });
    }
  }
}

/**
 * Fetch JSON with a consistent error contract.
 * Returns { ok, data, error }.
 */
export async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ok: true, data, error: null };
  } catch (err) {
    return { ok: false, data: null, error: err.message || 'Request failed' };
  }
}

export function renderEmptyState(container, message) {
  container.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.textContent = message;
  container.appendChild(div);
}

export function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export function formatNumber(n) {
  return new Intl.NumberFormat('en-US').format(n);
}

document.addEventListener('DOMContentLoaded', () => {
  const active = document.body.dataset.nav || '';
  initShell(active);
});
