const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const { serviceTokenHeader } = require('../src/security/service-token');
const { errorHandler } = require('../src/middleware/error-handler');
const { InboxRepository } = require('../src/modules/events/inbox-repository');
const { InboxService } = require('../src/modules/events/inbox-service');
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
