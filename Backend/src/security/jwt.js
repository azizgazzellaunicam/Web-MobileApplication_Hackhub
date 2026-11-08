const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const { HttpStatus, httpError } = require('../http/http-errors');

const accessTokenTtl = process.env.HACKHUB_ACCESS_TOKEN_TTL || '15m';
const refreshTokenTtlSeconds = Number(process.env.HACKHUB_REFRESH_TOKEN_TTL_SECONDS || 7 * 24 * 60 * 60);
const configuredSecret = process.env.HACKHUB_JWT_SECRET;
if (configuredSecret && configuredSecret.length < 32) {
  throw new Error('HACKHUB_JWT_SECRET deve contenere almeno 32 caratteri.');
}
if (process.env.NODE_ENV === 'production' && !configuredSecret) {
  throw new Error('In produzione HACKHUB_JWT_SECRET deve contenere almeno 32 caratteri.');
}
const secret = configuredSecret || randomBytes(32).toString('base64url');
if (!configuredSecret) {
  console.warn('HACKHUB_JWT_SECRET non configurata: uso una chiave casuale temporanea per lo sviluppo.');
}

const issuer = process.env.HACKHUB_JWT_ISSUER || 'hackhub-api';
const audience = process.env.HACKHUB_JWT_AUDIENCE || 'hackhub-web';
const algorithm = 'HS256';

function createAccessToken(user) {
  return jwt.sign({ role: user.role }, secret, {
    algorithm,
    subject: String(user.id),
    issuer,
    audience,
    expiresIn: accessTokenTtl,
  });
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, secret, {
      algorithms: [algorithm],
      issuer,
      audience,
    });
  } catch {
    throw httpError(HttpStatus.UNAUTHORIZED, 'Autenticazione richiesta.');
  }
}

function createRefreshToken() {
  return randomBytes(32).toString('base64url');
}

module.exports = {
  accessTokenTtl,
  refreshTokenTtlSeconds,
  issuer,
  audience,
  createAccessToken,
  verifyAccessToken,
  createRefreshToken,
};
