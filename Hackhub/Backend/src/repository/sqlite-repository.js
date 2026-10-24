class SqliteRepository {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return this.database.prepare(sql);
  }

  exec(sql) {
    return this.database.exec(sql);
  }

  listHackathons() {
    return this.prepare('SELECT * FROM hackathons ORDER BY start_date').all();
  }

  listStaff() {
    return this.prepare("SELECT id,name,email,role FROM users WHERE role IN ('JUDGE','MENTOR') ORDER BY role,name")
      .all();
  }

  findUserByEmail(email) {
    return this.prepare('SELECT id,name,email,role,password_hash FROM users WHERE email=?')
      .get(email);
  }

  createUser(name, email, passwordHash) {
    return this.prepare('INSERT INTO users(name,email,password_hash) VALUES (?,?,?)')
      .run(name, email, passwordHash);
  }

  findUserByEmailExcept(email, userId) {
    return this.prepare('SELECT 1 FROM users WHERE email=? AND id<>?').get(email, userId);
  }

  updateUserProfile(userId, name, email) {
    this.prepare('UPDATE users SET name=?,email=? WHERE id=?').run(name, email, userId);
    return this.findUserById(userId);
  }

  findUserById(id) {
    return this.prepare('SELECT id,name,email,role FROM users WHERE id=?')
      .get(id);
  }

  createNotification(input) {
    const result = this.prepare(`
      INSERT INTO notifications(user_id,type,title,message,entity_type,entity_id)
      VALUES (?,?,?,?,?,?)
    `).run(input.userId, input.type, input.title, input.message, input.entityType, input.entityId);
    return this.prepare('SELECT * FROM notifications WHERE id=?').get(result.lastInsertRowid);
  }

  syncVictoryNotifications(userId) {
    this.prepare(`
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
          WHERE n.user_id=tm.user_id
            AND n.type='VICTORY'
            AND n.entity_type='HACKATHON'
            AND n.entity_id=h.id
        )
    `).run(userId);
  }

  listNotificationsForUser(userId) {
    return this.prepare(`
      SELECT id,type,title,message,entity_type,entity_id,created_at,read_at
      FROM notifications
      WHERE user_id=?
      ORDER BY datetime(created_at) DESC, id DESC
    `).all(userId);
  }

  countUnreadNotifications(userId) {
    return this.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id=? AND read_at IS NULL').get(userId).count;
  }

  markNotificationRead(userId, notificationId) {
    const result = this.prepare(`
      UPDATE notifications
      SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP)
      WHERE id=? AND user_id=?
    `).run(notificationId, userId);
    return result.changes > 0;
  }

  findHackathonById(id) {
    return this.prepare('SELECT * FROM hackathons WHERE id=?').get(id);
  }

  findHackathonStaff(id) {
    return this.prepare('SELECT user_id,role FROM hackathon_staff WHERE hackathon_id=?').all(id);
  }

  updateHackathon(id, input) {
    this.exec('BEGIN');
    try {
      this.prepare(`
        UPDATE hackathons
        SET name=?, regulation=?, registration_deadline=?, start_date=?, end_date=?,
            location=?, prize=?, max_team_size=?
        WHERE id=?
      `).run(
        input.name,
        input.regulation,
        input.registrationDeadline,
        input.startDate,
        input.endDate,
        input.location,
        input.prize,
        input.maxTeamSize,
        id,
      );
      this.prepare('DELETE FROM hackathon_staff WHERE hackathon_id=?').run(id);
      const staff = this.prepare('INSERT INTO hackathon_staff(hackathon_id,user_id,role) VALUES(?,?,?)');
      staff.run(id, input.judgeId, 'JUDGE');
      staff.run(id, input.mentorId, 'MENTOR');
      this.exec('COMMIT');
      return this.findHackathonById(id);
    } catch (error) {
      this.exec('ROLLBACK');
      throw error;
    }
  }

  deleteHackathon(id) {
    this.exec('BEGIN');
    try {
      this.prepare('DELETE FROM hackathons WHERE id=?').run(id);
      this.exec('COMMIT');
    } catch (error) {
      this.exec('ROLLBACK');
      throw error;
    }
  }
}

module.exports = { SqliteRepository };
