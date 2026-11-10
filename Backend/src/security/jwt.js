const jwt = require('jsonwebtoken');
const ms = require('ms');
const { randomBytes } = require('node:crypto');
const { HttpStatus, httpError } = require('../http/http-errors');

const accessTokenTtl = process.env.HACKHUB_ACCESS_TOKEN_TTL === undefined
  ? '15m'
  : process.env.HACKHUB_ACCESS_TOKEN_TTL;
const accessTokenTtlMilliseconds = ms(accessTokenTtl);
const accessTokenTtlSeconds = Math.floor(accessTokenTtlMilliseconds / 1000);
if (!Number.isSafeInteger(accessTokenTtlMilliseconds)
  || accessTokenTtlMilliseconds <= 0
  || !Number.isSafeInteger(accessTokenTtlSeconds)
  || accessTokenTtlSeconds <= 0) {
  throw new Error('HACKHUB_ACCESS_TOKEN_TTL deve essere una durata positiva valida di almeno un secondo.');
}

const refreshTokenTtlSeconds = process.env.HACKHUB_REFRESH_TOKEN_TTL_SECONDS === undefined
  ? 7 * 24 * 60 * 60
  : Number(process.env.HACKHUB_REFRESH_TOKEN_TTL_SECONDS);
if (!Number.isSafeInteger(refreshTokenTtlSeconds) || refreshTokenTtlSeconds <= 0) {
  throw new Error('HACKHUB_REFRESH_TOKEN_TTL_SECONDS deve essere un numero intero positivo.');
}

const configuredSecret = process.env.HACKHUB_JWT_SECRET;
if (configuredSecret && configuredSecret.length < 32) {
  throw new Error('HACKHUB_JWT_SECRET deve contenere almeno 32 caratteri.');
}
const runtimeEnvironment = process.env.NODE_ENV || 'development';
if (!configuredSecret && !['development', 'test'].includes(runtimeEnvironment)) {
  throw new Error('In produzione HACKHUB_JWT_SECRET deve contenere almeno 32 caratteri.');
}
const secret = configuredSecret || randomBytes(32).toString('base64url');
if (!configuredSecret && runtimeEnvironment === 'development') {
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
  accessTokenTtlSeconds,
  refreshTokenTtlSeconds,
  issuer,
  audience,
  createAccessToken,
  verifyAccessToken,
  createRefreshToken,
};
