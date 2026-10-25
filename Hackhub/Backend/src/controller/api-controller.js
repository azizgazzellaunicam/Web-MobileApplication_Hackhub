function registerApiRoutes({
  app,
  auth,
  authOptional,
  role,
  authService,
  profileService,
  notificationService,
  hackathonService,
  competitionService,
  hackathon,
}) {
  const sessionCookie = (res, token, maxAge) => {
    const attributes = [`hackhub_session=${token}`, `Max-Age=${maxAge}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
    if (process.env.NODE_ENV === 'production') attributes.push('Secure');
    res.setHeader('Set-Cookie', attributes.join('; '));
  };
  const clearSessionCookie = (res) => {
    res.setHeader('Set-Cookie', 'hackhub_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
  };
  const authResponse = (res, response) => {
    sessionCookie(res, response.token, 8 * 60 * 60);
    res.json(response);
  };

  app.post('/api/auth/register', (req, res, next) => {
    try { authResponse(res, authService.register(req.body)); } catch (error) { next(error); }
  });
  app.post('/api/auth/login', (req, res, next) => {
    try { authResponse(res, authService.login(req.body)); } catch (error) { next(error); }
  });
  app.post('/api/auth/logout', auth, (req, res) => {
    authService.logout(req.token);
    clearSessionCookie(res);
    res.sendStatus(204);
  });
  app.get('/api/auth/profile', auth, (req, res) => res.json(req.user));
  app.put('/api/auth/profile', auth, (req, res, next) => {
    try {
      const user = authService.updateProfile(req.user.id, req.body);
      req.user.name = user.name;
      req.user.email = user.email;
      res.json(user);
    } catch (error) { next(error); }
  });

  app.get('/api/profile/wins', auth, (req, res) => {
    res.json(profileService.wins(req.user.id));
  });
  app.get('/api/notifications', auth, (req, res) => {
    res.json({
      items: notificationService.listForUser(req.user.id),
      unreadCount: notificationService.unreadCount(req.user.id),
    });
  });
  app.get('/api/notifications/unread-count', auth, (req, res) => {
    res.json({ unreadCount: notificationService.unreadCount(req.user.id) });
  });
  app.put('/api/notifications/:id/read', auth, (req, res, next) => {
    try {
      if (!notificationService.markRead(req.user.id, Number(req.params.id))) {
        const error = new Error('Notifica non trovata.');
        error.status = 404;
        throw error;
      }
      res.sendStatus(204);
    } catch (error) { next(error); }
  });

  app.get('/api/hackathons', authOptional, (req, res) => {
    res.json(hackathonService.list(req.user?.id).map(hackathon));
  });
  app.put('/api/hackathons/:id/status', auth, role('ORGANIZER'), (req, res, next) => {
    try {
      const status = req.body?.status === null || req.body?.status === '' ? null : req.body?.status;
      const item = hackathonService.updateStatus(Number(req.params.id), req.user.id, status);
      res.json(hackathon(item));
    } catch (error) { next(error); }
  });
  app.put('/api/hackathons/:id', auth, role('ORGANIZER'), (req, res, next) => {
    try { res.json(hackathon(hackathonService.update(Number(req.params.id), req.user.id, req.body || {}))); } catch (error) { next(error); }
  });
  app.delete('/api/hackathons/:id', auth, role('ORGANIZER'), (req, res, next) => {
    try {
      hackathonService.delete(Number(req.params.id), req.user.id);
      res.sendStatus(204);
    } catch (error) { next(error); }
  });
  app.get('/api/hackathons/assigned', auth, role('JUDGE', 'MENTOR'), (req, res) => {
    res.json(hackathonService.assigned(req.user.id).map(hackathon));
  });
  app.get('/api/hackathons/evaluation', auth, role('JUDGE'), (req, res) => {
    res.json(hackathonService.evaluation(req.user.id).map(hackathon));
  });
  app.get('/api/hackathons/:id', (req, res, next) => {
    try { res.json(hackathon(hackathonService.detail(Number(req.params.id)))); } catch (error) { next(error); }
  });
  app.get('/api/staff', auth, role('ORGANIZER'), (_req, res) => {
    res.json(hackathonService.staff());
  });
  app.post('/api/hackathons/:id/staff', auth, role('ORGANIZER'), (req, res, next) => {
    try {
      hackathonService.assignStaff(Number(req.params.id), req.user.id, req.body);
      res.status(201).json({ message: 'Staff assegnato.' });
    } catch (error) { next(error); }
  });
  app.post('/api/hackathons', auth, role('ORGANIZER'), (req, res, next) => {
    try {
      res.status(201).json(hackathon(hackathonService.create(req.user.id, req.body)));
    } catch (error) { next(error); }
  });
  app.post('/api/hackathons/:id/winner/auto', auth, role('ORGANIZER'), (req, res, next) => {
    try {
      res.json(competitionService.proclaimAuto(req.user.id, Number(req.params.id)));
    } catch (error) { next(error); }
  });
  app.post('/api/hackathons/:id/winner/:teamId', auth, role('ORGANIZER'), (req, res, next) => {
    try {
      res.json(competitionService.proclaimManual(
        req.user.id,
        Number(req.params.id),
        Number(req.params.teamId),
      ));
    } catch (error) { next(error); }
  });
}

module.exports = { registerApiRoutes };
