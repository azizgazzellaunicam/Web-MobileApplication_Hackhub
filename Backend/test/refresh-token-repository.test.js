const assert = require('node:assert/strict');
const test = require('node:test');
const { RefreshTokenRepository } = require('../src/repository/refresh-token-repository');
const { createInitializedDatabase, resetDatabase } = require('./helpers/mariadb-test-utils');

test('persists hashed refresh tokens and rotates them atomically', async () => {
  const database = await createInitializedDatabase();
  try {
    await resetDatabase(database);
    await database.execute(
      `INSERT INTO users(id,name,email,password_hash) VALUES(1,'Test','refresh@example.com','hash')`,
    );
    const repository = new RefreshTokenRepository(database);
    await repository.save('refresh-token', 1, Date.now() + 60_000, 'family');
    const [hashRows] = await database.execute('SELECT token_hash FROM refresh_tokens');
    assert.equal(hashRows[0].token_hash.length, 64);
    assert.equal((await repository.find('refresh-token')).user_id, 1);
    assert.ok(await repository.rotate('refresh-token', 'replacement-token', 1, Date.now() + 60_000, 'family'));
    assert.equal(await repository.rotate('refresh-token', 'second-replacement', 1, Date.now() + 60_000, 'family'), null);
    assert.ok((await repository.find('refresh-token')).revoked_at);
    await repository.cleanup();
    assert.equal(await repository.find('refresh-token'), undefined);
  } finally {
    await database.end();
  }
});
