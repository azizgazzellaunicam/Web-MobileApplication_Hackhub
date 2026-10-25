class TeamRepository {
  constructor(database) {
    this.database = database;
  }

  listForUser(userId) {
    return this.database.prepare(`
      SELECT t.id, t.name, GROUP_CONCAT(u.name) AS members,
        NOT EXISTS (
          SELECT 1
          FROM registrations r
          JOIN hackathons h ON h.id=r.hackathon_id
          WHERE r.team_id=t.id
            AND datetime(h.start_date) <= datetime('now')
        ) AS can_leave
      FROM teams t JOIN team_members tm ON tm.team_id=t.id JOIN users u ON u.id=tm.user_id
      WHERE t.id IN (SELECT team_id FROM team_members WHERE user_id=?) GROUP BY t.id
    `).all(userId);
  }

  listAll() {
    return this.database.prepare(`
      SELECT t.id,t.name,GROUP_CONCAT(u.name) AS members
      FROM teams t JOIN team_members tm ON tm.team_id=t.id JOIN users u ON u.id=tm.user_id
      GROUP BY t.id ORDER BY t.name
    `).all();
  }

  findById(id) {
    return this.database.prepare('SELECT id,name FROM teams WHERE id=?').get(id);
  }

  findByMember(userId) {
    return this.database.prepare('SELECT team_id FROM team_members WHERE user_id=?').get(userId);
  }

  findMember(teamId, userId) {
    return this.database.prepare('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?').get(teamId, userId);
  }

  hasStartedRegistration(teamId) {
    return this.database.prepare(`
      SELECT 1
      FROM registrations r
      JOIN hackathons h ON h.id=r.hackathon_id
      WHERE r.team_id=?
        AND datetime(h.start_date) <= datetime('now')
      LIMIT 1
    `).get(teamId);
  }

  removeMember(teamId, userId) {
    return this.database.prepare('DELETE FROM team_members WHERE team_id=? AND user_id=?').run(teamId, userId);
  }

  create(name, userId) {
    const result = this.database.prepare('INSERT INTO teams(name) VALUES(?)').run(name);
    this.database.prepare('INSERT INTO team_members(team_id,user_id) VALUES(?,?)').run(result.lastInsertRowid, userId);
    return { id: result.lastInsertRowid, name };
  }

  findUserByEmail(email) {
    return this.database.prepare('SELECT id FROM users WHERE email=?').get(email);
  }

  findInvitation(id, userId) {
    return this.database.prepare(`
      SELECT * FROM team_invitations
      WHERE id=? AND invited_user_id=? AND status='IN_ATTESA'
    `).get(id, userId);
  }

  listInvitations(userId) {
    return this.database.prepare(`
      SELECT i.*, t.name AS team_name, u.email AS invited_email
      FROM team_invitations i JOIN teams t ON t.id=i.team_id JOIN users u ON u.id=i.invited_user_id
      WHERE i.invited_user_id=? ORDER BY i.sent_at DESC
    `).all(userId);
  }

  createInvitation(teamId, invitedUserId, inviterUserId) {
    const result = this.database.prepare(`
      INSERT INTO team_invitations(team_id,invited_user_id,inviter_user_id) VALUES(?,?,?)
    `).run(teamId, invitedUserId, inviterUserId);
    return this.database.prepare('SELECT * FROM team_invitations WHERE id=?').get(result.lastInsertRowid);
  }

  hasPendingInvitation(teamId, invitedUserId) {
    return this.database.prepare(`
      SELECT 1 FROM team_invitations
      WHERE team_id=? AND invited_user_id=? AND status='IN_ATTESA'
    `).get(teamId, invitedUserId);
  }

  setInvitationStatus(invitationId, teamId, status, userId) {
    if (status === 'ACCETTATO') {
      this.database.prepare('INSERT INTO team_members(team_id,user_id) VALUES(?,?)').run(teamId, userId);
    }
    this.database.prepare('UPDATE team_invitations SET status=? WHERE id=?').run(status, invitationId);
  }
}

module.exports = { TeamRepository };
