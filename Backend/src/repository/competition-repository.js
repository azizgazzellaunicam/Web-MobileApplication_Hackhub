class CompetitionRepository {
  constructor(database) { this.database = database; }
  userTeam(userId) { return this.database.prepare('SELECT team_id FROM team_members WHERE user_id=?').get(userId); }
  hackathon(id) { return this.database.prepare('SELECT * FROM hackathons WHERE id=?').get(id); }
  registration(hackathonId, teamId) { return this.database.prepare('SELECT 1 FROM registrations WHERE hackathon_id=? AND team_id=?').get(hackathonId, teamId); }
  teamSize(teamId) { return this.database.prepare('SELECT COUNT(*) AS count FROM team_members WHERE team_id=?').get(teamId).count; }
  register(hackathonId, teamId) { this.database.prepare('INSERT INTO registrations(hackathon_id,team_id) VALUES(?,?)').run(hackathonId, teamId); }
  submission(id) { return this.database.prepare('SELECT * FROM submissions WHERE id=?').get(id); }
  submissionForTeam(hackathonId, teamId) { return this.database.prepare('SELECT 1 FROM submissions WHERE hackathon_id=? AND team_id=?').get(hackathonId, teamId); }
  createSubmission(hackathonId, teamId, content) {
    const result = this.database.prepare('INSERT INTO submissions(hackathon_id,team_id,content,submitted_at) VALUES(?,?,?,CURRENT_TIMESTAMP)').run(hackathonId, teamId, content);
    return this.submission(result.lastInsertRowid);
  }
  updateSubmission(id, content) {
    this.database.prepare('UPDATE submissions SET content=?, submitted_at=CURRENT_TIMESTAMP WHERE id=?').run(content, id);
    return this.submission(id);
  }
  listSubmissions(hackathonId) {
    return this.database.prepare('SELECT s.*, t.name AS team_name FROM submissions s JOIN teams t ON t.id=s.team_id WHERE s.hackathon_id=?').all(hackathonId);
  }
  listMine(userId) {
    return this.database.prepare(`
      SELECT s.*, h.name AS hackathon_name, t.name AS team_name
      FROM submissions s JOIN teams t ON t.id=s.team_id JOIN hackathons h ON h.id=s.hackathon_id
      WHERE s.team_id IN (SELECT team_id FROM team_members WHERE user_id=?) ORDER BY s.submitted_at DESC
    `).all(userId);
  }
  hasEvaluation(submissionId) { return this.database.prepare('SELECT 1 FROM evaluations WHERE submission_id=?').get(submissionId); }
  evaluationByJudge(submissionId, judgeId) {
    return this.database.prepare('SELECT 1 FROM evaluations WHERE submission_id=? AND judge_id=?')
      .get(submissionId, judgeId);
  }
  isJudge(hackathonId, userId) { return this.database.prepare("SELECT 1 FROM hackathon_staff WHERE hackathon_id=? AND user_id=? AND role='JUDGE'").get(hackathonId, userId); }
  evaluate(submissionId, judgeId, score, comment) {
    this.database.prepare('INSERT INTO evaluations(submission_id,judge_id,score,comment) VALUES(?,?,?,?)').run(submissionId, judgeId, score, comment);
  }
  listEvaluations(submissionId) {
    return this.database.prepare('SELECT e.id,e.score,e.comment,e.judge_id,u.name AS judge_name FROM evaluations e JOIN users u ON u.id=e.judge_id WHERE e.submission_id=?').all(submissionId);
  }
  ranking(hackathonId) {
    return this.database.prepare(`
      SELECT t.id AS team_id, t.name AS team_name, AVG(e.score) AS average_score
      FROM submissions s JOIN teams t ON t.id=s.team_id JOIN evaluations e ON e.submission_id=s.id
      WHERE s.hackathon_id=? GROUP BY t.id, t.name
    `).all(hackathonId);
  }
  canAccessHackathon(hackathonId, userId) {
    return this.database.prepare(`
      SELECT 1 FROM hackathons h LEFT JOIN hackathon_staff s
      ON s.hackathon_id=h.id AND s.user_id=?
      WHERE h.id=? AND (h.organizer_id=? OR s.user_id IS NOT NULL)
    `).get(userId, hackathonId, userId);
  }
  isTeamMember(teamId, userId) { return this.database.prepare('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?').get(teamId, userId); }
}

module.exports = { CompetitionRepository };
