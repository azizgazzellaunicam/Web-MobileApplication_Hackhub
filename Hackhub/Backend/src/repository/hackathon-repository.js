class HackathonRepository {
  constructor(database) {
    this.database = database;
  }

  findById(id) {
    return this.database.prepare('SELECT * FROM hackathons WHERE id=?').get(id);
  }

  findStaff(id) {
    return this.database.prepare('SELECT user_id,role FROM hackathon_staff WHERE hackathon_id=?').all(id);
  }

  findUserWithRole(id, role) {
    return this.database.prepare('SELECT id FROM users WHERE id=? AND role=?').get(id, role);
  }

  list() {
    return this.database.prepare('SELECT * FROM hackathons ORDER BY start_date').all();
  }

  listAssigned(userId) {
    return this.database.prepare(`
      SELECT h.* FROM hackathons h
      JOIN hackathon_staff s ON s.hackathon_id=h.id
      WHERE s.user_id=? ORDER BY h.start_date
    `).all(userId);
  }

  listEvaluation(userId) {
    return this.database.prepare(`
      SELECT h.* FROM hackathons h
      JOIN hackathon_staff s ON s.hackathon_id=h.id
      WHERE s.user_id=? AND s.role='JUDGE'
    `).all(userId);
  }

  listStaff() {
    return this.database.prepare("SELECT id,name,email,role FROM users WHERE role IN ('JUDGE','MENTOR') ORDER BY role,name").all();
  }

  teamForUser(userId) {
    return this.database.prepare('SELECT team_id FROM team_members WHERE user_id=?').get(userId);
  }

  assignmentForUser(userId) {
    return this.database.prepare('SELECT hackathon_id,role FROM hackathon_staff WHERE user_id=?').all(userId);
  }

  isRegistered(hackathonId, teamId) {
    return this.database.prepare('SELECT 1 FROM registrations WHERE hackathon_id=? AND team_id=?')
      .get(hackathonId, teamId);
  }

  assignStaff(hackathonId, userId, role) {
    this.database.prepare('INSERT INTO hackathon_staff(hackathon_id,user_id,role) VALUES(?,?,?)')
      .run(hackathonId, userId, role);
  }

  create(input) {
    this.database.prepare('BEGIN').run();
    try {
      const result = this.database.prepare(`
        INSERT INTO hackathons(
          name,regulation,registration_deadline,start_date,end_date,location,
          prize,max_team_size,organizer_id
        ) VALUES(?,?,?,?,?,?,?,?,?)
      `).run(
        input.name,
        input.regulation,
        input.registrationDeadline,
        input.startDate,
        input.endDate,
        input.location,
        input.prize,
        input.maxTeamSize,
        input.organizerId,
      );
      this.assignStaff(result.lastInsertRowid, input.judgeId, 'JUDGE');
      this.assignStaff(result.lastInsertRowid, input.mentorId, 'MENTOR');
      this.database.prepare('COMMIT').run();
      return this.findById(result.lastInsertRowid);
    } catch (error) {
      this.database.prepare('ROLLBACK').run();
      throw error;
    }
  }

  submissions(hackathonId) {
    return this.database.prepare('SELECT id,team_id FROM submissions WHERE hackathon_id=?').all(hackathonId);
  }

  hasEvaluation(submissionId) {
    return this.database.prepare('SELECT 1 FROM evaluations WHERE submission_id=?').get(submissionId);
  }

  ranking(hackathonId) {
    return this.database.prepare(`
      SELECT t.id AS team_id, t.name AS team_name, AVG(e.score) AS average_score
      FROM submissions s
      JOIN teams t ON t.id=s.team_id
      JOIN evaluations e ON e.submission_id=s.id
      WHERE s.hackathon_id=? GROUP BY t.id,t.name
    `).all(hackathonId);
  }

  isTeamRegistered(hackathonId, teamId) {
    return this.database.prepare('SELECT 1 FROM registrations WHERE hackathon_id=? AND team_id=?')
      .get(hackathonId, teamId);
  }

  submissionForTeam(hackathonId, teamId) {
    return this.database.prepare('SELECT id FROM submissions WHERE hackathon_id=? AND team_id=?')
      .get(hackathonId, teamId);
  }

  teamMembers(teamId) {
    return this.database.prepare('SELECT user_id FROM team_members WHERE team_id=?').all(teamId);
  }

  team(teamId) {
    return this.database.prepare('SELECT name FROM teams WHERE id=?').get(teamId);
  }

  proclaimWinner(hackathonId, teamId) {
    this.database.prepare('BEGIN').run();
    try {
      const result = this.database.prepare(
        'UPDATE hackathons SET winner_team_id=? WHERE id=? AND winner_team_id IS NULL',
      ).run(teamId, hackathonId);
      this.database.prepare('COMMIT').run();
      return result.changes > 0;
    } catch (error) {
      this.database.prepare('ROLLBACK').run();
      throw error;
    }
  }

  clearWinner(hackathonId, teamId) {
    this.database.prepare(
      'UPDATE hackathons SET winner_team_id=NULL WHERE id=? AND winner_team_id=?',
    ).run(hackathonId, teamId);
  }

  updateStatus(id, status) {
    this.database.prepare('UPDATE hackathons SET status_override=? WHERE id=?').run(status, id);
    return this.findById(id);
  }

  update(id, input) {
    this.database.prepare('BEGIN').run();
    try {
      this.database.prepare(`
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
      this.database.prepare('DELETE FROM hackathon_staff WHERE hackathon_id=?').run(id);
      this.database.prepare('INSERT INTO hackathon_staff(hackathon_id,user_id,role) VALUES (?,?,?)').run(id, input.judgeId, 'JUDGE');
      this.database.prepare('INSERT INTO hackathon_staff(hackathon_id,user_id,role) VALUES (?,?,?)').run(id, input.mentorId, 'MENTOR');
      this.database.prepare('COMMIT').run();
      return this.findById(id);
    } catch (error) {
      this.database.prepare('ROLLBACK').run();
      throw error;
    }
  }

  delete(id) {
    this.database.prepare('DELETE FROM hackathons WHERE id=?').run(id);
  }
}

module.exports = { HackathonRepository };
