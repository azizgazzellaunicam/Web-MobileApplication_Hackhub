const { createHash } = require('node:crypto');
const { BaseRepository } = require('./base-repository');

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

class RefreshTokenRepository extends BaseRepository {
  async save(token, userId, expiresAt, familyId) {
    await this.run(`
      INSERT INTO refresh_tokens(user_id, token_hash, expires_at, family_id)
      VALUES(?,?,?,?)
    `, [userId, hashToken(token), expiresAt, familyId]);
  }

  async find(token) {
    if (!token) return null;
    return this.one(`
      SELECT id, user_id, token_hash, expires_at, created_at, revoked_at, family_id, replaced_by
      FROM refresh_tokens WHERE token_hash=?
    `, [hashToken(token)]);
  }

  async rotate(token, replacement, userId, expiresAt, familyId) {
    if (!token) return null;
    const tokenHash = hashToken(token);
    return this.transaction(async (repository) => {
      const current = await repository.one(`
        SELECT id, user_id, token_hash, expires_at, created_at, revoked_at, family_id, replaced_by
        FROM refresh_tokens
        WHERE token_hash=?
        FOR UPDATE
      `, [tokenHash]);
      if (!current || current.user_id !== userId || current.revoked_at || current.expires_at <= Date.now()) {
        return null;
      }
      await repository.save(replacement, userId, expiresAt, familyId);
      const replacementToken = await repository.one('SELECT id FROM refresh_tokens WHERE token_hash=?', [hashToken(replacement)]);
      await repository.run(
        'UPDATE refresh_tokens SET revoked_at=?, replaced_by=? WHERE id=? AND revoked_at IS NULL',
        [Date.now(), replacementToken.id, current.id],
      );
      return current;
    });
  }

  async revoke(token) {
    if (token) await this.run(
      'UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,?) WHERE token_hash=?',
      [Date.now(), hashToken(token)],
    );
  }

  async revokeFamily(familyId) {
    await this.run(
      'UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,?) WHERE family_id=?',
      [Date.now(), familyId],
    );
  }

  async cleanup(now = Date.now()) {
    await this.run(
      'DELETE FROM refresh_tokens WHERE expires_at < ? OR revoked_at IS NOT NULL',
      [now],
    );
  }
}

module.exports = { RefreshTokenRepository, hashToken };
