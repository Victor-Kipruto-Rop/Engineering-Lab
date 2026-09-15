import { escapeHTML } from './app.js';

const EXPERIMENTS = [
  {
    id: 'load-test',
    title: 'PostgreSQL write load test',
    hypothesis: 'The reconciliation schema can sustain multi-tenant write throughput above 50,000 rows/sec without connection pool exhaustion.',
    environment: 'Local Docker Compose, PostgreSQL 16, 8 concurrent writer processes.',
    configuration: '100 simulated tenants, batched inserts of 500 rows, connection pool size 20.',
    method: 'Writers ran concurrently until 1,000,000 total rows were committed. Throughput was measured as total rows divided by wall-clock time; a read probe queried tenant totals mid-run to confirm the table remained queryable under load.',
    results: '~66,000 rows/sec sustained write throughput. Read probe returned in under 200ms throughout the run. No connection pool exhaustion observed.',
    observations: 'Throughput was steady rather than degrading over the run, suggesting the bottleneck was writer-side batching rather than the database itself at this scale.',
    conclusion: 'PASS. The schema and indexing strategy hold up well past the 50K rows/sec target at this tenant count; a partial index (see Code page) kept read latency stable during writes.'
  },
  {
    id: 'kafka-throughput',
    title: 'Kafka consumer throughput',
    hypothesis: 'Manual offset commits (vs. auto-commit) will reduce throughput by a measurable but acceptable margin, in exchange for at-least-once safety.',
    environment: 'Local Docker Compose, single-broker Kafka 3.6, one consumer group.',
    configuration: 'Manual commit after each successful downstream write, batch size 1.',
    method: 'Compared events/sec between auto-commit and manual-commit configurations over a 5-minute run with identical synthetic event volume.',
    results: 'Manual commit processed approximately 18% fewer events/sec than auto-commit in this configuration.',
    observations: 'Batching commits (rather than committing per-message) recovered most of the throughput gap without giving up the safety property.',
    conclusion: 'PASS with a caveat: switched to committing every 50 messages or every 2 seconds, whichever comes first, rather than per-message commits.'
  },
  {
    id: 'dlq-recovery',
    title: 'DLQ recovery drill',
    hypothesis: 'Events routed to the dead-letter topic can be replayed into the main pipeline without manual schema translation.',
    environment: 'Local Docker Compose.',
    configuration: 'Injected malformed payloads (missing required fields) to force DLQ routing, then attempted replay after a fix.',
    method: 'Fixed the payloads programmatically based on the recorded validation errors, republished to the main topic, and confirmed downstream processing completed.',
    results: 'All replayed events processed successfully with no duplicate ledger entries, due to the idempotency guard.',
    observations: 'The idempotency check (keyed on event ID) meant replay safety came for free from a mechanism built for a different reason (webhook retries).',
    conclusion: 'PASS. DLQ replay is safe as a manual remediation step; no automated replay was built since volume did not justify it yet.'
  },
  {
    id: 'reconciliation-accuracy',
    title: 'Reconciliation accuracy check',
    hypothesis: 'The set-difference reconciliation query correctly identifies all injected discrepancies with zero false negatives.',
    environment: 'Local PostgreSQL with a seeded dataset.',
    configuration: 'Seeded 10,000 ledger entries with 40 deliberately unmatched entries (missing transaction, timing mismatch, duplicate).',
    method: 'Ran the reconciliation query against the seeded dataset and compared flagged rows against the known-injected discrepancy list.',
    results: 'All 40 injected discrepancies were correctly flagged. Zero false positives on the remaining 9,960 matched entries.',
    observations: 'The 24-hour rolling window in the query means discrepancies older than 24 hours would be missed by this specific query; a separate nightly full-window job covers that case.',
    conclusion: 'PASS for the intended near-real-time window. Documented the window limitation rather than treating this run as validating unlimited-history reconciliation.'
  }
];

const tabs = document.getElementById('exp-tabs');
const detail = document.getElementById('exp-detail');
let current = EXPERIMENTS[0];

function renderTabs() {
  tabs.innerHTML = EXPERIMENTS.map(e => `
    <button data-id="${e.id}" class="${current.id === e.id ? 'active' : ''}">${e.title}</button>
  `).join('');
  tabs.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      current = EXPERIMENTS.find(e => e.id === btn.dataset.id);
      renderTabs();
      renderDetail();
    });
  });
}

function renderDetail() {
  const rows = [
    ['Hypothesis', current.hypothesis],
    ['Environment', current.environment],
    ['Configuration', current.configuration],
    ['Method', current.method],
    ['Results', current.results],
    ['Observations', current.observations],
    ['Conclusion', current.conclusion]
  ];
  detail.innerHTML = `
    <h2 style="margin-bottom:1rem;">${escapeHTML(current.title)}</h2>
    <dl>
      ${rows.map(([label, val]) => `<dt style="font-family:var(--font-mono); font-size:var(--fs-00); color:var(--text-2); margin-top:1rem;">${label}</dt><dd style="margin:0.25rem 0 0; max-width:70ch;">${escapeHTML(val)}</dd>`).join('')}
    </dl>
  `;
}

renderTabs();
renderDetail();
