const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const { serviceTokenHeader } = require('../src/security/service-token');
const { errorHandler } = require('../src/middleware/error-handler');
const { InboxRepository } = require('../src/modules/events/inbox-repository');
const { InboxService } = require('../src/modules/events/inbox-service');
const { OutboxRelay } = require('../src/modules/identity/outbox-relay');
const { registerEventRoutes } = require('../src/modules/events/inbox-controller');
const {
  createInitializedDatabase,
  createInitializedIdentityDatabase,
  resetDatabase,
  resetIdentityDatabase,
  startIdentityService,
  testServiceToken,
} = require('./helpers/mariadb-test-utils');

const unreachableBackendUrl = 'http://127.0.0.1:9';

async function listen(app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function startInbox(mainDatabase) {
  const app = express();
  app.use(express.json({ limit: '20kb' }));
  registerEventRoutes({
    app,
    serviceToken: testServiceToken,
    inboxService: new InboxService(new InboxRepository(mainDatabase)),
  });
  app.use(errorHandler);
  return listen(app);
}

async function startFreshIdentity(t, backendUrl) {
  const database = await createInitializedIdentityDatabase();
  await resetIdentityDatabase(database);
  await database.end();
  const identity = await startIdentityService({ backendUrl });
  t.after(() => identity.close());
  return identity;
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
    'SELECT event_type, published_at, attempts, last_error FROM outbox_events ORDER BY seq',
  );
  return rows;
}

test('user.registered is delivered to the monolith and redelivery is deduplicated by the inbox', async (t) => {
  const mainDatabase = await createInitializedDatabase();
  await resetDatabase(mainDatabase);
  const inbox = await startInbox(mainDatabase);
  t.after(() => inbox.close());
  t.after(() => mainDatabase.end());
  const identity = await startFreshIdentity(t, inbox.url);

  assert.equal((await register(identity, 'delivered@example.com')).status, 200);
  assert.equal(await identity.outboxRelay.publishPending(), 1);

  const [afterFirstDelivery] = await outboxRows(identity);
  assert.equal(afterFirstDelivery.event_type, 'user.registered');
  assert.notEqual(afterFirstDelivery.published_at, null);

  await identity.database.execute('UPDATE outbox_events SET published_at = NULL');
  assert.equal(await identity.outboxRelay.publishPending(), 1);

  const [[inboxCount]] = await mainDatabase.execute('SELECT COUNT(*) AS count FROM inbox_events');
  assert.equal(Number(inboxCount.count), 1);
});

test('an unreachable monolith keeps the event pending and delivers it after recovery', async (t) => {
  const mainDatabase = await createInitializedDatabase();
  await resetDatabase(mainDatabase);
  t.after(() => mainDatabase.end());
  const inbox = await startInbox(mainDatabase);
  t.after(() => inbox.close());
  const identity = await startFreshIdentity(t, unreachableBackendUrl);

  assert.equal((await register(identity, 'outage@example.com')).status, 200);
  assert.equal(await identity.outboxRelay.publishPending(), 0);

  const [pending] = await outboxRows(identity);
  assert.equal(pending.published_at, null);
  assert.equal(Number(pending.attempts), 1);
  assert.notEqual(pending.last_error, null);

  identity.outboxRelay.targetUrl = inbox.url;
  await identity.database.execute('UPDATE outbox_events SET next_attempt_at = NULL');
  assert.equal(await identity.outboxRelay.publishPending(), 1);
  const [delivered] = await outboxRows(identity);
  assert.notEqual(delivered.published_at, null);
});

test('the inbox rejects requests without the service token or with an invalid event', async (t) => {
  const mainDatabase = await createInitializedDatabase();
  await resetDatabase(mainDatabase);
  t.after(() => mainDatabase.end());
  const inbox = await startInbox(mainDatabase);
  t.after(() => inbox.close());
  const event = { id: '5f1c2a7e-3b9d-4e8f-9a1b-6c7d8e9f0a1b', type: 'user.registered', payload: {} };
  const post = (headers, body) => fetch(`${inbox.url}/internal/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

  assert.equal((await post({}, event)).status, 401);
  assert.equal((await post({ [serviceTokenHeader]: 'wrong-token' }, event)).status, 401);
  const invalid = await post({ [serviceTokenHeader]: testServiceToken }, { ...event, id: 'not-a-uuid' });
  assert.equal(invalid.status, 400);
  const accepted = await post({ [serviceTokenHeader]: testServiceToken }, event);
  assert.deepEqual(await accepted.json(), { status: 'accepted' });
});

test('a failed registration leaves no outbox event behind', async (t) => {
  const identity = await startFreshIdentity(t, unreachableBackendUrl);

  assert.equal((await register(identity, 'duplicate@example.com')).status, 200);
  assert.equal((await register(identity, 'duplicate@example.com')).status, 409);

  const rows = await outboxRows(identity);
  assert.equal(rows.length, 1);
});

test('concurrent registrations of the same email create one user and one outbox event', async (t) => {
  const identity = await startFreshIdentity(t, unreachableBackendUrl);

  const responses = await Promise.all(Array.from({ length: 5 }, () => register(identity, 'race@example.com')));

  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409, 409, 409, 409]);
  assert.equal((await outboxRows(identity)).length, 1);
});

test('a failed delivery waits for its retry and keeps later events behind it', async (t) => {
  const identity = await startFreshIdentity(t, unreachableBackendUrl);
  await register(identity, 'first-retry@example.com');
  await register(identity, 'second-retry@example.com');
  const [eventRows] = await identity.database.execute('SELECT event_id FROM outbox_events ORDER BY seq');
  const deliveredIds = [];
  const relay = new OutboxRelay({
    repository: identity.outboxRelay.repository,
    targetUrl: 'http://monolith.test',
    serviceToken: testServiceToken,
    fetchImpl: async (url, { body }) => {
      deliveredIds.push(JSON.parse(body).id);
      return new Response('', { status: 503 });
    },
  });

  assert.equal(await relay.publishPending(), 0);
  assert.equal(await relay.publishPending(), 0);
  assert.deepEqual(deliveredIds, [eventRows[0].event_id]);
  const [[retrying]] = await identity.database.execute(
    'SELECT attempts, next_attempt_at > NOW(3) AS scheduled FROM outbox_events WHERE event_id = ?',
    [eventRows[0].event_id],
  );
  assert.equal(Number(retrying.attempts), 1);
  assert.equal(Number(retrying.scheduled), 1);

  await identity.database.execute('UPDATE outbox_events SET next_attempt_at = NULL');
  relay.fetchImpl = async (url, { body }) => {
    deliveredIds.push(JSON.parse(body).id);
    return new Response('{"status":"accepted"}', { status: 202 });
  };
  assert.equal(await relay.publishPending(), 2);
  assert.deepEqual(deliveredIds.slice(1), eventRows.map((row) => row.event_id));
});

test('an event that exhausts its retries is dead-lettered and later events are still delivered', async (t) => {
  const identity = await startFreshIdentity(t, unreachableBackendUrl);
  await register(identity, 'poison@example.com');
  await register(identity, 'healthy@example.com');
  const [[poison]] = await identity.database.execute('SELECT event_id FROM outbox_events ORDER BY seq LIMIT 1');
  await identity.database.execute('UPDATE outbox_events SET attempts = 5 WHERE event_id = ?', [poison.event_id]);
  const relay = new OutboxRelay({
    repository: identity.outboxRelay.repository,
    targetUrl: 'http://monolith.test',
    serviceToken: testServiceToken,
    fetchImpl: async (url, { body }) => new Response('', { status: JSON.parse(body).id === poison.event_id ? 503 : 202 }),
  });

  assert.equal(await relay.publishPending(), 1);

  const [[deadLettered]] = await identity.database.execute(
    'SELECT attempts, dead_lettered_at, published_at FROM outbox_events WHERE event_id = ?',
    [poison.event_id],
  );
  assert.equal(Number(deadLettered.attempts), 6);
  assert.notEqual(deadLettered.dead_lettered_at, null);
  assert.equal(deadLettered.published_at, null);
  assert.equal(await relay.publishPending(), 0);
});

test('a permanent 4xx rejection is dead-lettered at once while later events are still delivered', async (t) => {
  const identity = await startFreshIdentity(t, unreachableBackendUrl);
  await register(identity, 'rejected@example.com');
  await register(identity, 'accepted@example.com');
  const [[rejected]] = await identity.database.execute('SELECT event_id FROM outbox_events ORDER BY seq LIMIT 1');
  const relay = new OutboxRelay({
    repository: identity.outboxRelay.repository,
    targetUrl: 'http://monolith.test',
    serviceToken: testServiceToken,
    fetchImpl: async (url, { body }) => new Response('', { status: JSON.parse(body).id === rejected.event_id ? 400 : 202 }),
  });

  assert.equal(await relay.publishPending(), 1);

  const [[deadLettered]] = await identity.database.execute(
    'SELECT attempts, dead_lettered_at, next_attempt_at FROM outbox_events WHERE event_id = ?',
    [rejected.event_id],
  );
  assert.equal(Number(deadLettered.attempts), 1);
  assert.notEqual(deadLettered.dead_lettered_at, null);
  assert.equal(deadLettered.next_attempt_at, null);
});
