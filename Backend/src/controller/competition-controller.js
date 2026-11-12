function registerCompetitionRoutes({ app, auth, role, competitionService }) {
  app.post('/api/hackathons/:id/registrations', auth, async (req, res) => {
    await competitionService.register(req.user.id, Number(req.params.id));
    res.status(201).json({ message: 'Team iscritto correttamente.' });
  });
  app.post('/api/hackathons/:id/submissions', auth, async (req, res) => {
    res.status(201).json(await competitionService.createSubmission(req.user.id, Number(req.params.id), req.body?.content));
  });
  app.get('/api/hackathons/:id/submissions', auth, async (req, res) => {
    res.json(await competitionService.submissions(req.user.id, Number(req.params.id)));
  });
  app.put('/api/submissions/:id', auth, async (req, res) => {
    res.json(await competitionService.updateSubmission(req.user.id, Number(req.params.id), req.body?.content));
  });
  app.get('/api/submissions/mine', auth, async (req, res) => res.json(await competitionService.mine(req.user.id)));
  app.post('/api/submissions/:id/evaluations', auth, role('JUDGE'), async (req, res) => {
    await competitionService.evaluate(req.user.id, Number(req.params.id), req.body);
    res.status(201).json({ message: 'Valutazione registrata.' });
  });
  app.get('/api/submissions/:id/evaluations', auth, async (req, res) => {
    res.json(await competitionService.evaluations(req.user.id, Number(req.params.id)));
  });
  app.get('/api/hackathons/:id/ranking', auth, async (req, res) => {
    res.json(await competitionService.ranking(req.user.id, Number(req.params.id)));
  });
}

module.exports = { registerCompetitionRoutes };
