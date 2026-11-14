const { HttpStatus, httpError } = require('../../http/http-errors');

function registerNotificationRoutes({ app, auth, notificationService }) {
  app.get('/api/notifications', auth, async (req, res) => {
    res.json({
      items: await notificationService.listForUser(req.user.id),
      unreadCount: await notificationService.unreadCount(req.user.id),
    });
  });
  app.get('/api/notifications/unread-count', auth, async (req, res) => {
    res.json({ unreadCount: await notificationService.unreadCount(req.user.id) });
  });
  app.put('/api/notifications/:id/read', auth, async (req, res) => {
    if (!await notificationService.markRead(req.user.id, Number(req.params.id))) {
      throw httpError(HttpStatus.NOT_FOUND, 'Notifica non trovata.');
    }
    res.sendStatus(204);
  });
}

module.exports = { registerNotificationRoutes };
