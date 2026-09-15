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

export function initShell(activeHref) {
  const inPages = location.pathname.includes('/pages/');
  const rail = document.querySelector('.rail');
  if (!rail) return;

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Primary');
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

  const existingNav = rail.querySelector('nav');
  if (existingNav) existingNav.replaceWith(nav);
  else rail.appendChild(nav);

  // Mobile rail toggle
  const toggle = document.querySelector('.rail-toggle');
  const scrim = document.querySelector('.rail-scrim');
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
