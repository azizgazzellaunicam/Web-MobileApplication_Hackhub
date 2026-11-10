const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const path = require('node:path');

const backendDirectory = path.join(__dirname, '..');
const configScript = `
  const config = require('./src/security/jwt');
  process.stdout.write(JSON.stringify({
    accessTokenTtl: config.accessTokenTtl,
    accessTokenTtlSeconds: config.accessTokenTtlSeconds,
    refreshTokenTtlSeconds: config.refreshTokenTtlSeconds
  }));
`;

function runConfig(overrides = {}) {
  const env = { ...process.env, ...overrides };
  for (const key of [
    'HACKHUB_ACCESS_TOKEN_TTL',
    'HACKHUB_REFRESH_TOKEN_TTL_SECONDS',
    'HACKHUB_JWT_SECRET',
  ]) {
    if (!(key in overrides)) delete env[key];
  }
  return spawnSync(process.execPath, ['-e', configScript], {
    cwd: backendDirectory,
    encoding: 'utf8',
    env,
  });
}

test('uses the JWT duration parser and exposes the effective access cookie TTL', () => {
  const result = runConfig({
    NODE_ENV: 'test',
    HACKHUB_ACCESS_TOKEN_TTL: '1.5h',
    HACKHUB_REFRESH_TOKEN_TTL_SECONDS: '3600',
    HACKHUB_JWT_SECRET: 'jwt-config-test-secret-that-has-32-chars',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    accessTokenTtl: '1.5h',
    accessTokenTtlSeconds: 5400,
    refreshTokenTtlSeconds: 3600,
  });
});

test('rejects invalid access and refresh token TTL configuration at startup', () => {
  for (const overrides of [
    { NODE_ENV: 'test', HACKHUB_ACCESS_TOKEN_TTL: 'invalid' },
    { NODE_ENV: 'test', HACKHUB_ACCESS_TOKEN_TTL: '-2h' },
    { NODE_ENV: 'test', HACKHUB_ACCESS_TOKEN_TTL: '500ms' },
    { NODE_ENV: 'test', HACKHUB_REFRESH_TOKEN_TTL_SECONDS: '0' },
    { NODE_ENV: 'test', HACKHUB_REFRESH_TOKEN_TTL_SECONDS: '-60' },
    { NODE_ENV: 'test', HACKHUB_REFRESH_TOKEN_TTL_SECONDS: 'not-a-number' },
  ]) {
    const result = runConfig(overrides);
    assert.notEqual(result.status, 0, JSON.stringify(overrides));
  }
});

test('requires a configured secret outside development and test', () => {
  for (const nodeEnvironment of ['production', 'staging']) {
    const result = runConfig({ NODE_ENV: nodeEnvironment });
    assert.notEqual(result.status, 0, nodeEnvironment);
    assert.match(result.stderr, /HACKHUB_JWT_SECRET/);
  }
});
