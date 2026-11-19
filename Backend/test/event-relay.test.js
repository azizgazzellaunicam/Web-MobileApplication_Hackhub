const assert = require('node:assert/strict');
const test = require('node:test');
const { InboxRepository } = require('../src/modules/events/inbox-repository');
const { InboxService } = require('../src/modules/events/inbox-service');
const { EventConsumer } = require('../src/messaging/event-consumer');
const { RabbitMqConnection } = require('../src/messaging/rabbitmq-connection');
const { backendQueue, deadLetterQueue } = require('../src/messaging/event-topology');
const {
  createInitializedDatabase,
  createInitializedIdentityDatabase,
  defaultRabbitMqUrl,
  resetDatabase,
  resetIdentityDatabase,
  startIdentityService,
} = require('./helpers/mariadb-test-utils');
const {
  drainQueue,
  publishRaw,
  queueMessageCount,
  resetRabbitMq,
  testRetryDelaysMs,
  waitUntil,
} = require('./helpers/rabbitmq-test-utils');

const unreachableRabbitMqUrl = 'amqp://hackhub:hackhub@127.0.0.1:9';
const silentLogger = { error() {} };

// Wraps the inbox so the first `failures` deliveries throw before reaching the real inbox.
function injectFailures(inboxService, failures) {
  const failure = { remaining: failures, attempts: 0 };
  const service = {
    receive: async (event) => {
      failure.attempts += 1;
      if (failure.remaining > 0) {
        failure.remaining -= 1;
        throw new Error('Gestore non disponibile.');
      }
      return inboxService.receive(event);
    },
  };
  return { service, failure };
}

async function startBackend(t, { failures = 0 } = {}) {
  const rabbitMqUrl = process.env.RABBITMQ_URL || defaultRabbitMqUrl;
  await resetRabbitMq(rabbitMqUrl);
  const database = await createInitializedDatabase();
  await resetDatabase(database);
  const { service, failure } = injectFailures(new InboxService(new InboxRepository(database)), failures);
  const connection = new RabbitMqConnection({ url: rabbitMqUrl });
  const consumer = new EventConsumer({
    connection,
    inboxService: service,
    retryDelaysMs: testRetryDelaysMs,
    reconnectDelayMs: 50,
    logger: silentLogger,
  });
  consumer.start();
  t.after(async () => {
    await consumer.stop();
    await connection.close();
    await database.end();
  });
  return { database, connection, consumer, failure };
}

async function startFreshIdentity(t) {
  const database = await createInitializedIdentityDatabase();
  await resetIdentityDatabase(database);
  await database.end();
  const identity = await startIdentityService();
  t.after(() => identity.close());
  return identity;
}

// Drops the live broker connection and points the identity at an unreachable broker, so publishes fail.
async function breakBroker(identity) {
  const connection = await identity.connection.getConnection();
  identity.connection.url = unreachableRabbitMqUrl;
  await connection.close();
}

function restoreBroker(identity) {
  identity.connection.url = process.env.RABBITMQ_URL || defaultRabbitMqUrl;
}

async function register(identity, email) {
  return fetch(`${identity.baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'relay-test-password', name: 'Relay Test' }),
  });
}

async function outboxRows(identity) {
  const [rows] = await identity.database.execute(
    'SELECT event_id, event_type, published_at, attempts, last_error FROM outbox_events ORDER BY seq',
  );
  return rows;
}

async function inboxCount(database) {
  const [[row]] = await database.execute('SELECT COUNT(*) AS count FROM inbox_events');
  return Number(row.count);
}

test('an outbox event reaches the inbox once and a redelivery is deduplicated', async (t) => {
  const backend = await startBackend(t);
  const identity = await startFreshIdentity(t);

  assert.equal((await register(identity, 'delivered@example.com')).status, 200);
  assert.equal(await identity.outboxRelay.publishPending(), 1);
  await waitUntil(() => backend.consumer.settled === 1);
  assert.equal(await inboxCount(backend.database), 1);

  await identity.database.execute('UPDATE outbox_events SET published_at = NULL');
  assert.equal(await identity.outboxRelay.publishPending(), 1);
  await waitUntil(() => backend.consumer.settled === 2);
  assert.equal(await inboxCount(backend.database), 1);
});

test('an event survives a broker outage and is delivered after recovery', async (t) => {
  const backend = await startBackend(t);
  const identity = await startFreshIdentity(t);
  await breakBroker(identity);

  assert.equal((await register(identity, 'outage@example.com')).status, 200);
  assert.equal(await identity.outboxRelay.publishPending(), 0);
  const [pending] = await outboxRows(identity);
  assert.equal(pending.published_at, null);
  assert.equal(Number(pending.attempts), 1);
  assert.notEqual(pending.last_error, null);

  restoreBroker(identity);
  await identity.database.execute('UPDATE outbox_events SET next_attempt_at = NULL');
  assert.equal(await identity.outboxRelay.publishPending(), 1);
  await waitUntil(async () => await inboxCount(backend.database) === 1);
});

test('the outbox keeps later events behind a failed delivery until it succeeds', async (t) => {
  const backend = await startBackend(t);
  const identity = await startFreshIdentity(t);
  await breakBroker(identity);
  await register(identity, 'first-retry@example.com');
  await register(identity, 'second-retry@example.com');

  assert.equal(await identity.outboxRelay.publishPending(), 0);
  assert.equal(await identity.outboxRelay.publishPending(), 0);
  const [first] = await outboxRows(identity);
  assert.equal(Number(first.attempts), 1);

  restoreBroker(identity);
  await identity.database.execute('UPDATE outbox_events SET next_attempt_at = NULL');
  assert.equal(await identity.outboxRelay.publishPending(), 2);
  await waitUntil(async () => await inboxCount(backend.database) === 2);
});

test('an outbox event that exhausts its retries is dead-lettered while later events are still delivered', async (t) => {
  const backend = await startBackend(t);
  const identity = await startFreshIdentity(t);
  await register(identity, 'poison@example.com');
  await register(identity, 'healthy@example.com');
  const [[poison]] = await identity.database.execute('SELECT event_id FROM outbox_events ORDER BY seq LIMIT 1');
  await identity.database.execute('UPDATE outbox_events SET attempts = 5 WHERE event_id = ?', [poison.event_id]);
  await breakBroker(identity);

  assert.equal(await identity.outboxRelay.publishPending(), 0);
  const [[deadLettered]] = await identity.database.execute(
    'SELECT attempts, dead_lettered_at, published_at FROM outbox_events WHERE event_id = ?',
    [poison.event_id],
  );
  assert.equal(Number(deadLettered.attempts), 6);
  assert.notEqual(deadLettered.dead_lettered_at, null);
  assert.equal(deadLettered.published_at, null);

  restoreBroker(identity);
  await identity.database.execute('UPDATE outbox_events SET next_attempt_at = NULL');
  assert.equal(await identity.outboxRelay.publishPending(), 1);
  assert.equal(await identity.outboxRelay.publishPending(), 0);
  await waitUntil(async () => await inboxCount(backend.database) === 1);
});

test('a malformed message is dead-lettered without touching the inbox', async (t) => {
  const backend = await startBackend(t);
  const rabbitMqUrl = process.env.RABBITMQ_URL || defaultRabbitMqUrl;

  await publishRaw(rabbitMqUrl, { routingKey: 'user.registered', content: 'not json' });
  await waitUntil(async () => await queueMessageCount(rabbitMqUrl, deadLetterQueue) === 1);

  const [message] = await drainQueue(rabbitMqUrl, deadLetterQueue);
  assert.equal(message.properties.headers['x-last-error'], 'Il messaggio non è JSON valido.');
  assert.equal(Number(message.properties.headers['x-attempts']), 1);
  assert.equal(await inboxCount(backend.database), 0);
});

test('a handler that keeps failing is retried with backoff and then dead-lettered', async (t) => {
  const backend = await startBackend(t, { failures: Infinity });
  const rabbitMqUrl = process.env.RABBITMQ_URL || defaultRabbitMqUrl;
  const identity = await startFreshIdentity(t);
  await register(identity, 'exhausted@example.com');
  assert.equal(await identity.outboxRelay.publishPending(), 1);

  await waitUntil(async () => await queueMessageCount(rabbitMqUrl, deadLetterQueue) === 1);
  const [message] = await drainQueue(rabbitMqUrl, deadLetterQueue);
  assert.equal(Number(message.properties.headers['x-attempts']), testRetryDelaysMs.length + 1);
  assert.equal(message.properties.headers['x-last-error'], 'Consegna esaurita: Gestore non disponibile.');
  assert.equal(backend.failure.attempts, testRetryDelaysMs.length + 1);
  assert.equal(await inboxCount(backend.database), 0);
  assert.equal(await queueMessageCount(rabbitMqUrl, backendQueue), 0);
});

test('a handler that fails once succeeds on its retry and nothing is dead-lettered', async (t) => {
  const backend = await startBackend(t, { failures: 1 });
  const rabbitMqUrl = process.env.RABBITMQ_URL || defaultRabbitMqUrl;
  const identity = await startFreshIdentity(t);
  await register(identity, 'transient@example.com');
  assert.equal(await identity.outboxRelay.publishPending(), 1);

  await waitUntil(async () => await inboxCount(backend.database) === 1);
  assert.equal(backend.failure.attempts, 2);
  assert.equal(await queueMessageCount(rabbitMqUrl, deadLetterQueue), 0);
});

test('the consumer reconnects and processes events after its connection is closed', async (t) => {
  const backend = await startBackend(t);
  const identity = await startFreshIdentity(t);
  const connection = await backend.connection.getConnection();
  await connection.close();

  await register(identity, 'reconnected@example.com');
  assert.equal(await identity.outboxRelay.publishPending(), 1);
  await waitUntil(async () => await inboxCount(backend.database) === 1, { timeoutMs: 15000 });
});

test('concurrent registrations of the same email create one user and one outbox event', async (t) => {
  const identity = await startFreshIdentity(t);

  const responses = await Promise.all(Array.from({ length: 5 }, () => register(identity, 'race@example.com')));

  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409, 409, 409, 409]);
  assert.equal((await outboxRows(identity)).length, 1);
});

test('a failed registration leaves no outbox event behind', async (t) => {
  const identity = await startFreshIdentity(t);

  assert.equal((await register(identity, 'duplicate@example.com')).status, 200);
  assert.equal((await register(identity, 'duplicate@example.com')).status, 409);

  assert.equal((await outboxRows(identity)).length, 1);
});
