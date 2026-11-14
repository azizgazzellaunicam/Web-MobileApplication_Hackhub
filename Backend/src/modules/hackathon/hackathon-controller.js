function registerHackathonRoutes({
  app,
  auth,
  authOptional,
  role,
  hackathonService,
  gateway,
}) {
  app.get('/api/hackathons', authOptional, async (req, res) => {
    res.json(await gateway.list(req.user?.id));
  });
  app.put('/api/hackathons/:id/status', auth, role('ORGANIZER'), async (req, res) => {
    const status = req.body?.status === null || req.body?.status === '' ? null : req.body?.status;
    const item = await hackathonService.updateStatus(Number(req.params.id), req.user.id, status);
    res.json(await gateway.serialize(item));
  });
  app.put('/api/hackathons/:id', auth, role('ORGANIZER'), async (req, res) => {
    res.json(await gateway.serialize(await hackathonService.update(Number(req.params.id), req.user.id, req.body || {})));
  });
  app.delete('/api/hackathons/:id', auth, role('ORGANIZER'), async (req, res) => {
    await hackathonService.delete(Number(req.params.id), req.user.id);
    res.sendStatus(204);
  });
  app.get('/api/hackathons/assigned', auth, role('JUDGE', 'MENTOR'), async (req, res) => {
    res.json(await gateway.assigned(req.user.id));
  });
  app.get('/api/hackathons/evaluation', auth, role('JUDGE'), async (req, res) => {
    res.json(await gateway.evaluation(req.user.id));
  });
  app.get('/api/hackathons/:id', async (req, res) => {
    res.json(await gateway.detail(Number(req.params.id)));
  });
  app.get('/api/staff', auth, role('ORGANIZER'), async (_req, res) => {
    res.json(await hackathonService.staff());
  });
  app.post('/api/hackathons/:id/staff', auth, role('ORGANIZER'), async (req, res) => {
    await hackathonService.assignStaff(Number(req.params.id), req.user.id, req.body);
    res.status(201).json({ message: 'Staff assegnato.' });
  });
  app.post('/api/hackathons', auth, role('ORGANIZER'), async (req, res) => {
    res.status(201).json(await gateway.serialize(await hackathonService.create(req.user.id, req.body)));
  });
}

module.exports = { registerHackathonRoutes };
