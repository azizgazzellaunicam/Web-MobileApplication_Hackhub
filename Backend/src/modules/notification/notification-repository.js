const { BaseRepository } = require('../../repository/base-repository');

class NotificationRepository extends BaseRepository {
  async create(input) {
    const result = await this.run(`
      INSERT INTO notifications(user_id,type,title,message,entity_type,entity_id)
      VALUES (?,?,?,?,?,?)
    `, [input.userId, input.type, input.title, input.message, input.entityType, input.entityId]);
    return this.one('SELECT * FROM notifications WHERE id=?', [result.lastInsertRowid]);
  }

  async hasVictoryFor(userId, hackathonId) {
    return Boolean(await this.one(`
      SELECT 1 FROM notifications
      WHERE user_id=? AND type='VICTORY' AND entity_type='HACKATHON' AND entity_id=?
    `, [userId, hackathonId]));
  }

  async listForUser(userId) {
    return this.all(`
      SELECT id,type,title,message,entity_type,entity_id,created_at,read_at
      FROM notifications WHERE user_id=?
      ORDER BY created_at DESC, id DESC
    `, [userId]);
  }

  async countUnread(userId) {
    const row = await this.one('SELECT COUNT(*) AS count FROM notifications WHERE user_id=? AND read_at IS NULL', [userId]);
    return Number(row.count);
  }

  async markRead(userId, notificationId) {
    const result = await this.run(`
      UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP)
      WHERE id=? AND user_id=?
    `, [notificationId, userId]);
    return result.changes > 0;
  }
}

module.exports = { NotificationRepository };
