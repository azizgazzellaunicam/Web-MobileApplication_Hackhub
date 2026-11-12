const { BaseRepository } = require('./base-repository');

class TeamRepository extends BaseRepository {
  async listForUser(userId) {
    const nowIso = new Date().toISOString();
    return this.all(`
      SELECT t.id, t.name, GROUP_CONCAT(u.name ORDER BY u.name SEPARATOR ',') AS members,
        NOT EXISTS (
          SELECT 1
          FROM registrations r
          JOIN hackathons h ON h.id=r.hackathon_id
          WHERE r.team_id=t.id
            AND h.start_date <= ?
        ) AS can_leave
      FROM teams t JOIN team_members tm ON tm.team_id=t.id JOIN users u ON u.id=tm.user_id
      WHERE t.id IN (SELECT team_id FROM team_members WHERE user_id=?) GROUP BY t.id
    `, [nowIso, userId]);
  }

  async listAll() {
    return this.all(`
      SELECT t.id,t.name,GROUP_CONCAT(u.name ORDER BY u.name SEPARATOR ',') AS members
      FROM teams t JOIN team_members tm ON tm.team_id=t.id JOIN users u ON u.id=tm.user_id
      GROUP BY t.id ORDER BY t.name
    `);
  }

  async findById(id) {
    return this.one('SELECT id,name FROM teams WHERE id=?', [id]);
  }

  async findByMember(userId) {
    return this.one('SELECT team_id FROM team_members WHERE user_id=?', [userId]);
  }

  async findMember(teamId, userId) {
    return this.one('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?', [teamId, userId]);
  }

  async hasStartedRegistration(teamId) {
    const nowIso = new Date().toISOString();
    return this.one(`
      SELECT 1
      FROM registrations r
      JOIN hackathons h ON h.id=r.hackathon_id
      WHERE r.team_id=?
        AND h.start_date <= ?
      LIMIT 1
    `, [teamId, nowIso]);
  }

  async removeMember(teamId, userId) {
    return this.run('DELETE FROM team_members WHERE team_id=? AND user_id=?', [teamId, userId]);
  }

  async countMembers(teamId) {
    const row = await this.one('SELECT COUNT(*) AS count FROM team_members WHERE team_id=?', [teamId]);
    return Number(row.count);
  }

  async hasProtectedTeamReferences(teamId) {
    return this.one(`
      SELECT 1
      FROM support_requests
      WHERE team_id=?
      UNION
      SELECT 1
      FROM hackathons
      WHERE winner_team_id=?
      LIMIT 1
    `, [teamId, teamId]);
  }

  async deleteTeamIfEmpty(teamId) {
    return this.transaction(async (repository) => {
      if (await repository.countMembers(teamId)) return false;
      if (await repository.hasProtectedTeamReferences(teamId)) return false;
      const result = await repository.run('DELETE FROM teams WHERE id=?', [teamId]);
      return result.changes > 0;
    });
  }

  async create(name, userId) {
    return this.transaction(async (repository) => {
      const result = await repository.run('INSERT INTO teams(name) VALUES(?)', [name]);
      await repository.run('INSERT INTO team_members(team_id,user_id) VALUES(?,?)', [result.lastInsertRowid, userId]);
      return { id: result.lastInsertRowid, name };
    });
  }

  async findUserByEmail(email) {
    return this.one('SELECT id FROM users WHERE email=?', [email]);
  }

  async findInvitation(id, userId) {
    return this.one(`
      SELECT * FROM team_invitations
      WHERE id=? AND invited_user_id=? AND status='IN_ATTESA'
    `, [id, userId]);
  }

  async listInvitations(userId) {
    return this.all(`
      SELECT i.*, t.name AS team_name, u.email AS invited_email
      FROM team_invitations i JOIN teams t ON t.id=i.team_id JOIN users u ON u.id=i.invited_user_id
      WHERE i.invited_user_id=? ORDER BY i.sent_at DESC
    `, [userId]);
  }

  async createInvitation(teamId, invitedUserId, inviterUserId) {
    const result = await this.run(`
      INSERT INTO team_invitations(team_id,invited_user_id,inviter_user_id) VALUES(?,?,?)
    `, [teamId, invitedUserId, inviterUserId]);
    return this.one('SELECT * FROM team_invitations WHERE id=?', [result.lastInsertRowid]);
  }

  async hasPendingInvitation(teamId, invitedUserId) {
    return this.one(`
      SELECT 1 FROM team_invitations
      WHERE team_id=? AND invited_user_id=? AND status='IN_ATTESA'
    `, [teamId, invitedUserId]);
  }

  async setInvitationStatus(invitationId, teamId, status, userId) {
    return this.transaction(async (repository) => {
      if (status === 'ACCETTATO') {
        await repository.run('INSERT INTO team_members(team_id,user_id) VALUES(?,?)', [teamId, userId]);
      }
      const result = await repository.run(`
        UPDATE team_invitations SET status=?
        WHERE id=? AND team_id=? AND invited_user_id=? AND status='IN_ATTESA'
      `, [status, invitationId, teamId, userId]);
      return result.changes === 1;
    });
  }
}

module.exports = { TeamRepository };
