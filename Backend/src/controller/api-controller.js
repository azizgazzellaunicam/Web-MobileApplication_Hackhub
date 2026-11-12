const { HttpStatus, httpError } = require('../http/http-errors');
const { accessTokenTtlSeconds, refreshTokenTtlSeconds } = require('../security/jwt');

function registerApiRoutes({
  app,
  auth,
  authOptional,
  role,
  authService,
  userRepository,
  profileService,
  notificationService,
  hackathonService,
  competitionService,
  hackathon,
}) {
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

  app.post('/api/auth/register', async (req, res) => authResponse(res, await authService.register(req.body)));
  app.post('/api/auth/login', async (req, res) => authResponse(res, await authService.login(req.body)));
  app.post('/api/auth/refresh', async (req, res) => {
    const token = req.headers.cookie?.split(';').map((part) => part.trim())
      .find((part) => part.startsWith('hackhub_refresh='))?.slice('hackhub_refresh='.length);
    authResponse(res, await authService.refresh(token));
  });
  app.post('/api/auth/logout', async (req, res) => {
    const token = req.headers.cookie?.split(';').map((part) => part.trim())
      .find((part) => part.startsWith('hackhub_refresh='))?.slice('hackhub_refresh='.length);
    await authService.logout(token);
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

  app.get('/api/profile/wins', auth, async (req, res) => {
    res.json(await profileService.wins(req.user.id));
  });
  app.get('/api/notifications', auth, async (req, res) => {
    res.json({
      items: await notificationService.listForUser(req.user.id),
      unreadCount: await notificationService.unreadCount(req.user.id),
    });
  });
  app.get('/api/notifications/unread-count', auth, async (req, res) => {
    res.json({ unreadCount: await notificationService.unreadCount(req.user.id) });
  });
  app.put('/api/notifications/:id/read', auth, async (req, res) => {
    if (!await notificationService.markRead(req.user.id, Number(req.params.id))) {
      throw httpError(HttpStatus.NOT_FOUND, 'Notifica non trovata.');
    }
    res.sendStatus(204);
  });

  app.get('/api/hackathons', authOptional, async (req, res) => {
    res.json((await hackathonService.list(req.user?.id)).map(hackathon));
  });
  app.put('/api/hackathons/:id/status', auth, role('ORGANIZER'), async (req, res) => {
    const status = req.body?.status === null || req.body?.status === '' ? null : req.body?.status;
    const item = await hackathonService.updateStatus(Number(req.params.id), req.user.id, status);
    res.json(hackathon(item));
  });
  app.put('/api/hackathons/:id', auth, role('ORGANIZER'), async (req, res) => {
    res.json(hackathon(await hackathonService.update(Number(req.params.id), req.user.id, req.body || {})));
  });
  app.delete('/api/hackathons/:id', auth, role('ORGANIZER'), async (req, res) => {
    await hackathonService.delete(Number(req.params.id), req.user.id);
    res.sendStatus(204);
  });
  app.get('/api/hackathons/assigned', auth, role('JUDGE', 'MENTOR'), async (req, res) => {
    res.json((await hackathonService.assigned(req.user.id)).map(hackathon));
  });
  app.get('/api/hackathons/evaluation', auth, role('JUDGE'), async (req, res) => {
    res.json((await hackathonService.evaluation(req.user.id)).map(hackathon));
  });
  app.get('/api/hackathons/:id', async (req, res) => {
    res.json(hackathon(await hackathonService.detail(Number(req.params.id))));
  });
  app.get('/api/staff', auth, role('ORGANIZER'), async (_req, res) => {
    res.json(await hackathonService.staff());
  });
  app.post('/api/hackathons/:id/staff', auth, role('ORGANIZER'), async (req, res) => {
    await hackathonService.assignStaff(Number(req.params.id), req.user.id, req.body);
    res.status(201).json({ message: 'Staff assegnato.' });
  });
  app.post('/api/hackathons', auth, role('ORGANIZER'), async (req, res) => {
    res.status(201).json(hackathon(await hackathonService.create(req.user.id, req.body)));
  });
  app.post('/api/hackathons/:id/winner/auto', auth, role('ORGANIZER'), async (req, res) => {
    res.json(await competitionService.proclaimAuto(req.user.id, Number(req.params.id)));
  });
  app.post('/api/hackathons/:id/winner/:teamId', auth, role('ORGANIZER'), async (req, res) => {
    res.json(await competitionService.proclaimManual(
      req.user.id,
      Number(req.params.id),
      Number(req.params.teamId),
    ));
  });
}

module.exports = { registerApiRoutes };
