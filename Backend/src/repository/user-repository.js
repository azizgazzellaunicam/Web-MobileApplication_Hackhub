const { BaseRepository } = require('./base-repository');

class UserRepository extends BaseRepository {
  async findByEmail(email) {
    return this.one('SELECT id,name,email,role,password_hash FROM users WHERE email=?', [email]);
  }

  async findById(id) {
    return this.one('SELECT id,name,email,role FROM users WHERE id=?', [id]);
  }

  async create(name, email, passwordHash) {
    return this.run('INSERT INTO users(name,email,password_hash) VALUES (?,?,?)', [name, email, passwordHash]);
  }

  async findByEmailExcept(email, userId) {
    return this.one('SELECT 1 FROM users WHERE email=? AND id<>?', [email, userId]);
  }

  async updateProfile(userId, name, email) {
    await this.run('UPDATE users SET name=?,email=? WHERE id=?', [name, email, userId]);
    return this.findById(userId);
  }

  async findWins(userId) {
    const team = await this.one('SELECT team_id FROM team_members WHERE user_id=?', [userId]);
    if (!team) return [];
    return this.all(`
      SELECT h.id, h.name, h.winner_team_id, h.prize
      FROM hackathons h
      WHERE h.winner_team_id=?
      ORDER BY h.end_date DESC
    `, [team.team_id]);
  }
}

module.exports = { UserRepository };
