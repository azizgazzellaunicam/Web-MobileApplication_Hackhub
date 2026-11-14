function registerSupportRoutes({ app, auth, role, supportService }) {
  app.post('/api/support-requests', auth, async (req, res) => { res.status(201).json(await supportService.create(req.user.id, req.body)); });
  app.post('/api/support-requests/report', auth, role('MENTOR'), async (req, res) => { res.status(201).json(await supportService.report(req.user.id, req.body)); });
  app.get('/api/support-requests/open', auth, role('MENTOR'), async (req, res) => res.json(await supportService.open(req.user.id)));
  app.get('/api/support-requests/mine', auth, async (req, res) => res.json(await supportService.mine(req.user.id)));
  app.get('/api/hackathons/:id/teams', auth, async (req, res) => { res.json(await supportService.teams(req.user.id, Number(req.params.id))); });
  app.get('/api/support-requests/:id', auth, async (req, res) => { res.json(await supportService.details(req.user.id, Number(req.params.id))); });
  app.get('/api/hackathons/:id/support-requests', auth, async (req, res) => { res.json(await supportService.listForHackathon(req.user.id, Number(req.params.id))); });
  app.post('/api/support-requests/:id/calls', auth, role('MENTOR'), async (req, res) => { res.status(201).json(await supportService.schedule(req.user.id, Number(req.params.id), req.body)); });
  app.post('/api/support-requests/:id/close', auth, async (req, res) => { await supportService.close(req.user.id, Number(req.params.id)); res.sendStatus(204); });
}

module.exports = { registerSupportRoutes };
