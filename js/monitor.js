import { loadJSON, renderEmptyState, escapeHTML, formatNumber } from './app.js';

const envBanner = document.getElementById('env-banner');
const serviceRow = document.getElementById('service-row');
const metricGrid = document.getElementById('metric-grid');
const rangeTabs = document.getElementById('range-tabs');
const rangeNote = document.getElementById('range-note');
const incidentButtons = document.getElementById('incident-buttons');
const incidentPanel = document.getElementById('incident-panel');

// The demo telemetry generator captured one synthetic hour at one-minute
// resolution (60 points, 06:00–06:59). 5m/15m/1h are real windows over that
// capture. 6h/24h are intentionally NOT filled with fabricated data — this
// demo doesn't have a longer capture, so we say that instead of pretending
// it does.
const RANGES = [
  { id: '5m', label: '5m', minutes: 5, available: true },
  { id: '15m', label: '15m', minutes: 15, available: true },
  { id: '1h', label: '1h', minutes: 60, available: true },
  { id: '6h', label: '6h', minutes: 360, available: false },
  { id: '24h', label: '24h', minutes: 1440, available: false }
];
let currentRange = RANGES[2]; // 1h default — the full capture

const INCIDENTS = [
  {
    id: 'kafka-down',
    label: 'Kafka unavailable',
    component: 'Kafka (event bus)',
    path: ['NORMAL', 'Kafka broker unreachable', 'Producers buffer or reject writes', 'Consumers stop receiving events', 'Event lag grows', 'Health check flips to DOWN', 'Broker restored', 'Consumers resume from last committed offset', 'Lag drains back to baseline'],
    impact: { streamProcessor: 'DOWN', errorRatePct: 9 },
    note: 'Because offsets are committed in batches rather than per-message (EXP-002), a short window of already-processed events can be redelivered on reconnect — that\u2019s absorbed by the idempotency guard from EXP-003, not by Kafka itself.'
  },
  {
    id: 'db-latency',
    label: 'Database latency spike',
    component: 'PostgreSQL (primary)',
    path: ['NORMAL', 'Query latency climbs', 'Connection pool holds connections longer', 'API P95 latency rises', 'Slow-query threshold breached', 'Latency returns to baseline once the slow query completes or is killed'],
    impact: { database: 'DEGRADED', p95LatencyMs: 900, dbConnections: 12 },
    note: 'No automatic failover exists for the primary yet \u2014 this is a documented limitation, not a self-healing path.'
  },
  {
    id: 'consumer-crash',
    label: 'Consumer crash',
    component: 'Fraud-scoring consumer',
    path: ['NORMAL', 'Consumer process exits unexpectedly', 'Partition ownership released', 'Kafka rebalances the consumer group', 'A healthy replica picks up the partition', 'Processing resumes from the last committed offset'],
    impact: { streamProcessor: 'DEGRADED', avgLatencyMs: 40 },
    note: 'This is the same rebalance path exercised in EXP-006 \u2014 a short window of re-scored duplicates is expected, and is bounded by the idempotency guard rather than eliminated by the rebalance itself.'
  },
  {
    id: 'api-timeout',
    label: 'API timeout',
    component: 'Ingestion API',
    path: ['NORMAL', 'Upstream (Daraja) response slows past the timeout', 'Request aborted client-side', 'Webhook sender retries', 'Retried request received', 'Idempotency guard treats it as a duplicate if the first attempt already committed'],
    impact: { api: 'DEGRADED', avgLatencyMs: 250, errorRatePct: 2 },
    note: 'Retry-safety here depends entirely on the idempotency guard (EXP-003) \u2014 without it, a timeout-then-retry pair would double-process the transaction.'
  },
  {
    id: 'duplicate-event',
    label: 'Duplicate event delivered',
    component: 'Webhook ingestion',
    path: ['NORMAL', 'The same webhook is delivered twice', 'First delivery is processed and committed', 'Second delivery arrives', 'Unique constraint on processed_events rejects the duplicate insert', 'No-op response returned; no ledger change'],
    impact: { errorRatePct: 0 },
    note: 'This is the exact mechanism validated in EXP-003 \u2014 a database constraint, not an application-level pre-check, is what makes this safe.'
  },
  {
    id: 'malformed-payload',
    label: 'Malformed payload',
    component: 'Payload validator',
    path: ['NORMAL', 'Webhook arrives missing a required field', 'Validation fails', 'Event tagged with the failure reason', 'Event routed to the dead-letter topic instead of blocking the stream', 'Available for manual review and replay'],
    impact: { dlqMessages: 1, errorRatePct: 0.5 },
    note: 'Replay after a fix was validated in EXP-004 \u2014 safe because the same idempotency guard prevents a duplicate ledger entry on replay.'
  },
  {
    id: 'dlq-growth',
    label: 'DLQ backlog growth',
    component: 'Dead-letter topic',
    path: ['NORMAL', 'A batch of events fails validation together (e.g. an upstream field format changes)', 'DLQ depth grows faster than manual review can drain it', 'DLQ depth crosses the alert threshold', 'On-call is paged', 'Root cause fixed upstream', 'Backlog replayed and drained'],
    impact: { queue: 'DEGRADED', dlqMessages: 18 },
    note: 'No automated DLQ replay exists yet (see EXP-004\u2019s conclusion) \u2014 draining a real backlog today is a manual step. That\u2019s a documented limitation, not a gap in this simulation.'
  }
];
let activeIncident = null;
let incidentTimer = null;
let baselineData = null; // set once telemetry loads

function statusClass(s) {
  const map = { OPERATIONAL: 'operational', DEGRADED: 'degraded', DOWN: 'down' };
  return map[s] || 'operational';
}

function renderServices(status, overrides = {}) {
  const labels = {
    system: 'System status', api: 'API status', database: 'Database status',
    streamProcessor: 'Stream processor', queue: 'Queue status'
  };
  serviceRow.innerHTML = Object.entries(labels).map(([key, label]) => {
    const value = overrides[key] || status[key];
    return `
    <div class="service-cell">
      <span class="name">${label}</span>
      <span class="status-pill ${statusClass(value)}">${escapeHTML(value)}</span>
    </div>
  `;
  }).join('');
}

function metricCell(label, value, cls = '') {
  return `<div class="metric-cell"><span class="label">${label}</span><span class="value ${cls}">${value}</span></div>`;
}

function applyDelta(base, key, delta) {
  if (delta === undefined) return base[key];
  // Fractional deltas (magnitude < 1) scale the base value (e.g. -0.5 = halve it);
  // whole-number deltas add directly (e.g. +900ms, +12 connections).
  if (Math.abs(delta) < 1 && delta !== 0) return Math.max(0, base[key] * (1 + delta));
  return Math.max(0, base[key] + delta);
}

function renderMetrics(summary, impact = {}) {
  const eff = {
    transactionsProcessed24h: summary.transactionsProcessed24h,
    throughputRowsPerSec: summary.throughputRowsPerSec,
    avgLatencyMs: Math.round(applyDelta(summary, 'avgLatencyMs', impact.avgLatencyMs)),
    p95LatencyMs: Math.round(applyDelta(summary, 'p95LatencyMs', impact.p95LatencyMs)),
    errorRatePct: Number(applyDelta(summary, 'errorRatePct', impact.errorRatePct).toFixed(2)),
    dbConnections: Math.round(applyDelta(summary, 'dbConnections', impact.dbConnections)),
    dlqMessages: Math.round(applyDelta(summary, 'dlqMessages', impact.dlqMessages))
  };
  metricGrid.innerHTML = [
    metricCell('Transactions / 24h', formatNumber(eff.transactionsProcessed24h)),
    metricCell('Throughput (rows/sec)', formatNumber(eff.throughputRowsPerSec), 'ok'),
    metricCell('Avg latency', `${eff.avgLatencyMs} ms`, impact.avgLatencyMs ? 'warn' : ''),
    metricCell('P95 latency', `${eff.p95LatencyMs} ms`, eff.p95LatencyMs > 180 ? 'warn' : ''),
    metricCell('Error rate', `${eff.errorRatePct}%`, eff.errorRatePct > 1 ? 'err' : 'ok'),
    metricCell('DB connections', eff.dbConnections, impact.dbConnections ? 'warn' : ''),
    metricCell('DLQ depth', eff.dlqMessages, eff.dlqMessages > 5 ? 'err' : (eff.dlqMessages > 0 ? 'warn' : 'ok'))
  ].join('');
}

function renderRangeTabs() {
  rangeTabs.innerHTML = RANGES.map(r => `
    <button role="tab" data-id="${r.id}" class="${currentRange.id === r.id ? 'active' : ''}" aria-selected="${currentRange.id === r.id}">${r.label}</button>
  `).join('');
  rangeTabs.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const range = RANGES.find(r => r.id === btn.dataset.id);
      currentRange = range;
      renderRangeTabs();
      renderCharts();
    });
  });
}

function renderCharts() {
  if (!baselineData) return;
  const t = baselineData;
  if (!currentRange.available) {
    rangeNote.textContent = `This demo captured one synthetic hour at one-minute resolution — there's no ${currentRange.label} of recorded telemetry to show. Showing the 1h view instead.`;
    const points = t.series;
    drawCharts(points);
    return;
  }
  rangeNote.textContent = `Showing the last ${currentRange.label} of the captured hour (${currentRange.minutes} of 60 one-minute points).`;
  const points = t.series.slice(Math.max(0, t.series.length - currentRange.minutes));
  drawCharts(points);
}

function drawCharts(points) {
  const rpsSvg = document.getElementById('chart-rps');
  buildLineChart(rpsSvg, points, ['requestsPerSec', 'eventsPerSec'], ['var(--accent)', 'var(--info)']);
  document.getElementById('rps-sub').textContent = 'green = requests/sec · blue = events/sec';

  const latSvg = document.getElementById('chart-latency');
  buildLineChart(latSvg, points, ['latencyMsAvg', 'latencyMsP95'], ['var(--accent)', 'var(--warning)'], 'ms');
  document.getElementById('latency-sub').textContent = 'green = avg · amber = P95';
}

function renderIncidentButtons() {
  incidentButtons.innerHTML = INCIDENTS.map(i => `
    <button class="btn" data-id="${i.id}" style="font-size:var(--fs-00); padding:0.4rem 0.75rem;">${escapeHTML(i.label)}</button>
  `).join('') + `<button class="btn" id="incident-reset" style="font-size:var(--fs-00); padding:0.4rem 0.75rem;">Reset</button>`;

  incidentButtons.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', () => triggerIncident(INCIDENTS.find(i => i.id === btn.dataset.id)));
  });
  document.getElementById('incident-reset').addEventListener('click', resetIncident);
}

function triggerIncident(incident) {
  clearTimeout(incidentTimer);
  activeIncident = incident;
  renderServices(baselineData.status, incident.impact);
  renderMetrics(baselineData.summary, incident.impact);
  renderIncidentPanel(incident, 'ACTIVE');

  incidentTimer = setTimeout(() => {
    renderIncidentPanel(incident, 'RECOVERED');
    renderServices(baselineData.status);
    renderMetrics(baselineData.summary);
  }, 9000);
}

function resetIncident() {
  clearTimeout(incidentTimer);
  activeIncident = null;
  incidentPanel.innerHTML = '';
  renderServices(baselineData.status);
  renderMetrics(baselineData.summary);
}

function renderIncidentPanel(incident, phase) {
  const pillClass = phase === 'ACTIVE' ? 'experimental' : 'live';
  incidentPanel.innerHTML = `
    <div class="callout">
      <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; margin-bottom:0.5rem;">
        <span class="status-pill ${pillClass}">SIMULATION: ${phase}</span>
        <strong style="font-family:var(--font-mono); color:var(--text);">${escapeHTML(incident.component)}</strong>
      </div>
      <ol style="margin:0 0 0.75rem; padding-left:1.1rem; font-size:var(--fs-0);">
        ${incident.path.map(step => `<li style="margin-bottom:0.2rem;">${escapeHTML(step)}</li>`).join('')}
      </ol>
      <p style="margin:0; color:var(--text-2); font-size:var(--fs-00);">${escapeHTML(incident.note)}</p>
      ${phase === 'ACTIVE' ? '<p style="margin:0.5rem 0 0; color:var(--text-2); font-size:var(--fs-00);">Auto-recovering in a few seconds, or press Reset.</p>' : ''}
    </div>
  `;
}

function buildLineChart(svgEl, series, keys, colors, unitSuffix = '') {
  const W = 600, H = 220, padL = 34, padR = 10, padT = 10, padB = 24;
  const values = keys.flatMap(k => series.map(p => p[k]));
  const max = Math.max(...values) * 1.15;
  const min = 0;
  const stepX = (W - padL - padR) / (series.length - 1);

  const yFor = v => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
  const xFor = i => padL + i * stepX;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const y = padT + (H - padT - padB) * f;
    const val = Math.round(max * (1 - f));
    return `<line class="chart-grid-line" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"></line>
            <text class="chart-axis-label" x="4" y="${y + 3}">${val}${unitSuffix}</text>`;
  }).join('');

  const xLabels = series.map((p, i) => {
    if (i % Math.ceil(series.length / 6) !== 0) return '';
    return `<text class="chart-axis-label" x="${xFor(i)}" y="${H - 6}" text-anchor="middle">${p.time}</text>`;
  }).join('');

  const paths = keys.map((k, ki) => {
    const d = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p[k])}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${colors[ki]}" stroke-width="2"></path>`;
  }).join('');

  svgEl.innerHTML = `${gridLines}${paths}${xLabels}`;
}

(async () => {
  const result = await loadJSON('../data/telemetry.json');
  if (!result.ok) {
    renderEmptyState(envBanner.parentElement, `No telemetry available (${result.error}).`);
    return;
  }
  const t = result.data;
  t.summary.dlqMessages = t.series[t.series.length - 1].dlqMessages;
  baselineData = t;

  envBanner.innerHTML = `
    <span><strong>${escapeHTML(t.environment)}</strong> data &mdash; ${escapeHTML(t.source)}</span>
    <span>Last updated: ${new Date(t.lastUpdated).toLocaleString()}</span>
  `;

  renderServices(t.status);
  renderMetrics(t.summary);
  renderRangeTabs();
  renderCharts();
  renderIncidentButtons();
})();
