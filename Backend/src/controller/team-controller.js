function registerTeamRoutes({ app, auth, role, teamService }) {
  app.get('/api/profile/teams', auth, (req, res) => res.json(teamService.listForUser(req.user.id)));
  app.get('/api/teams', auth, (req, res) => res.json(teamService.listForUser(req.user.id)));
  app.get('/api/teams/all', auth, role('ORGANIZER'), (_req, res) => res.json(teamService.listAll()));
  app.post('/api/teams', auth, (req, res, next) => {
    try { res.status(201).json(teamService.create(req.user.id, req.user.name, req.body?.name)); } catch (error) { next(error); }
  });
  app.delete('/api/teams/:id/membership', auth, (req, res, next) => {
    try { res.json(teamService.leave(Number(req.params.id), req.user.id)); } catch (error) { next(error); }
  });
  app.post('/api/teams/:id/invitations', auth, (req, res, next) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      res.status(201).json(teamService.invite(Number(req.params.id), req.user.id, email));
    } catch (error) { next(error); }
  });
  app.get('/api/invitations', auth, (req, res) => res.json(teamService.listInvitations(req.user.id)));
  app.post('/api/invitations/:id/:decision', auth, (req, res, next) => {
    try { res.json(teamService.decideInvitation(Number(req.params.id), req.user.id, req.params.decision)); } catch (error) { next(error); }
  });
}

module.exports = { registerTeamRoutes };
