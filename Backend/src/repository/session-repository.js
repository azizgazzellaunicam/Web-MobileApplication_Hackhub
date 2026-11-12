const { createHash } = require('node:crypto');
const { BaseRepository } = require('./base-repository');

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

class SessionRepository extends BaseRepository {
  async save(token, userId, expiresAt) {
    await this.run(`
      INSERT INTO sessions(token_hash,user_id,expires_at)
      VALUES(?,?,?)
    `, [hashToken(token), userId, expiresAt]);
  }

  async findValid(token) {
    if (!token) return null;
    await this.run('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
    const session = await this.one(`
      SELECT s.user_id, s.expires_at, u.id, u.name, u.email, u.role
      FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.expires_at >= ?
    `, [hashToken(token), Date.now()]);
    return session
      ? { user: { id: session.id, name: session.name, email: session.email, role: session.role }, expiresAt: session.expires_at }
      : null;
  }

  async delete(token) {
    if (token) await this.run('DELETE FROM sessions WHERE token_hash=?', [hashToken(token)]);
  }
}

module.exports = { SessionRepository };
