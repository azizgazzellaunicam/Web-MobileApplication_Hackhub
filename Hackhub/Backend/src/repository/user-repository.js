class UserRepository {
  constructor(database) {
    this.database = database;
  }

  findByEmail(email) {
    return this.database.prepare('SELECT id,name,email,role,password_hash FROM users WHERE email=?').get(email);
  }

  findById(id) {
    return this.database.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(id);
  }

  create(name, email, passwordHash) {
    return this.database.prepare('INSERT INTO users(name,email,password_hash) VALUES (?,?,?)')
      .run(name, email, passwordHash);
  }

  findByEmailExcept(email, userId) {
    return this.database.prepare('SELECT 1 FROM users WHERE email=? AND id<>?').get(email, userId);
  }

  updateProfile(userId, name, email) {
    this.database.prepare('UPDATE users SET name=?,email=? WHERE id=?').run(name, email, userId);
    return this.findById(userId);
  }

  findWins(userId) {
    const team = this.database.prepare('SELECT team_id FROM team_members WHERE user_id=?').get(userId);
    if (!team) return [];
    return this.database.prepare(`
      SELECT h.id, h.name, h.winner_team_id, h.prize
      FROM hackathons h
      WHERE h.winner_team_id=?
      ORDER BY h.end_date DESC
    `).all(team.team_id);
  }
}

module.exports = { UserRepository };
