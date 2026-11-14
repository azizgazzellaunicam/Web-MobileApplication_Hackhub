const { BaseRepository } = require('../../repository/base-repository');

class HackathonRepository extends BaseRepository {
  async findById(id) {
    return this.one('SELECT * FROM hackathons WHERE id=?', [id]);
  }

  async findStaff(id) {
    return this.all('SELECT user_id,role FROM hackathon_staff WHERE hackathon_id=?', [id]);
  }

  async list() {
    return this.all('SELECT * FROM hackathons ORDER BY start_date');
  }

  async listAssigned(userId) {
    return this.all(`
      SELECT h.* FROM hackathons h
      JOIN hackathon_staff s ON s.hackathon_id=h.id
      WHERE s.user_id=? ORDER BY h.start_date
    `, [userId]);
  }

  async listEvaluation(userId) {
    return this.all(`
      SELECT h.* FROM hackathons h
      JOIN hackathon_staff s ON s.hackathon_id=h.id
      WHERE s.user_id=? AND s.role='JUDGE'
    `, [userId]);
  }

  async assignmentsForUser(userId) {
    return this.all('SELECT hackathon_id,role FROM hackathon_staff WHERE user_id=?', [userId]);
  }

  async assignStaff(hackathonId, userId, role) {
    await this.run('INSERT INTO hackathon_staff(hackathon_id,user_id,role) VALUES(?,?,?)', [hackathonId, userId, role]);
  }

  async create(input) {
    return this.transaction(async (repository) => {
      const result = await repository.run(`
        INSERT INTO hackathons(
          name,regulation,registration_deadline,start_date,end_date,location,
          prize,max_team_size,organizer_id
        ) VALUES(?,?,?,?,?,?,?,?,?)
      `, [
        input.name,
        input.regulation,
        input.registrationDeadline,
        input.startDate,
        input.endDate,
        input.location,
        input.prize,
        input.maxTeamSize,
        input.organizerId,
      ]);
      await repository.assignStaff(result.lastInsertRowid, input.judgeId, 'JUDGE');
      await repository.assignStaff(result.lastInsertRowid, input.mentorId, 'MENTOR');
      return repository.findById(result.lastInsertRowid);
    });
  }

  async updateStatus(id, status) {
    await this.run('UPDATE hackathons SET status_override=? WHERE id=?', [status, id]);
    return this.findById(id);
  }

  async update(id, input) {
    return this.transaction(async (repository) => {
      await repository.run(`
        UPDATE hackathons
        SET name=?, regulation=?, registration_deadline=?, start_date=?, end_date=?,
            location=?, prize=?, max_team_size=?
        WHERE id=?
      `, [
        input.name,
        input.regulation,
        input.registrationDeadline,
        input.startDate,
        input.endDate,
        input.location,
        input.prize,
        input.maxTeamSize,
        id,
      ]);
      await repository.run(
        'INSERT IGNORE INTO hackathon_staff(hackathon_id,user_id,role) VALUES (?,?,?)',
        [id, input.judgeId, 'JUDGE'],
      );
      await repository.run(
        'INSERT IGNORE INTO hackathon_staff(hackathon_id,user_id,role) VALUES (?,?,?)',
        [id, input.mentorId, 'MENTOR'],
      );
      if (input.previousJudgeId && input.previousJudgeId !== input.judgeId) {
        await repository.run(
          "DELETE FROM hackathon_staff WHERE hackathon_id=? AND user_id=? AND role='JUDGE'",
          [id, input.previousJudgeId],
        );
      }
      if (input.previousMentorId && input.previousMentorId !== input.mentorId) {
        await repository.run(
          "DELETE FROM hackathon_staff WHERE hackathon_id=? AND user_id=? AND role='MENTOR'",
          [id, input.previousMentorId],
        );
      }
      return repository.findById(id);
    });
  }

  async delete(id) {
    await this.run('DELETE FROM hackathons WHERE id=?', [id]);
  }
}

module.exports = { HackathonRepository };
