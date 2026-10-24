const { HttpStatus, httpError } = require('../http/http-errors');

function createAuthMiddleware(sessions) {
  function auth(req, _res, next) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const session = token && sessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      return next(httpError(HttpStatus.UNAUTHORIZED, 'Autenticazione richiesta.'));
    }
    req.user = session.user;
    req.token = token;
    next();
  }

  function authOptional(req, _res, next) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const session = token && sessions.get(token);
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
