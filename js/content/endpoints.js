// Shared with pages/api-playground.html and system detail pages.
export const ENDPOINTS = [
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
