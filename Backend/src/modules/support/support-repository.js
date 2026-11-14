const { BaseRepository } = require('../../repository/base-repository');

const LATEST_CALL_LINK = '(SELECT c.link FROM support_calls c WHERE c.request_id=r.id ORDER BY c.id DESC LIMIT 1)';
const LATEST_CALL_SCHEDULED_AT = '(SELECT c.scheduled_at FROM support_calls c WHERE c.request_id=r.id ORDER BY c.id DESC LIMIT 1)';

class SupportRepository extends BaseRepository {
  async request(id) {
    return this.one('SELECT * FROM support_requests WHERE id=?', [id]);
  }

  async create(input) {
    const result = await this.run(`
      INSERT INTO support_requests(hackathon_id,team_id,user_id,topic,description,priority)
      VALUES(?,?,?,?,?,?)
    `, [input.hackathonId, input.teamId, input.userId, input.topic, input.description, input.priority]);
    return this.request(result.lastInsertRowid);
  }

  async listOpenForHackathons(hackathonIds) {
    if (!hackathonIds.length) return [];
    const placeholders = hackathonIds.map(() => '?').join(',');
    return this.all(`
      SELECT r.* FROM support_requests r
      WHERE r.open=1 AND r.hackathon_id IN (${placeholders}) ORDER BY r.id
    `, hackathonIds);
  }

  async listByTeam(teamId) {
    return this.all(`
      SELECT r.*, ${LATEST_CALL_LINK} AS call_link, ${LATEST_CALL_SCHEDULED_AT} AS call_scheduled_at
      FROM support_requests r WHERE r.team_id=? ORDER BY r.id DESC
    `, [teamId]);
  }

  async listByHackathon(hackathonId) {
    return this.all('SELECT r.* FROM support_requests r WHERE r.hackathon_id=? ORDER BY r.open DESC,r.id DESC', [hackathonId]);
  }

  async createCall(requestId, mentorId, scheduledAt, link) {
    const result = await this.run('INSERT INTO support_calls(request_id,mentor_id,scheduled_at,link) VALUES(?,?,?,?)', [requestId, mentorId, scheduledAt, link]);
    return this.one('SELECT * FROM support_calls WHERE id=?', [result.lastInsertRowid]);
  }

  async close(id) {
    await this.run('UPDATE support_requests SET open=0 WHERE id=?', [id]);
  }
}

module.exports = { SupportRepository };
