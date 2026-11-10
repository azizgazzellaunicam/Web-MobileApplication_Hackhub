const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
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
process.env.HACKHUB_JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.HACKHUB_ACCESS_TOKEN_TTL = '2h';
process.env.HACKHUB_REFRESH_TOKEN_TTL_SECONDS = '3600';
const { app, database } = require('../src/app');
let server;
let baseUrl;
let databaseClosed = false;

test.before(() => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
  if (!databaseClosed) database.close();
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
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

function accessCookie(cookie) {
  return cookie.match(/hackhub_access=([^;]+)/)[1];
}

function refreshCookie(cookie) {
  return cookie.match(/hackhub_refresh=([^;]+)/)[1];
}

async function login(email, password = 'password') {
  const result = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(Object.hasOwn(result.body, 'token'), false);
  assert.equal(Object.hasOwn(result.body, 'accessToken'), false);
  const cookie = result.response.headers.get('set-cookie');
  assert.match(cookie, /hackhub_access=[^;]+; Max-Age=7200; Path=\/; HttpOnly; SameSite=Lax/);
  assert.match(cookie, /hackhub_refresh=[^;]+; Max-Age=3600; Path=\/api\/auth; HttpOnly; SameSite=Lax/);
  return { access: accessCookie(cookie), refresh: refreshCookie(cookie) };
}

test('rejects unauthenticated access with 401', async () => {
  const { response, body } = await request('/api/teams');
  assert.equal(response.status, 401);
  assert.equal(body.status, 401);
});

test('logs in, refreshes with rotation, and revokes on logout', async () => {
  const tokens = await login('mario@hackhub.it', 'test-user-demo-password-2026');
  const loggedIn = await request('/api/auth/profile', {
    headers: { authorization: `Bearer ${tokens.access}` },
  });
  assert.equal(loggedIn.response.status, 200);

  const refresh = await request('/api/auth/refresh', {
    method: 'POST',
    headers: { cookie: `hackhub_refresh=${tokens.refresh}` },
  });
  assert.equal(refresh.response.status, 200);
  const rotated = refreshCookie(refresh.response.headers.get('set-cookie'));
  assert.notEqual(rotated, tokens.refresh);

  const reused = await request('/api/auth/refresh', {
    method: 'POST',
    headers: { cookie: `hackhub_refresh=${tokens.refresh}` },
  });
  assert.equal(reused.response.status, 401);

  const logout = await request('/api/auth/logout', {
    method: 'POST',
    headers: { cookie: `hackhub_refresh=${rotated}` },
  });
  assert.equal(logout.response.status, 204);
  const clearedCookies = logout.response.headers.get('set-cookie');
  assert.match(clearedCookies, /hackhub_access=; Max-Age=0; Path=\/; HttpOnly; SameSite=Lax/);
  assert.match(clearedCookies, /hackhub_refresh=; Max-Age=0; Path=\/api\/auth; HttpOnly; SameSite=Lax/);
  const loggedOut = await request('/api/auth/refresh', {
    method: 'POST',
    headers: { cookie: `hackhub_refresh=${rotated}` },
  });
  assert.equal(loggedOut.response.status, 401);
});

test('allows only one concurrent rotation and keeps replay detection strict', async () => {
  const tokens = await login('mario@hackhub.it', 'test-user-demo-password-2026');
  const attempts = await Promise.all([
    request('/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: `hackhub_refresh=${tokens.refresh}` },
    }),
    request('/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: `hackhub_refresh=${tokens.refresh}` },
    }),
  ]);
  assert.deepEqual(attempts.map(({ response }) => response.status).sort(), [200, 401]);

  const successfulRefresh = attempts.find(({ response }) => response.status === 200);
  const rotated = refreshCookie(successfulRefresh.response.headers.get('set-cookie'));
  const replay = await request('/api/auth/refresh', {
    method: 'POST',
    headers: { cookie: `hackhub_refresh=${rotated}` },
  });
  assert.equal(replay.response.status, 401);
});

test('rejects expired JWT and invalid signature, issuer, and audience', async () => {
  const makeToken = (options = {}, signingSecret = process.env.HACKHUB_JWT_SECRET) => jwt.sign({ role: 'USER' }, signingSecret, {
    subject: '1',
    issuer: 'hackhub-api',
    audience: 'hackhub-web',
    ...options,
  });
  for (const token of [
    makeToken({ expiresIn: -1 }),
    makeToken({}, 'wrong-secret-that-is-at-least-32-characters'),
    makeToken({ issuer: 'wrong-issuer' }),
    makeToken({ audience: 'wrong-audience' }),
  ]) {
    const { response } = await request('/api/auth/profile', {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 401);
  }
});

test('isolates team invitations from non-members', async () => {
  const { access } = await login('mario@hackhub.it', 'test-user-demo-password-2026');
  const { response, body } = await request('/api/teams/999/invitations', {
    method: 'POST',
    headers: { authorization: `Bearer ${access}` },
    body: JSON.stringify({ email: 'giudice@hackhub.it' }),
  });
  assert.equal(response.status, 403);
  assert.equal(body.status, 403);
});

test('returns own submissions without exposing another user data', async () => {
  const { access } = await login('mario@hackhub.it', 'test-user-demo-password-2026');
  const { response, body } = await request('/api/submissions/mine', {
    headers: { authorization: `Bearer ${access}` },
  });
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body));
});

test('protects submission evaluation from non-judges', async () => {
  const { access } = await login('mario@hackhub.it', 'test-user-demo-password-2026');
  const { response, body } = await request('/api/submissions/1/evaluations', {
    method: 'POST',
    headers: { authorization: `Bearer ${access}` },
    body: JSON.stringify({ score: 10, comment: 'test' }),
  });
  assert.equal(response.status, 403);
  assert.equal(body.status, 403);
});

test('health reports database availability without exposing internal errors', async () => {
  const healthy = await request('/health');
  assert.equal(healthy.response.status, 200);
  assert.deepEqual(healthy.body, { status: 'ok' });

  database.close();
  databaseClosed = true;
  const unavailable = await request('/health');
  assert.equal(unavailable.response.status, 503);
  assert.deepEqual(unavailable.body, { status: 'unavailable' });
});
