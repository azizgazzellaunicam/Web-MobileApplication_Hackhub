const { HttpStatus, httpError } = require('../../http/http-errors');

class NotificationService {
  constructor(repository, victoriesProvider) {
    this.repository = repository;
    this.victoriesProvider = victoriesProvider;
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
    await this.syncVictories(userId);
    return this.repository.listForUser(userId);
  }

  async unreadCount(userId) {
    await this.syncVictories(userId);
    return this.repository.countUnread(userId);
  }

  async markRead(userId, notificationId) {
    if (!Number.isInteger(notificationId) || notificationId < 1) {
      throw httpError(HttpStatus.BAD_REQUEST, 'Notifica non valida.');
    }
    return this.repository.markRead(userId, notificationId);
  }

  // Temporary bridge until Phase 4 events: backfills victory notifications for hackathons won by the user's team.
  async syncVictories(userId) {
    for (const victory of await this.victoriesProvider(userId)) {
      if (await this.repository.hasVictoryFor(userId, victory.id)) continue;
      await this.create(
        userId,
        'VICTORY',
        'Hai vinto un hackathon',
        `Il tuo team ${victory.teamName} ha vinto ${victory.name}.`,
        'HACKATHON',
        victory.id,
      );
    }
  }
}

module.exports = { NotificationService };
