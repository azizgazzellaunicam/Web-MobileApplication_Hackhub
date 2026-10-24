function registerCompetitionRoutes({ app, auth, role, competitionService }) {
  app.post('/api/hackathons/:id/registrations', auth, (req, res, next) => {
    try { competitionService.register(req.user.id, Number(req.params.id)); res.status(201).json({ message: 'Team iscritto correttamente.' }); } catch (error) { next(error); }
  });
  app.post('/api/hackathons/:id/submissions', auth, (req, res, next) => {
    try { res.status(201).json(competitionService.createSubmission(req.user.id, Number(req.params.id), req.body?.content)); } catch (error) { next(error); }
  });
  app.get('/api/hackathons/:id/submissions', auth, (req, res, next) => {
    try { res.json(competitionService.submissions(req.user.id, Number(req.params.id))); } catch (error) { next(error); }
  });
  app.put('/api/submissions/:id', auth, (req, res, next) => {
    try { res.json(competitionService.updateSubmission(req.user.id, Number(req.params.id), req.body?.content)); } catch (error) { next(error); }
  });
  app.get('/api/submissions/mine', auth, (req, res) => res.json(competitionService.mine(req.user.id)));
  app.post('/api/submissions/:id/evaluations', auth, role('JUDGE'), (req, res, next) => {
    try { competitionService.evaluate(req.user.id, Number(req.params.id), req.body); res.status(201).json({ message: 'Valutazione registrata.' }); } catch (error) { next(error); }
  });
  app.get('/api/submissions/:id/evaluations', auth, (req, res, next) => {
    try { res.json(competitionService.evaluations(req.user.id, Number(req.params.id))); } catch (error) { next(error); }
  });
  app.get('/api/hackathons/:id/ranking', auth, (req, res, next) => {
    try { res.json(competitionService.ranking(req.user.id, Number(req.params.id))); } catch (error) { next(error); }
  });
}

module.exports = { registerCompetitionRoutes };
