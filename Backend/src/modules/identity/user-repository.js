const { BaseRepository } = require('../../repository/base-repository');

class UserRepository extends BaseRepository {
  async findByEmail(email) {
    return this.one('SELECT id,name,email,role,password_hash FROM users WHERE email=?', [email]);
  }

  async findById(id) {
    return this.one('SELECT id,name,email,role FROM users WHERE id=?', [id]);
  }

  async findByIds(ids) {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    return this.all(`SELECT id,name,email,role FROM users WHERE id IN (${placeholders})`, ids);
  }

  async findIdByEmail(email) {
    return this.one('SELECT id FROM users WHERE email=?', [email]);
  }

  async findUserWithRole(id, role) {
    return this.one('SELECT id FROM users WHERE id=? AND role=?', [id, role]);
  }

  async listStaffCandidates() {
    return this.all("SELECT id,name,email,role FROM users WHERE role IN ('JUDGE','MENTOR') ORDER BY role,name");
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
}

module.exports = { UserRepository };
