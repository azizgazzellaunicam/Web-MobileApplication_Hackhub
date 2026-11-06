const { createHash } = require('node:crypto');

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

class RefreshTokenRepository {
  constructor(database) {
    this.database = database;
  }

  save(token, userId, expiresAt, familyId) {
    this.database.prepare(`
      INSERT INTO refresh_tokens(user_id, token_hash, expires_at, family_id)
      VALUES(?,?,?,?)
    `).run(userId, hashToken(token), expiresAt, familyId);
  }

  find(token) {
    if (!token) return null;
    return this.database.prepare(`
      SELECT id, user_id, token_hash, expires_at, created_at, revoked_at, family_id, replaced_by
      FROM refresh_tokens WHERE token_hash=?
    `).get(hashToken(token));
  }

  rotate(token, replacement, userId, expiresAt, familyId) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const current = this.find(token);
      if (!current || current.user_id !== userId || current.revoked_at || current.expires_at <= Date.now()) {
        this.database.exec('ROLLBACK');
        return null;
      }
      this.save(replacement, userId, expiresAt, familyId);
      const replacementId = this.database.prepare(
        'SELECT id FROM refresh_tokens WHERE token_hash=?',
      ).get(hashToken(replacement)).id;
      this.database.prepare(
        'UPDATE refresh_tokens SET revoked_at=?, replaced_by=? WHERE id=? AND revoked_at IS NULL',
      ).run(Date.now(), replacementId, current.id);
      this.database.exec('COMMIT');
      return current;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  revoke(token) {
    if (token) this.database.prepare(
      'UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,?) WHERE token_hash=?',
    ).run(Date.now(), hashToken(token));
  }

  revokeFamily(familyId) {
    this.database.prepare(
      'UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,?) WHERE family_id=?',
    ).run(Date.now(), familyId);
  }

  cleanup(now = Date.now()) {
    this.database.prepare(
      'DELETE FROM refresh_tokens WHERE expires_at < ? OR revoked_at IS NOT NULL',
    ).run(now);
  }
}

module.exports = { RefreshTokenRepository, hashToken };
