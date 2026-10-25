const { createHash } = require('node:crypto');

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

class SessionRepository {
  constructor(database) {
    this.database = database;
  }

  save(token, userId, expiresAt) {
    this.database.prepare(`
      INSERT INTO sessions(token_hash,user_id,expires_at)
      VALUES(?,?,?)
    `).run(hashToken(token), userId, expiresAt);
  }

  findValid(token) {
    if (!token) return null;
    this.database.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    const session = this.database.prepare(`
      SELECT s.user_id, s.expires_at, u.id, u.name, u.email, u.role
      FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.expires_at >= ?
    `).get(hashToken(token), Date.now());
    return session
      ? { user: { id: session.id, name: session.name, email: session.email, role: session.role }, expiresAt: session.expires_at }
      : null;
  }

  delete(token) {
    if (token) this.database.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
  }
}

module.exports = { SessionRepository };
