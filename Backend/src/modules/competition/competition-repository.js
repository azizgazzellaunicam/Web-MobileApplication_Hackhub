const { BaseRepository } = require('../../repository/base-repository');

class CompetitionRepository extends BaseRepository {
  async registration(hackathonId, teamId) {
    return this.one('SELECT 1 FROM registrations WHERE hackathon_id=? AND team_id=?', [hackathonId, teamId]);
  }

  async registeredHackathonIds(teamId) {
    const rows = await this.all('SELECT hackathon_id FROM registrations WHERE team_id=?', [teamId]);
    return rows.map((row) => row.hackathon_id);
  }

  async registeredTeamIds(hackathonId) {
    const rows = await this.all('SELECT team_id FROM registrations WHERE hackathon_id=?', [hackathonId]);
    return rows.map((row) => row.team_id);
  }

  async register(hackathonId, teamId) {
    await this.run('INSERT INTO registrations(hackathon_id,team_id) VALUES(?,?)', [hackathonId, teamId]);
  }

  async submission(id) {
    return this.one('SELECT * FROM submissions WHERE id=?', [id]);
  }

  async submissionForTeam(hackathonId, teamId) {
    return this.one('SELECT id FROM submissions WHERE hackathon_id=? AND team_id=?', [hackathonId, teamId]);
  }

  async createSubmission(hackathonId, teamId, content) {
    const result = await this.run('INSERT INTO submissions(hackathon_id,team_id,content,submitted_at) VALUES(?,?,?,CURRENT_TIMESTAMP)', [hackathonId, teamId, content]);
    return this.submission(result.lastInsertRowid);
  }

  async updateSubmission(id, content) {
    await this.run('UPDATE submissions SET content=?, submitted_at=CURRENT_TIMESTAMP WHERE id=?', [content, id]);
    return this.submission(id);
  }

  async listSubmissions(hackathonId) {
    return this.all('SELECT * FROM submissions WHERE hackathon_id=?', [hackathonId]);
  }

  async listSubmissionsByTeam(teamId) {
    return this.all('SELECT * FROM submissions WHERE team_id=? ORDER BY submitted_at DESC', [teamId]);
  }

  async hasEvaluation(submissionId) {
    return this.one('SELECT 1 FROM evaluations WHERE submission_id=?', [submissionId]);
  }

  async evaluationByJudge(submissionId, judgeId) {
    return this.one('SELECT 1 FROM evaluations WHERE submission_id=? AND judge_id=?', [submissionId, judgeId]);
  }

  async evaluate(submissionId, judgeId, score, comment) {
    await this.run('INSERT INTO evaluations(submission_id,judge_id,score,comment) VALUES(?,?,?,?)', [submissionId, judgeId, score, comment]);
  }

  async listEvaluations(submissionId) {
    return this.all('SELECT id,score,comment,judge_id FROM evaluations WHERE submission_id=?', [submissionId]);
  }

  async ranking(hackathonId) {
    return this.all(`
      SELECT s.team_id, AVG(e.score) AS average_score
      FROM submissions s JOIN evaluations e ON e.submission_id=s.id
      WHERE s.hackathon_id=? GROUP BY s.team_id
    `, [hackathonId]);
  }

  async winnerTeamId(hackathonId) {
    const row = await this.one('SELECT team_id FROM winners WHERE hackathon_id=?', [hackathonId]);
    return row ? row.team_id : null;
  }

  async winnerHackathonIdsForTeam(teamId) {
    const rows = await this.all('SELECT hackathon_id FROM winners WHERE team_id=?', [teamId]);
    return rows.map((row) => row.hackathon_id);
  }

  async proclaimWinner(hackathonId, teamId) {
    try {
      await this.run('INSERT INTO winners(hackathon_id,team_id) VALUES(?,?)', [hackathonId, teamId]);
      return true;
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') return false;
      throw error;
    }
  }

  async clearWinner(hackathonId, teamId) {
    await this.run('DELETE FROM winners WHERE hackathon_id=? AND team_id=?', [hackathonId, teamId]);
  }
}

module.exports = { CompetitionRepository };
