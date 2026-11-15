const { createHash, timingSafeEqual } = require('node:crypto');
const { HttpStatus, httpError } = require('../http/http-errors');

const serviceTokenHeader = 'x-hackhub-service-token';
const minimumServiceTokenLength = 32;

function readServiceToken(env = process.env) {
  const token = env.HACKHUB_SERVICE_TOKEN || '';
  if (token.length < minimumServiceTokenLength) {
    throw new Error(`HACKHUB_SERVICE_TOKEN deve contenere almeno ${minimumServiceTokenLength} caratteri.`);
  }
  return token;
}

function digest(value) {
  return createHash('sha256').update(String(value)).digest();
}

function requireServiceToken(expectedToken) {
  const expectedDigest = digest(expectedToken);
  return (req, _res, next) => timingSafeEqual(digest(req.get(serviceTokenHeader) ?? ''), expectedDigest)
    ? next()
    : next(httpError(HttpStatus.UNAUTHORIZED, 'Token di servizio non valido.'));
}

module.exports = { readServiceToken, requireServiceToken, serviceTokenHeader };
