// Shared with pages/code.html and system detail pages — no DOM code here,
// so importing this file has no side effects.
export const SNIPPETS = [
  {
    id: 'idempotency',
    title: 'Idempotency guard',
    filename: 'idempotency.py',
    language: 'Python',
    category: 'Fraud Detection',
    purpose: 'Prevents the event processor from double-applying a transaction if M-Pesa retries a webhook callback.',
    github: 'https://github.com/Victor-Kipruto-Rop',
    explanation: 'Every inbound event carries a transaction ID. Before processing, the service checks a small idempotency table keyed on that ID inside the same transaction as the write, so a retried webhook is a no-op rather than a duplicate ledger entry.',
    code: `def process_event(event, db):
    with db.transaction():
        existing = db.execute(
            "SELECT 1 FROM processed_events WHERE event_id = %s FOR UPDATE",
            [event.id],
        ).fetchone()

        if existing:
            return {"status": "duplicate", "event_id": event.id}

        apply_transaction(event, db)

        db.execute(
            "INSERT INTO processed_events (event_id, processed_at) VALUES (%s, now())",
            [event.id],
        )

    return {"status": "processed", "event_id": event.id}`
  },
  {
    id: 'reconciliation-sql',
    title: 'Reconciliation query',
    filename: 'reconciliation.sql',
    language: 'SQL',
    category: 'Fraud Detection',
    purpose: 'Finds ledger entries that have no matching settled transaction, the core of the reconciliation job.',
    github: 'https://github.com/Victor-Kipruto-Rop',
    explanation: 'A LEFT JOIN from the ledger to settled transactions surfaces any ledger row without a match. Filtering on a rolling window keeps the query cheap even as the ledger grows.',
    code: `SELECT
    l.ledger_id,
    l.amount,
    l.recorded_at
FROM ledger_entries l
LEFT JOIN transactions t
    ON t.transaction_id = l.transaction_ref
    AND t.status = 'SETTLED'
WHERE t.transaction_id IS NULL
    AND l.recorded_at >= now() - interval '24 hours'
ORDER BY l.recorded_at DESC;`
  },
  {
    id: 'kafka-consumer',
    title: 'Kafka consumer with manual commit',
    filename: 'consumer.py',
    language: 'Kafka',
    category: 'Streaming',
    purpose: 'Consumes transaction events with at-least-once semantics, committing offsets only after the downstream write succeeds.',
    github: 'https://github.com/Victor-Kipruto-Rop',
    explanation: 'Auto-commit is disabled so the consumer only advances its offset after the event has been durably written, which is what makes the pipeline safe to restart without silently dropping in-flight events.',
    code: `consumer = KafkaConsumer(
    "transactions",
    enable_auto_commit=False,
    group_id="fraud-scoring",
)

for message in consumer:
    event = json.loads(message.value)
    try:
        score_and_store(event)
        consumer.commit()
    except TransientError:
        logger.warning("retrying event %s", event["id"])
        continue`
  },
  {
    id: 'dlq-handling',
    title: 'Dead-letter queue routing',
    filename: 'dlq.py',
    language: 'Streaming',
    category: 'Streaming',
    purpose: 'Routes events that fail validation to a dead-letter topic instead of blocking the main stream.',
    github: 'https://github.com/Victor-Kipruto-Rop',
    explanation: 'Validation failures are common with third-party payloads. Rather than crash the consumer or drop the event, it is tagged with the failure reason and republished to a DLQ topic for manual review.',
    code: `def handle(event, producer):
    errors = validate(event)
    if errors:
        producer.send("transactions.dlq", {
            "original": event,
            "errors": errors,
            "failed_at": datetime.utcnow().isoformat(),
        })
        return

    producer.send("transactions.validated", event)`
  },
  {
    id: 'etl-transform',
    title: 'ETL transformation step',
    filename: 'transform.py',
    language: 'Python',
    category: 'ETL',
    purpose: 'Normalizes raw market data rows before loading them into the warehouse.',
    github: 'https://github.com/Victor-Kipruto-Rop',
    explanation: 'Column renaming, type coercion, and null handling are isolated in one pure function so the transform step can be unit-tested independently of extract and load.',
    code: `def transform(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.rename(columns=COLUMN_MAP)
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df["recorded_at"] = pd.to_datetime(df["recorded_at"], utc=True)
    df = df.dropna(subset=["price", "recorded_at"])
    df["source"] = "market-feed-v2"
    return df.reset_index(drop=True)`
  },
  {
    id: 'fraud-scoring',
    title: 'Rule-based fraud scoring',
    filename: 'scoring.py',
    language: 'Fraud Detection',
    category: 'Fraud Detection',
    purpose: 'Combines transaction velocity and amount into a bounded risk score before a statistical model is consulted.',
    github: 'https://github.com/Victor-Kipruto-Rop',
    explanation: 'This runs first because it is cheap and has no external dependency. It also acts as the fallback path if the statistical model is unavailable, per the architecture\'s failure handling.',
    code: `def rule_score(amount: float, velocity_1h: int) -> float:
    amount_component = min(amount / 50_000, 1.0) * 0.5
    velocity_component = min(velocity_1h / 10, 1.0) * 0.5
    return round(amount_component + velocity_component, 3)`
  },
  {
    id: 'docker-compose',
    title: 'Local pipeline stack',
    filename: 'docker-compose.yml',
    language: 'Docker',
    category: 'Cloud',
    purpose: 'Brings up Kafka, PostgreSQL, and the processing services for local development.',
    github: 'https://github.com/Victor-Kipruto-Rop',
    explanation: 'Health checks gate service startup order, so the consumer service does not start racing against a Kafka broker that has not finished electing a controller yet.',
    code: `services:
  kafka:
    image: bitnami/kafka:3.6
    healthcheck:
      test: ["CMD", "kafka-topics.sh", "--list", "--bootstrap-server", "localhost:9092"]
      interval: 10s
      retries: 5

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: pesaguard
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]

  processor:
    build: ./processor
    depends_on:
      kafka:
        condition: service_healthy
      postgres:
        condition: service_healthy`
  },
  {
    id: 'db-indexing',
    title: 'Reconciliation index',
    filename: 'migrations/0007_index.sql',
    language: 'PostgreSQL',
    category: 'FinTech',
    purpose: 'Speeds up the reconciliation query by indexing the columns it filters and joins on.',
    github: 'https://github.com/Victor-Kipruto-Rop',
    explanation: 'A partial index on unsettled ledger entries keeps the index small, since settled entries — the majority of rows over time — never need to be scanned by the reconciliation job.',
    code: `CREATE INDEX CONCURRENTLY idx_ledger_unsettled
    ON ledger_entries (transaction_ref, recorded_at)
    WHERE status <> 'SETTLED';`
  }
];
