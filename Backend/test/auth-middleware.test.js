const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');

process.env.HACKHUB_JWT_SECRET = 'middleware-test-secret-that-is-32-chars';
const { createAuthMiddleware } = require('../src/middleware/auth');
const { createAccessToken } = require('../src/security/jwt');

test('verifies access JWT locally without a session repository', () => {
  const { auth } = createAuthMiddleware();
  const request = {
    headers: { authorization: `Bearer ${createAccessToken({ id: 42, role: 'JUDGE' })}` },
  };
  let nextError;
  auth(request, {}, (error) => { nextError = error; });
  assert.equal(nextError, undefined);
  assert.deepEqual(request.user, { id: 42, role: 'JUDGE' });
});

test('rejects a token signed with a different algorithm', () => {
  const { auth } = createAuthMiddleware();
  const token = jwt.sign({ role: 'USER' }, process.env.HACKHUB_JWT_SECRET, {
    subject: '42',
    issuer: 'hackhub-api',
    audience: 'hackhub-web',
    algorithm: 'HS384',
  });
  let error;
  auth({ headers: { authorization: `Bearer ${token}` } }, {}, (nextError) => { error = nextError; });
  assert.equal(error.status, 401);
});
