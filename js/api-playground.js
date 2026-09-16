import { escapeHTML } from './app.js';
import { ENDPOINTS } from './content/endpoints.js';

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
const copyCurlBtn = document.getElementById('copy-curl');
const copyPythonBtn = document.getElementById('copy-python');
const historyBody = document.getElementById('history-tbody');

// This host is never called — RFC 2606 reserves .example for documentation,
// so a curl/Python snippet built from it can't accidentally hit a real
// endpoint if someone runs it as-is.
const DEMO_BASE_URL = 'https://demo.pesaguard.example';

let currentEndpoint = ENDPOINTS[0];
let history = [];

function resolvedPath(payload) {
  let path = currentEndpoint.path;
  if (payload && typeof payload === 'object') {
    path = path.replace(/\{(\w+)\}/g, (_, key) => (key in payload ? encodeURIComponent(payload[key]) : `{${key}}`));
  }
  return path;
}

function buildCurl() {
  const parsed = parsePayload();
  const payload = parsed.ok ? parsed.value : currentEndpoint.samplePayload;
  const url = `${DEMO_BASE_URL}${resolvedPath(payload)}`;
  if (currentEndpoint.method === 'GET') {
    return `curl -X GET "${url}"`;
  }
  const body = JSON.stringify(payload);
  return `curl -X ${currentEndpoint.method} "${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`;
}

function buildPython() {
  const parsed = parsePayload();
  const payload = parsed.ok ? parsed.value : currentEndpoint.samplePayload;
  const url = `${DEMO_BASE_URL}${resolvedPath(payload)}`;
  if (currentEndpoint.method === 'GET') {
    return `import requests\n\nresponse = requests.get("${url}")\nprint(response.status_code, response.json())`;
  }
  return `import requests\n\npayload = ${JSON.stringify(payload, null, 4)}\n\nresponse = requests.${currentEndpoint.method.toLowerCase()}(\n    "${url}",\n    json=payload,\n)\nprint(response.status_code, response.json())`;
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = original; }, 1200);
  } catch {
    btn.textContent = 'Unable to copy';
  }
}

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
copyBtn.addEventListener('click', () => copyText(responseBody.textContent, copyBtn));
copyCurlBtn.addEventListener('click', () => copyText(buildCurl(), copyCurlBtn));
copyPythonBtn.addEventListener('click', () => copyText(buildPython(), copyPythonBtn));

selectEndpoint();
