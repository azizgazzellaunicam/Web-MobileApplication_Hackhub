const { BaseRepository } = require('../../repository/base-repository');

class TeamRepository extends BaseRepository {
  async listTeams() {
    return this.all('SELECT id,name FROM teams ORDER BY name');
  }

  async listMemberships() {
    return this.all('SELECT team_id,user_id FROM team_members');
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

  async memberIds(teamId) {
    const rows = await this.all('SELECT user_id FROM team_members WHERE team_id=?', [teamId]);
    return rows.map((row) => row.user_id);
  }

  async removeMember(teamId, userId) {
    return this.run('DELETE FROM team_members WHERE team_id=? AND user_id=?', [teamId, userId]);
  }

  async countMembers(teamId) {
    const row = await this.one('SELECT COUNT(*) AS count FROM team_members WHERE team_id=?', [teamId]);
    return Number(row.count);
  }

  async deleteTeamIfEmpty(teamId) {
    return this.transaction(async (repository) => {
      if (await repository.countMembers(teamId)) return false;
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

  async findInvitation(id, userId) {
    return this.one(`
      SELECT * FROM team_invitations
      WHERE id=? AND invited_user_id=? AND status='IN_ATTESA'
    `, [id, userId]);
  }

  async listInvitations(userId) {
    return this.all(`
      SELECT i.*, t.name AS team_name
      FROM team_invitations i JOIN teams t ON t.id=i.team_id
      WHERE i.invited_user_id=? ORDER BY i.sent_at DESC
    `, [userId]);
  }

  async createInvitation(teamId, invitedUserId, inviterUserId) {
    const result = await this.run(`
      INSERT INTO team_invitations(team_id,invited_user_id,inviter_user_id) VALUES(?,?,?)
    `, [teamId, invitedUserId, inviterUserId]);
    return this.one('SELECT * FROM team_invitations WHERE id=?', [result.lastInsertRowid]);
  }

  async deleteInvitation(invitationId) {
    return this.run('DELETE FROM team_invitations WHERE id=?', [invitationId]);
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
