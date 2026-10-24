class SupportRepository {
  constructor(database) { this.database = database; }
  hackathon(id) { return this.database.prepare('SELECT * FROM hackathons WHERE id=?').get(id); }
  request(id) { return this.database.prepare('SELECT * FROM support_requests WHERE id=?').get(id); }
  member(teamId, userId) { return this.database.prepare('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?').get(teamId, userId); }
  mentor(hackathonId, userId) { return this.database.prepare("SELECT 1 FROM hackathon_staff WHERE hackathon_id=? AND user_id=? AND role='MENTOR'").get(hackathonId, userId); }
  registered(hackathonId, teamId) { return this.database.prepare('SELECT 1 FROM registrations WHERE hackathon_id=? AND team_id=?').get(hackathonId, teamId); }
  create(input) {
    const result = this.database.prepare(`
      INSERT INTO support_requests(hackathon_id,team_id,user_id,topic,description,priority)
      VALUES(?,?,?,?,?,?)
    `).run(input.hackathonId, input.teamId, input.userId, input.topic, input.description, input.priority);
    return this.request(result.lastInsertRowid);
  }
  openForMentor(userId) {
    return this.database.prepare(`
      SELECT r.*,h.name AS hackathon_name,t.name AS team_name
      FROM support_requests r JOIN hackathons h ON h.id=r.hackathon_id
      JOIN teams t ON t.id=r.team_id JOIN hackathon_staff s ON s.hackathon_id=r.hackathon_id
      WHERE s.user_id=? AND s.role='MENTOR' AND r.open=1
    `).all(userId);
  }
  details(id) {
    return this.database.prepare(`
      SELECT r.*,h.name AS hackathon_name,t.name AS team_name
      FROM support_requests r JOIN hackathons h ON h.id=r.hackathon_id JOIN teams t ON t.id=r.team_id
      WHERE r.id=?
    `).get(id);
  }
  forHackathon(id) {
    return this.database.prepare('SELECT r.*,t.name AS team_name FROM support_requests r JOIN teams t ON t.id=r.team_id WHERE r.hackathon_id=? ORDER BY r.open DESC,r.id DESC').all(id);
  }
  createCall(requestId, mentorId, scheduledAt, link) {
    const result = this.database.prepare('INSERT INTO support_calls(request_id,mentor_id,scheduled_at,link) VALUES(?,?,?,?)').run(requestId, mentorId, scheduledAt, link);
    return this.database.prepare('SELECT * FROM support_calls WHERE id=?').get(result.lastInsertRowid);
  }
  close(id) { this.database.prepare('UPDATE support_requests SET open=0 WHERE id=?').run(id); }
}

module.exports = { SupportRepository };
