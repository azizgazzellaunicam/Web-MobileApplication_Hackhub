function registerSupportRoutes({ app, auth, role, supportService }) {
  app.post('/api/support-requests', auth, (req, res, next) => { try { res.status(201).json(supportService.create(req.user.id, req.body)); } catch (error) { next(error); } });
  app.post('/api/support-requests/report', auth, role('MENTOR'), (req, res, next) => { try { res.status(201).json(supportService.report(req.user.id, req.body)); } catch (error) { next(error); } });
  app.get('/api/support-requests/open', auth, role('MENTOR'), (req, res) => res.json(supportService.open(req.user.id)));
  app.get('/api/support-requests/:id', auth, (req, res, next) => { try { res.json(supportService.details(req.user.id, Number(req.params.id))); } catch (error) { next(error); } });
  app.get('/api/hackathons/:id/support-requests', auth, (req, res, next) => { try { res.json(supportService.listForHackathon(req.user.id, Number(req.params.id))); } catch (error) { next(error); } });
  app.post('/api/support-requests/:id/calls', auth, role('MENTOR'), (req, res, next) => { try { res.status(201).json(supportService.schedule(req.user.id, Number(req.params.id), req.body)); } catch (error) { next(error); } });
  app.post('/api/support-requests/:id/close', auth, (req, res, next) => { try { supportService.close(req.user.id, Number(req.params.id)); res.sendStatus(204); } catch (error) { next(error); } });
}

module.exports = { registerSupportRoutes };
