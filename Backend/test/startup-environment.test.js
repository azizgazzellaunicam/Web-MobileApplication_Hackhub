const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { createInitializedDatabase, resetDatabase } = require('./helpers/mariadb-test-utils');

const backendDirectory = path.join(__dirname, '..');
const productionScript = `
  (async () => {
    const { createApp } = require('./src/app');
    const { app, database } = await createApp();
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
    const [rows] = await database.execute('SELECT COUNT(*) AS count FROM users');
    process.stdout.write(JSON.stringify({
      seededUsers: Number(rows[0].count) - 1,
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
    await database.end();
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
`;

function productionEnvironment(overrides = {}) {
  return {
    ...process.env,
    NODE_ENV: 'production',
    HACKHUB_JWT_SECRET: 'startup-test-secret-with-at-least-32-characters',
    DB_HOST: process.env.DB_HOST || '127.0.0.1',
    DB_PORT: process.env.DB_PORT || '3306',
    DB_USER: process.env.DB_USER || 'hackhub',
    DB_PASSWORD: process.env.DB_PASSWORD || 'hackhub',
    DB_NAME: process.env.DB_NAME || 'hackhub_test',
    ...overrides,
  };
}

function runNode(script, env) {
  return spawnSync(process.execPath, ['-e', script], {
    cwd: backendDirectory,
    encoding: 'utf8',
    env,
  });
}

test('production starts without seeding demos and sets secure auth cookies', async () => {
  const database = await createInitializedDatabase();
  await resetDatabase(database);
  await database.end();
  const result = runNode(productionScript, productionEnvironment());

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
