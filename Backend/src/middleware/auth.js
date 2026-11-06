const { HttpStatus, httpError } = require('../http/http-errors');
const { verifyAccessToken } = require('../security/jwt');

function tokenFromRequest(req) {
  const authorization = req.headers.authorization || '';
  const bearer = authorization.match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1];
  const cookieHeader = req.headers.cookie || '';
  return cookieHeader.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('hackhub_access='))
    ?.slice('hackhub_access='.length);
}

function createAuthMiddleware() {
  function auth(req, _res, next) {
    const token = tokenFromRequest(req);
    if (!token) return next(httpError(HttpStatus.UNAUTHORIZED, 'Autenticazione richiesta.'));
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: Number(payload.sub), role: payload.role };
      req.accessToken = token;
      next();
    } catch (error) {
      next(error);
    }
  }

  function authOptional(req, _res, next) {
    const token = tokenFromRequest(req);
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        req.user = { id: Number(payload.sub), role: payload.role };
      } catch {
        // Optional authentication must not make a public route fail.
      }
    }
    next();
  }

  function role(...roles) {
    return (req, _res, next) => roles.includes(req.user.role)
      ? next()
      : next(httpError(HttpStatus.FORBIDDEN, 'Operazione non autorizzata.'));
  }

  return { auth, authOptional, role };
}

module.exports = { createAuthMiddleware, tokenFromRequest };
