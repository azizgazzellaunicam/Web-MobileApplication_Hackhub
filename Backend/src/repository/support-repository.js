const { BaseRepository } = require('./base-repository');

class SupportRepository extends BaseRepository {
  async hackathon(id) { return this.one('SELECT * FROM hackathons WHERE id=?', [id]); }
  async request(id) { return this.one('SELECT * FROM support_requests WHERE id=?', [id]); }
  async member(teamId, userId) { return this.one('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?', [teamId, userId]); }
  async mentor(hackathonId, userId) { return this.one("SELECT 1 FROM hackathon_staff WHERE hackathon_id=? AND user_id=? AND role='MENTOR'", [hackathonId, userId]); }
  async registered(hackathonId, teamId) { return this.one('SELECT 1 FROM registrations WHERE hackathon_id=? AND team_id=?', [hackathonId, teamId]); }
  async create(input) {
    const result = await this.run(`
      INSERT INTO support_requests(hackathon_id,team_id,user_id,topic,description,priority)
      VALUES(?,?,?,?,?,?)
    `, [input.hackathonId, input.teamId, input.userId, input.topic, input.description, input.priority]);
    return this.request(result.lastInsertRowid);
  }
  async openForMentor(userId) {
    return this.all(`
      SELECT r.*,h.name AS hackathon_name,t.name AS team_name
      FROM support_requests r JOIN hackathons h ON h.id=r.hackathon_id
      JOIN teams t ON t.id=r.team_id JOIN hackathon_staff s ON s.hackathon_id=r.hackathon_id
      WHERE s.user_id=? AND s.role='MENTOR' AND r.open=1
    `, [userId]);
  }
  async registeredTeams(hackathonId) {
    return this.all(`
      SELECT t.id,t.name FROM registrations r JOIN teams t ON t.id=r.team_id
      WHERE r.hackathon_id=? ORDER BY t.name
    `, [hackathonId]);
  }
  async forUser(userId) {
    return this.all(`
      SELECT r.*,h.name AS hackathon_name,t.name AS team_name,
        (SELECT c.link FROM support_calls c WHERE c.request_id=r.id ORDER BY c.id DESC LIMIT 1) AS call_link,
        (SELECT c.scheduled_at FROM support_calls c WHERE c.request_id=r.id ORDER BY c.id DESC LIMIT 1) AS call_scheduled_at
      FROM support_requests r JOIN hackathons h ON h.id=r.hackathon_id JOIN teams t ON t.id=r.team_id
      WHERE r.team_id IN (SELECT team_id FROM team_members WHERE user_id=?) ORDER BY r.id DESC
    `, [userId]);
  }
  async details(id) {
    return this.one(`
      SELECT r.*,h.name AS hackathon_name,t.name AS team_name
      FROM support_requests r JOIN hackathons h ON h.id=r.hackathon_id JOIN teams t ON t.id=r.team_id
      WHERE r.id=?
    `, [id]);
  }
  async forHackathon(id) {
    return this.all('SELECT r.*,t.name AS team_name FROM support_requests r JOIN teams t ON t.id=r.team_id WHERE r.hackathon_id=? ORDER BY r.open DESC,r.id DESC', [id]);
  }
  async createCall(requestId, mentorId, scheduledAt, link) {
    const result = await this.run('INSERT INTO support_calls(request_id,mentor_id,scheduled_at,link) VALUES(?,?,?,?)', [requestId, mentorId, scheduledAt, link]);
    return this.one('SELECT * FROM support_calls WHERE id=?', [result.lastInsertRowid]);
  }
  async close(id) { await this.run('UPDATE support_requests SET open=0 WHERE id=?', [id]); }
}

module.exports = { SupportRepository };
