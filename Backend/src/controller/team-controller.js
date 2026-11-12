function registerTeamRoutes({ app, auth, role, teamService }) {
  app.get('/api/profile/teams', auth, async (req, res) => res.json(await teamService.listForUser(req.user.id)));
  app.get('/api/teams', auth, async (req, res) => res.json(await teamService.listForUser(req.user.id)));
  app.get('/api/teams/all', auth, role('ORGANIZER'), async (_req, res) => res.json(await teamService.listAll()));
  app.post('/api/teams', auth, async (req, res) => {
    res.status(201).json(await teamService.create(req.user.id, req.user.name, req.body?.name));
  });
  app.delete('/api/teams/:id/membership', auth, async (req, res) => {
    res.json(await teamService.leave(Number(req.params.id), req.user.id));
  });
  app.post('/api/teams/:id/invitations', auth, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    res.status(201).json(await teamService.invite(Number(req.params.id), req.user.id, email));
  });
  app.get('/api/invitations', auth, async (req, res) => res.json(await teamService.listInvitations(req.user.id)));
  app.post('/api/invitations/:id/:decision', auth, async (req, res) => {
    res.json(await teamService.decideInvitation(Number(req.params.id), req.user.id, req.params.decision));
  });
}

module.exports = { registerTeamRoutes };
