const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');

function hashPassword(password) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password, encoded) {
  const [algorithm, salt, expectedHex] = encoded.split('$');
  if (algorithm !== 'scrypt') return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(password, Buffer.from(salt, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, verifyPassword };
