import { loadJSON, renderEmptyState, escapeHTML } from './app.js';

const stage = document.getElementById('arch-stage');
const legendEl = document.getElementById('arch-legend');
const systemSelect = document.getElementById('system-select');
const titleEl = document.getElementById('arch-title');
const dialog = document.getElementById('node-dialog');
const dialogTitle = document.getElementById('dialog-title');
const dialogBody = document.getElementById('dialog-body');
const dialogClose = document.getElementById('dialog-close');
const metaCallout = document.getElementById('arch-meta-callout');

const DEFAULT_META_TEXT = 'Select a component to view details here, or use the panel that opens on click for the full breakdown.';

const NODE_W = 160;
const NODE_H = 46;

let viewBox = { x: 0, y: 0, w: 800, h: 700 };
let dragging = false;
let dragStart = null;
let selectedNode = null;
let flowOn = false;
let currentSystem = null;
let archData = null;

function typeColor(type) {
  return {
    ingress: 'var(--info)',
    compute: 'var(--accent)',
    storage: 'var(--warning)',
    output: 'var(--error)'
  }[type] || 'var(--text-2)';
}

function buildSVG(system) {
  const nodesById = Object.fromEntries(system.nodes.map(n => [n.id, n]));
  const edgeLines = system.edges.map(([from, to]) => {
    const a = nodesById[from], b = nodesById[to];
    if (!a || !b) return '';
    const x1 = a.x, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y - NODE_H / 2;
    const midY = (y1 + y2) / 2;
    return `<path class="arch-edge" data-from="${from}" data-to="${to}"
      d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" marker-end="url(#arrow)"></path>`;
  }).join('');

  const nodeGroups = system.nodes.map(n => `
    <g class="arch-node" tabindex="0" role="button"
       aria-label="${escapeHTML(n.label)}, ${escapeHTML(n.type)} component"
       data-id="${n.id}"
       transform="translate(${n.x - NODE_W / 2}, ${n.y - NODE_H / 2})">
      <rect width="${NODE_W}" height="${NODE_H}" rx="3"></rect>
      <rect class="type-chip" x="0" y="0" width="4" height="${NODE_H}" fill="${typeColor(n.type)}"></rect>
      <text x="${NODE_W / 2}" y="${NODE_H / 2 + 4}" text-anchor="middle">${escapeHTML(n.label)}</text>
    </g>
  `).join('');

  const maxX = Math.max(...system.nodes.map(n => n.x)) + 140;
  const maxY = Math.max(...system.nodes.map(n => n.y)) + 100;
  viewBox = { x: 0, y: 0, w: maxX, h: maxY };

  return `
    <svg viewBox="0 0 ${maxX} ${maxY}" xmlns="http://www.w3.org/2000/svg" id="arch-svg">
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="var(--border)"></path>
        </marker>
      </defs>
      <g id="edge-layer">${edgeLines}</g>
      <g id="node-layer">${nodeGroups}</g>
    </svg>
  `;
}

function renderLegend(legend) {
  legendEl.innerHTML = legend.map(item => `
    <span class="item"><span class="swatch" style="background:${item.color}"></span>${escapeHTML(item.label)}</span>
  `).join('');
}

function applyViewBox() {
  const svg = document.getElementById('arch-svg');
  if (svg) svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
}

function zoom(factor) {
  const cx = viewBox.x + viewBox.w / 2;
  const cy = viewBox.y + viewBox.h / 2;
  viewBox.w = Math.max(300, Math.min(2400, viewBox.w * factor));
  viewBox.h = Math.max(260, Math.min(2100, viewBox.h * factor));
  viewBox.x = cx - viewBox.w / 2;
  viewBox.y = cy - viewBox.h / 2;
  applyViewBox();
}

function resetView(system) {
  const maxX = Math.max(...system.nodes.map(n => n.x)) + 140;
  const maxY = Math.max(...system.nodes.map(n => n.y)) + 100;
  viewBox = { x: 0, y: 0, w: maxX, h: maxY };
  applyViewBox();
}

function openDialog(node) {
  dialogTitle.textContent = node.label;
  dialogBody.innerHTML = `
    <dl>
      <dt>Purpose</dt><dd>${escapeHTML(node.purpose)}</dd>
      <dt>Technology</dt><dd>${escapeHTML(node.technology)}</dd>
      <dt>Inputs</dt><dd>${escapeHTML(node.inputs)}</dd>
      <dt>Outputs</dt><dd>${escapeHTML(node.outputs)}</dd>
      <dt>Failure handling</dt><dd>${escapeHTML(node.failureHandling)}</dd>
      <dt>Security considerations</dt><dd>${escapeHTML(node.security)}</dd>
    </dl>
  `;
  dialog.showModal();
}

function wireNodeInteractions(system) {
  const nodesById = Object.fromEntries(system.nodes.map(n => [n.id, n]));
  document.querySelectorAll('.arch-node').forEach(g => {
    const select = () => {
      document.querySelectorAll('.arch-node.selected').forEach(el => el.classList.remove('selected'));
      g.classList.add('selected');
      selectedNode = g.dataset.id;
      openDialog(nodesById[g.dataset.id]);
    };
    g.addEventListener('click', select);
    g.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
    });
  });
}

function wirePanZoom() {
  stage.addEventListener('pointerdown', e => {
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY, vb: { ...viewBox } };
  });
  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    const svg = document.getElementById('arch-svg');
    if (!svg) return;
    const rect = stage.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = viewBox.h / rect.height;
    const dx = (e.clientX - dragStart.x) * scaleX;
    const dy = (e.clientY - dragStart.y) * scaleY;
    viewBox.x = dragStart.vb.x - dx;
    viewBox.y = dragStart.vb.y - dy;
    applyViewBox();
  });
  window.addEventListener('pointerup', () => { dragging = false; });

  stage.addEventListener('wheel', e => {
    e.preventDefault();
    zoom(e.deltaY > 0 ? 1.1 : 0.9);
  }, { passive: false });
}

function toggleFlow(on) {
  flowOn = on;
  document.querySelectorAll('.arch-edge').forEach(el => el.classList.toggle('flow', on));
  document.getElementById('toggle-flow').setAttribute('aria-pressed', String(on));
  document.getElementById('toggle-flow').textContent = on ? '❚❚' : '▶';
}

function renderSystem(id) {
  currentSystem = id;
  const system = archData.systems[id];
  if (!system) {
    renderEmptyState(stage, 'Unable to load this architecture.');
    return;
  }
  titleEl.textContent = `${system.name} — architecture`;
  stage.innerHTML = buildSVG(system);
  renderLegend(system.legend);
  wireNodeInteractions(system);
  toggleFlow(flowOn);
}

(async () => {
  const result = await loadJSON('../data/architecture.json');
  if (!result.ok) {
    renderEmptyState(stage, `Unable to load architecture (${result.error}).`);
    return;
  }
  archData = result.data;
  const ids = Object.keys(archData.systems);
  systemSelect.innerHTML = ids.map(id => `<option value="${id}">${escapeHTML(archData.systems[id].name)}</option>`).join('');

  const params = new URLSearchParams(location.search);
  const requested = params.get('system');
  const requestedIsAvailable = requested && ids.includes(requested);
  const initial = requestedIsAvailable ? requested : ids[0];
  systemSelect.value = initial;
  renderSystem(initial);

  // Don't silently substitute a different system's diagram when the one
  // requested via ?system= isn't documented — say so instead.
  if (requested && !requestedIsAvailable && metaCallout) {
    metaCallout.textContent = `Architecture for "${requested}" isn't documented yet. Showing ${archData.systems[initial].name}, the only system with a published diagram so far.`;
  }

  systemSelect.addEventListener('change', () => {
    if (metaCallout) metaCallout.textContent = DEFAULT_META_TEXT;
    renderSystem(systemSelect.value);
  });

  document.getElementById('zoom-in').addEventListener('click', () => zoom(0.85));
  document.getElementById('zoom-out').addEventListener('click', () => zoom(1.18));
  document.getElementById('zoom-reset').addEventListener('click', () => resetView(archData.systems[currentSystem]));
  document.getElementById('toggle-flow').addEventListener('click', () => toggleFlow(!flowOn));

  wirePanZoom();
})();

dialogClose.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
