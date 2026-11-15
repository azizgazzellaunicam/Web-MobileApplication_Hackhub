const { HttpStatus, httpError } = require('../../http/http-errors');
const { requireServiceToken } = require('../../security/service-token');

const maxLookupIds = 500;

function registerIdentityInternalRoutes({ app, serviceToken, userRepository }) {
  app.use('/internal', requireServiceToken(serviceToken));

  app.get('/internal/users/by-email', async (req, res, next) => {
    const email = String(req.query.email ?? '');
    const user = await userRepository.findIdByEmail(email);
    if (!user) return next(httpError(HttpStatus.NOT_FOUND, 'Utente non trovato.'));
    res.json({ id: user.id });
  });

  app.post('/internal/users/lookup', async (req, res, next) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length > maxLookupIds) {
      return next(httpError(HttpStatus.BAD_REQUEST, 'Elenco di identificativi non valido.'));
    }
    res.json(await userRepository.findByIds(ids));
  });

  app.get('/internal/users/:id/roles/:role', async (req, res, next) => {
    const user = await userRepository.findUserWithRole(req.params.id, req.params.role);
    if (!user) return next(httpError(HttpStatus.NOT_FOUND, 'Utente non trovato.'));
    res.json({ id: user.id });
  });

  app.get('/internal/users/:id', async (req, res, next) => {
    const user = await userRepository.findById(req.params.id);
    if (!user) return next(httpError(HttpStatus.NOT_FOUND, 'Utente non trovato.'));
    res.json(user);
  });

  app.get('/internal/staff-candidates', async (_req, res) => {
    res.json(await userRepository.listStaffCandidates());
  });
}

module.exports = { registerIdentityInternalRoutes };
