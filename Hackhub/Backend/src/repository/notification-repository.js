class NotificationRepository {
  constructor(database) {
    this.database = database;
  }

  create(input) {
    const result = this.database.prepare(`
      INSERT INTO notifications(user_id,type,title,message,entity_type,entity_id)
      VALUES (?,?,?,?,?,?)
    `).run(input.userId, input.type, input.title, input.message, input.entityType, input.entityId);
    return this.database.prepare('SELECT * FROM notifications WHERE id=?').get(result.lastInsertRowid);
  }

  syncVictories(userId) {
    this.database.prepare(`
      INSERT INTO notifications(user_id,type,title,message,entity_type,entity_id)
      SELECT tm.user_id, 'VICTORY', 'Hai vinto un hackathon',
             'Il tuo team ' || t.name || ' ha vinto ' || h.name || '.',
             'HACKATHON', h.id
      FROM team_members tm
      JOIN teams t ON t.id=tm.team_id
      JOIN hackathons h ON h.winner_team_id=tm.team_id
      WHERE tm.user_id=?
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.user_id=tm.user_id AND n.type='VICTORY'
            AND n.entity_type='HACKATHON' AND n.entity_id=h.id
        )
    `).run(userId);
  }

  listForUser(userId) {
    return this.database.prepare(`
      SELECT id,type,title,message,entity_type,entity_id,created_at,read_at
      FROM notifications WHERE user_id=?
      ORDER BY datetime(created_at) DESC, id DESC
    `).all(userId);
  }

  countUnread(userId) {
    return this.database.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id=? AND read_at IS NULL')
      .get(userId).count;
  }

  markRead(userId, notificationId) {
    const result = this.database.prepare(`
      UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP)
      WHERE id=? AND user_id=?
    `).run(notificationId, userId);
    return result.changes > 0;
  }
}

module.exports = { NotificationRepository };
