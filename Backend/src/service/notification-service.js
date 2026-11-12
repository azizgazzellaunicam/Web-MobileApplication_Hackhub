const { HttpStatus, httpError } = require('../http/http-errors');

class NotificationService {
  constructor(repository) {
    this.repository = repository;
  }

  async create(userId, type, title, message, entityType = null, entityId = null) {
    return this.repository.create({
      userId,
      type,
      title,
      message,
      entityType,
      entityId,
    });
  }

  async listForUser(userId) {
    await this.repository.syncVictories(userId);
    return this.repository.listForUser(userId);
  }

  async unreadCount(userId) {
    await this.repository.syncVictories(userId);
    return this.repository.countUnread(userId);
  }

  async markRead(userId, notificationId) {
    if (!Number.isInteger(notificationId) || notificationId < 1) {
      throw httpError(HttpStatus.BAD_REQUEST, 'Notifica non valida.');
    }
    return this.repository.markRead(userId, notificationId);
  }
}

module.exports = { NotificationService };
