const { HttpStatus, httpError } = require('../../http/http-errors');
const { requireServiceToken } = require('../../security/service-token');

const eventIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function registerEventRoutes({ app, serviceToken, inboxService }) {
  app.post('/internal/events', requireServiceToken(serviceToken), async (req, res, next) => {
    const { id, type, payload } = req.body ?? {};
    if (typeof id !== 'string' || !eventIdPattern.test(id)
      || typeof type !== 'string' || !type || type.length > 64
      || typeof payload !== 'object' || payload === null) {
      return next(httpError(HttpStatus.BAD_REQUEST, 'Evento non valido.'));
    }
    const status = await inboxService.receive({ id, type, payload });
    res.status(202).json({ status });
  });
}

module.exports = { registerEventRoutes };
