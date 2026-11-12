const { BaseRepository } = require('./base-repository');

class CompetitionRepository extends BaseRepository {
  async userTeam(userId) { return this.one('SELECT team_id FROM team_members WHERE user_id=?', [userId]); }
  async hackathon(id) { return this.one('SELECT * FROM hackathons WHERE id=?', [id]); }
  async registration(hackathonId, teamId) { return this.one('SELECT 1 FROM registrations WHERE hackathon_id=? AND team_id=?', [hackathonId, teamId]); }
  async teamSize(teamId) {
    const row = await this.one('SELECT COUNT(*) AS count FROM team_members WHERE team_id=?', [teamId]);
    return Number(row.count);
  }
  async register(hackathonId, teamId) { await this.run('INSERT INTO registrations(hackathon_id,team_id) VALUES(?,?)', [hackathonId, teamId]); }
  async submission(id) { return this.one('SELECT * FROM submissions WHERE id=?', [id]); }
  async submissionForTeam(hackathonId, teamId) { return this.one('SELECT 1 FROM submissions WHERE hackathon_id=? AND team_id=?', [hackathonId, teamId]); }
  async createSubmission(hackathonId, teamId, content) {
    const result = await this.run('INSERT INTO submissions(hackathon_id,team_id,content,submitted_at) VALUES(?,?,?,CURRENT_TIMESTAMP)', [hackathonId, teamId, content]);
    return this.submission(result.lastInsertRowid);
  }
  async updateSubmission(id, content) {
    await this.run('UPDATE submissions SET content=?, submitted_at=CURRENT_TIMESTAMP WHERE id=?', [content, id]);
    return this.submission(id);
  }
  async listSubmissions(hackathonId) {
    return this.all('SELECT s.*, t.name AS team_name FROM submissions s JOIN teams t ON t.id=s.team_id WHERE s.hackathon_id=?', [hackathonId]);
  }
  async listMine(userId) {
    return this.all(`
      SELECT s.*, h.name AS hackathon_name, t.name AS team_name
      FROM submissions s JOIN teams t ON t.id=s.team_id JOIN hackathons h ON h.id=s.hackathon_id
      WHERE s.team_id IN (SELECT team_id FROM team_members WHERE user_id=?) ORDER BY s.submitted_at DESC
    `, [userId]);
  }
  async hasEvaluation(submissionId) { return this.one('SELECT 1 FROM evaluations WHERE submission_id=?', [submissionId]); }
  async evaluationByJudge(submissionId, judgeId) {
    return this.one('SELECT 1 FROM evaluations WHERE submission_id=? AND judge_id=?', [submissionId, judgeId]);
  }
  async isJudge(hackathonId, userId) { return this.one("SELECT 1 FROM hackathon_staff WHERE hackathon_id=? AND user_id=? AND role='JUDGE'", [hackathonId, userId]); }
  async evaluate(submissionId, judgeId, score, comment) {
    await this.run('INSERT INTO evaluations(submission_id,judge_id,score,comment) VALUES(?,?,?,?)', [submissionId, judgeId, score, comment]);
  }
  async listEvaluations(submissionId) {
    return this.all('SELECT e.id,e.score,e.comment,e.judge_id,u.name AS judge_name FROM evaluations e JOIN users u ON u.id=e.judge_id WHERE e.submission_id=?', [submissionId]);
  }
  async ranking(hackathonId) {
    return this.all(`
      SELECT t.id AS team_id, t.name AS team_name, AVG(e.score) AS average_score
      FROM submissions s JOIN teams t ON t.id=s.team_id JOIN evaluations e ON e.submission_id=s.id
      WHERE s.hackathon_id=? GROUP BY t.id, t.name
    `, [hackathonId]);
  }
  async canAccessHackathon(hackathonId, userId) {
    return this.one(`
      SELECT 1 FROM hackathons h LEFT JOIN hackathon_staff s
      ON s.hackathon_id=h.id AND s.user_id=?
      WHERE h.id=? AND (h.organizer_id=? OR s.user_id IS NOT NULL)
    `, [userId, hackathonId, userId]);
  }
  async isTeamMember(teamId, userId) { return this.one('SELECT 1 FROM team_members WHERE team_id=? AND user_id=?', [teamId, userId]); }
}

module.exports = { CompetitionRepository };
