const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../src/database/connection');
const { initializeSchema } = require('../src/database/schema');

const backendDirectory = path.join(__dirname, '..');
const productionScript = `
  (async () => {
    const { app, database } = require('./src/app');
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = 'http://127.0.0.1:' + server.address().port;
    const register = await fetch(baseUrl + '/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'production@example.com',
        password: 'production-test-password',
        name: 'Production Test'
      })
    });
    const registrationCookie = register.headers.get('set-cookie');
    const refreshToken = registrationCookie.match(/hackhub_refresh=([^;,]+)/)[1];
    const refresh = await fetch(baseUrl + '/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: 'hackhub_refresh=' + refreshToken }
    });
    const refreshCookie = refresh.headers.get('set-cookie');
    const rotatedToken = refreshCookie.match(/hackhub_refresh=([^;,]+)/)[1];
    const logout = await fetch(baseUrl + '/api/auth/logout', {
      method: 'POST',
      headers: { cookie: 'hackhub_refresh=' + rotatedToken }
    });
    process.stdout.write(JSON.stringify({
      seededUsers: database.prepare('SELECT COUNT(*) AS count FROM users').get().count - 1,
      registrationStatus: register.status,
      refreshStatus: refresh.status,
      logoutStatus: logout.status,
      tokensInJson: /accessToken|refreshToken/.test(await register.clone().text()),
      secureCookies: registrationCookie.includes('; Secure')
        && refreshCookie.includes('; Secure')
        && logout.headers.get('set-cookie').includes('; Secure'),
      cookiePaths: registrationCookie.includes('Path=/;')
        && registrationCookie.includes('Path=/api/auth;')
        && logout.headers.get('set-cookie').includes('Path=/api/auth;')
    }));
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
`;

function productionEnvironment(databasePath, overrides = {}) {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    HACKHUB_DB_PATH: databasePath,
    HACKHUB_JWT_SECRET: 'startup-test-secret-with-at-least-32-characters',
    ...overrides,
  };
  if (!Object.hasOwn(overrides, 'HACKHUB_SEED_DEMO')) delete env.HACKHUB_SEED_DEMO;
  return env;
}

function runNode(script, env) {
  return spawnSync(process.execPath, ['-e', script], {
    cwd: backendDirectory,
    encoding: 'utf8',
    env,
  });
}

test('production starts without seeding demos and sets secure auth cookies', (context) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'hackhub-production-'));
  context.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));
  const result = runNode(productionScript, productionEnvironment(path.join(temporaryDirectory, 'data.sqlite')));

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    seededUsers: 0,
    registrationStatus: 200,
    refreshStatus: 200,
    logoutStatus: 204,
    tokensInJson: false,
    secureCookies: true,
    cookiePaths: true,
  });
});

test('production refuses to start when demo accounts exist', (context) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'hackhub-production-demo-'));
  context.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));
  const databasePath = path.join(temporaryDirectory, 'data.sqlite');
  const database = createDatabase(databasePath);
  initializeSchema(database);
  database.prepare(
    "INSERT INTO users(name,email,password_hash) VALUES('Demo','mario@hackhub.it','hash')",
  ).run();
  database.close();

  const result = runNode("require('./src/app')", productionEnvironment(databasePath));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Account demo rilevato/);
});

test('production refuses to start when demo seeding is explicitly enabled', (context) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'hackhub-production-seed-'));
  context.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));
  const result = runNode(
    "require('./src/app')",
    productionEnvironment(path.join(temporaryDirectory, 'data.sqlite'), { HACKHUB_SEED_DEMO: 'true' }),
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /non può essere abilitato in produzione/);
});
