import { escapeHTML } from './app.js';

const ENDPOINTS = [
  {
    id: 'create-transaction',
    method: 'POST',
    path: '/demo/transactions',
    description: 'Submit a transaction for validation and reconciliation, mirroring the PesaGuard ingestion contract.',
    samplePayload: { amount: 1500, currency: 'KES', type: 'PAYMENT' },
    validate(payload) {
      const errors = [];
      if (typeof payload.amount !== 'number' || payload.amount <= 0) errors.push('amount must be a positive number');
      if (payload.currency !== 'KES') errors.push('currency must be "KES" in this demo');
      if (!['PAYMENT', 'WITHDRAWAL', 'DEPOSIT', 'TRANSFER'].includes(payload.type)) errors.push('type must be one of PAYMENT, WITHDRAWAL, DEPOSIT, TRANSFER');
      return errors;
    },
    respond(payload) {
      return {
        status: 'accepted',
        transaction_id: `DEMO-${Math.floor(Math.random() * 90000 + 10000)}`,
        amount: payload.amount,
        currency: payload.currency,
        type: payload.type,
        processed_at: new Date().toISOString()
      };
    }
  },
  {
    id: 'get-reconciliation',
    method: 'GET',
    path: '/demo/reconciliation/{id}',
    description: 'Fetch reconciliation status for a transaction ID.',
    samplePayload: { id: 'DEMO-00042' },
    validate(payload) {
      const errors = [];
      if (!payload.id || typeof payload.id !== 'string') errors.push('id must be a string');
      return errors;
    },
    respond(payload) {
      return {
        id: payload.id,
        matched: true,
        ledger_balance: 154230.5,
        discrepancy: 0,
        checked_at: new Date().toISOString()
      };
    }
  },
  {
    id: 'score-anomaly',
    method: 'POST',
    path: '/demo/fraud/score',
    description: 'Return a risk score for a transaction feature vector.',
    samplePayload: { amount: 42000, channel: 'AGENT', velocity_1h: 6 },
    validate(payload) {
      const errors = [];
      if (typeof payload.amount !== 'number') errors.push('amount must be a number');
      if (!['USSD', 'APP', 'API', 'AGENT'].includes(payload.channel)) errors.push('channel must be one of USSD, APP, API, AGENT');
      if (typeof payload.velocity_1h !== 'number') errors.push('velocity_1h must be a number');
      return errors;
    },
    respond(payload) {
      const score = Math.min(0.98, (payload.amount / 50000) * 0.5 + (payload.velocity_1h / 10) * 0.5);
      return {
        risk_score: Number(score.toFixed(3)),
        flagged: score > 0.7,
        scored_at: new Date().toISOString()
      };
    }
  }
];

const tabs = document.getElementById('endpoint-tabs');
const metaEl = document.getElementById('endpoint-meta');
const payloadEl = document.getElementById('payload');
const sendBtn = document.getElementById('send-btn');
const validateBtn = document.getElementById('validate-btn');
const resetBtn = document.getElementById('reset-btn');
const validationMsg = document.getElementById('validation-msg');
const statusEl = document.getElementById('response-status');
const responseBody = document.getElementById('response-body');
const latencyNote = document.getElementById('latency-note');
const copyBtn = document.getElementById('copy-response');
const historyBody = document.getElementById('history-tbody');

let currentEndpoint = ENDPOINTS[0];
let history = [];

function renderTabs() {
  tabs.innerHTML = ENDPOINTS.map(ep => `
    <button role="tab" data-id="${ep.id}" class="${ep.id === currentEndpoint.id ? 'active' : ''}" aria-selected="${ep.id === currentEndpoint.id}">
      ${ep.method} ${ep.path}
    </button>
  `).join('');
  tabs.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      currentEndpoint = ENDPOINTS.find(e => e.id === btn.dataset.id);
      selectEndpoint();
    });
  });
}

function selectEndpoint() {
  renderTabs();
  metaEl.innerHTML = `<strong style="font-family:var(--font-mono); color:var(--accent);">${currentEndpoint.method} ${currentEndpoint.path}</strong><br>${escapeHTML(currentEndpoint.description)}`;
  payloadEl.value = JSON.stringify(currentEndpoint.samplePayload, null, 2);
  validationMsg.textContent = '';
  statusEl.textContent = 'Awaiting request';
  responseBody.textContent = '—';
  latencyNote.textContent = '';
}

function parsePayload() {
  try {
    return { ok: true, value: JSON.parse(payloadEl.value) };
  } catch (err) {
    return { ok: false, error: 'Invalid JSON: ' + err.message };
  }
}

function validate() {
  const parsed = parsePayload();
  if (!parsed.ok) {
    validationMsg.style.color = 'var(--error)';
    validationMsg.textContent = parsed.error;
    return null;
  }
  const errors = currentEndpoint.validate(parsed.value);
  if (errors.length) {
    validationMsg.style.color = 'var(--error)';
    validationMsg.textContent = errors.join(' · ');
    return null;
  }
  validationMsg.style.color = 'var(--accent)';
  validationMsg.textContent = 'Payload is valid.';
  return parsed.value;
}

function addHistory(status, latency) {
  history.unshift({ time: new Date().toLocaleTimeString(), endpoint: `${currentEndpoint.method} ${currentEndpoint.path}`, status, latency });
  history = history.slice(0, 8);
  historyBody.innerHTML = history.map(h => `
    <tr>
      <td>${h.time}</td>
      <td>${escapeHTML(h.endpoint)}</td>
      <td style="color:${h.status < 400 ? 'var(--accent)' : 'var(--error)'}">${h.status}</td>
      <td>${h.latency} ms</td>
    </tr>
  `).join('');
}

function send() {
  const payload = validate();
  statusEl.textContent = 'Sending…';
  responseBody.textContent = '…';

  const latency = Math.round(30 + Math.random() * 90);
  setTimeout(() => {
    if (!payload) {
      statusEl.textContent = '400 Bad Request';
      responseBody.textContent = JSON.stringify({ status: 'rejected', errors: validationMsg.textContent }, null, 2);
      addHistory(400, latency);
      latencyNote.textContent = `Latency: ${latency} ms (simulated)`;
      return;
    }
    const response = currentEndpoint.respond(payload);
    statusEl.textContent = '200 OK';
    responseBody.textContent = JSON.stringify(response, null, 2);
    addHistory(200, latency);
    latencyNote.textContent = `Latency: ${latency} ms (simulated, local)`;
  }, latency);
}

sendBtn.addEventListener('click', send);
validateBtn.addEventListener('click', validate);
resetBtn.addEventListener('click', selectEndpoint);
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(responseBody.textContent);
    copyBtn.textContent = 'Copied';
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1200);
  } catch {
    copyBtn.textContent = 'Unable to copy';
  }
});

selectEndpoint();
