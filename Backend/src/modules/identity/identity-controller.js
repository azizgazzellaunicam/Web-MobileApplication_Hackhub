const { HttpStatus, httpError } = require('../../http/http-errors');
const { accessTokenTtlSeconds, refreshTokenTtlSeconds } = require('../../security/jwt');

function registerIdentityRoutes({ app, auth, authService, userRepository }) {
  const cookie = (name, token, maxAge, path) => {
    const attributes = [`${name}=${token}`, `Max-Age=${maxAge}`, `Path=${path}`, 'HttpOnly', 'SameSite=Lax'];
    if (process.env.NODE_ENV === 'production') attributes.push('Secure');
    return attributes.join('; ');
  };
  const clearCookies = (res) => {
    res.setHeader('Set-Cookie', [
      cookie('hackhub_access', '', 0, '/'),
      cookie('hackhub_refresh', '', 0, '/api/auth'),
    ]);
  };
  const authResponse = (res, response) => {
    res.setHeader('Set-Cookie', [
      cookie('hackhub_access', response.accessToken, accessTokenTtlSeconds, '/'),
      cookie('hackhub_refresh', response.refreshToken, refreshTokenTtlSeconds, '/api/auth'),
    ]);
    const { accessToken, refreshToken, ...publicResponse } = response;
    res.json(publicResponse);
  };
  const refreshCookie = (req) => req.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('hackhub_refresh='))?.slice('hackhub_refresh='.length);

  app.post('/api/auth/register', async (req, res) => authResponse(res, await authService.register(req.body)));
  app.post('/api/auth/login', async (req, res) => authResponse(res, await authService.login(req.body)));
  app.post('/api/auth/refresh', async (req, res) => {
    authResponse(res, await authService.refresh(refreshCookie(req)));
  });
  app.post('/api/auth/logout', async (req, res) => {
    await authService.logout(refreshCookie(req));
    clearCookies(res);
    res.sendStatus(204);
  });
  app.get('/api/auth/profile', auth, async (req, res, next) => {
    const user = await userRepository.findById(req.user.id);
    if (!user) return next(httpError(HttpStatus.UNAUTHORIZED, 'Autenticazione richiesta.'));
    res.json(user);
  });
  app.put('/api/auth/profile', auth, async (req, res) => {
    const user = await authService.updateProfile(req.user.id, req.body);
    req.user.name = user.name;
    req.user.email = user.email;
    res.json(user);
  });
}

module.exports = { registerIdentityRoutes };
