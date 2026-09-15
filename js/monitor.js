import { loadJSON, renderEmptyState, escapeHTML, formatNumber } from './app.js';

const envBanner = document.getElementById('env-banner');
const serviceRow = document.getElementById('service-row');
const metricGrid = document.getElementById('metric-grid');

function statusClass(s) {
  const map = { OPERATIONAL: 'operational', DEGRADED: 'degraded', DOWN: 'down' };
  return map[s] || 'operational';
}

function renderServices(status) {
  const labels = {
    system: 'System status', api: 'API status', database: 'Database status',
    streamProcessor: 'Stream processor', queue: 'Queue status'
  };
  serviceRow.innerHTML = Object.entries(labels).map(([key, label]) => `
    <div class="service-cell">
      <span class="name">${label}</span>
      <span class="status-pill ${statusClass(status[key])}">${escapeHTML(status[key])}</span>
    </div>
  `).join('');
}

function metricCell(label, value, cls = '') {
  return `<div class="metric-cell"><span class="label">${label}</span><span class="value ${cls}">${value}</span></div>`;
}

function renderMetrics(summary) {
  metricGrid.innerHTML = [
    metricCell('Transactions / 24h', formatNumber(summary.transactionsProcessed24h)),
    metricCell('Throughput (rows/sec)', formatNumber(summary.throughputRowsPerSec), 'ok'),
    metricCell('Avg latency', `${summary.avgLatencyMs} ms`),
    metricCell('P95 latency', `${summary.p95LatencyMs} ms`, summary.p95LatencyMs > 180 ? 'warn' : ''),
    metricCell('Error rate', `${summary.errorRatePct}%`, summary.errorRatePct > 1 ? 'err' : 'ok'),
    metricCell('DB connections', summary.dbConnections)
  ].join('');
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

  envBanner.innerHTML = `
    <span><strong>${escapeHTML(t.environment)}</strong> data &mdash; ${escapeHTML(t.source)}</span>
    <span>Last updated: ${new Date(t.lastUpdated).toLocaleString()}</span>
  `;

  renderServices(t.status);
  renderMetrics(t.summary);

  const rpsSvg = document.getElementById('chart-rps');
  buildLineChart(rpsSvg, t.series, ['requestsPerSec', 'eventsPerSec'], ['var(--accent)', 'var(--info)']);
  document.getElementById('rps-sub').textContent = 'green = requests/sec · blue = events/sec';

  const latSvg = document.getElementById('chart-latency');
  buildLineChart(latSvg, t.series, ['latencyMsAvg', 'latencyMsP95'], ['var(--accent)', 'var(--warning)'], 'ms');
  document.getElementById('latency-sub').textContent = 'green = avg · amber = P95';
})();
