const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const databasePath = path.join(os.tmpdir(), `hackhub-test-${process.pid}-${Date.now()}.sqlite`);
process.env.NODE_ENV = 'test';
process.env.HACKHUB_SEED_DEMO = 'true';
process.env.HACKHUB_DEMO_USER_PASSWORD = 'test-user-demo-password-2026';
process.env.HACKHUB_DEMO_ORGANIZER_PASSWORD = 'test-organizer-demo-password-2026';
process.env.HACKHUB_DEMO_JUDGE_PASSWORD = 'test-judge-demo-password-2026';
process.env.HACKHUB_DEMO_MENTOR_PASSWORD = 'test-mentor-demo-password-2026';
process.env.HACKHUB_DB_PATH = databasePath;
const { app, database } = require('../src/app');
let server;
let baseUrl;

test.before(() => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
  database.close();
  for (const suffix of ['', '-shm', '-wal']) {
    const file = `${databasePath}${suffix}`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});

async function request(url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  let body = null;
  if (response.status !== 204) body = await response.json();
  return { response, body };
}

async function login(email, password = 'password') {
  const result = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(result.response.status, 200);
  return result.body.token;
}

test('rejects unauthenticated access with 401', async () => {
  const { response, body } = await request('/api/teams');
  assert.equal(response.status, 401);
  assert.equal(body.status, 401);
});

test('isolates team invitations from non-members', async () => {
  const token = await login('mario@hackhub.it', 'test-user-demo-password-2026');
  const { response, body } = await request('/api/teams/999/invitations', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ email: 'giudice@hackhub.it' }),
  });
  assert.equal(response.status, 403);
  assert.equal(body.status, 403);
});

test('returns own submissions without exposing another user data', async () => {
  const token = await login('mario@hackhub.it', 'test-user-demo-password-2026');
  const { response, body } = await request('/api/submissions/mine', {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body));
});

test('protects submission evaluation from non-judges', async () => {
  const token = await login('mario@hackhub.it', 'test-user-demo-password-2026');
  const { response, body } = await request('/api/submissions/1/evaluations', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ score: 10, comment: 'test' }),
  });
  assert.equal(response.status, 403);
  assert.equal(body.status, 403);
});
