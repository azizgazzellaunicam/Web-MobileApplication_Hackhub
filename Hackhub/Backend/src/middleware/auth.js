const { HttpStatus, httpError } = require('../http/http-errors');

function createAuthMiddleware(sessions) {
  function tokenFromRequest(req) {
    const authorizationToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (authorizationToken) return authorizationToken;
    const cookieHeader = req.headers.cookie || '';
    return cookieHeader.split(';').map((part) => part.trim())
      .find((part) => part.startsWith('hackhub_session='))
      ?.slice('hackhub_session='.length);
  }

  function auth(req, _res, next) {
    const token = tokenFromRequest(req);
    const session = token && sessions.findValid(token);
    if (!session || session.expiresAt < Date.now()) {
      return next(httpError(HttpStatus.UNAUTHORIZED, 'Autenticazione richiesta.'));
    }
    req.user = session.user;
    req.token = token;
    next();
  }

  function authOptional(req, _res, next) {
    const token = tokenFromRequest(req);
    const session = token && sessions.findValid(token);
    if (session && session.expiresAt >= Date.now()) req.user = session.user;
    next();
  }

  function role(...roles) {
    return (req, _res, next) => roles.includes(req.user.role)
      ? next()
      : next(httpError(HttpStatus.FORBIDDEN, 'Operazione non autorizzata.'));
  }

  return { auth, authOptional, role };
}

module.exports = { createAuthMiddleware };
