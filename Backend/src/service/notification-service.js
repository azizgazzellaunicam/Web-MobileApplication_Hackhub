const { HttpStatus, httpError } = require('../http/http-errors');

class NotificationService {
  constructor(repository) {
    this.repository = repository;
  }

  create(userId, type, title, message, entityType = null, entityId = null) {
    return this.repository.create({
      userId,
      type,
      title,
      message,
      entityType,
      entityId,
    });
  }

  listForUser(userId) {
    this.repository.syncVictories(userId);
    return this.repository.listForUser(userId);
  }

  unreadCount(userId) {
    this.repository.syncVictories(userId);
    return this.repository.countUnread(userId);
  }

  markRead(userId, notificationId) {
    if (!Number.isInteger(notificationId) || notificationId < 1) {
      throw httpError(HttpStatus.BAD_REQUEST, 'Notifica non valida.');
    }
    return this.repository.markRead(userId, notificationId);
  }
}

module.exports = { NotificationService };
