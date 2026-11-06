const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../src/database/connection');
const { initializeSchema } = require('../src/database/schema');
const { RefreshTokenRepository } = require('../src/repository/refresh-token-repository');

test('persists hashed refresh tokens and rotates them atomically', () => {
  const databasePath = path.join(os.tmpdir(), `hackhub-refresh-${process.pid}-${Date.now()}.sqlite`);
  const firstDatabase = createDatabase(databasePath);
  initializeSchema(firstDatabase);
  firstDatabase.prepare(
    `INSERT INTO users(id,name,email,password_hash) VALUES(1,'Test','refresh@example.com','hash')`,
  ).run();
  const first = new RefreshTokenRepository(firstDatabase);
  first.save('refresh-token', 1, Date.now() + 60_000, 'family');
  assert.equal(firstDatabase.prepare('SELECT token_hash FROM refresh_tokens').get().token_hash.length, 64);
  firstDatabase.close();

  const secondDatabase = createDatabase(databasePath);
  const second = new RefreshTokenRepository(secondDatabase);
  assert.equal(second.find('refresh-token').user_id, 1);
  assert.ok(second.rotate('refresh-token', 'replacement-token', 1, Date.now() + 60_000, 'family'));
  assert.equal(second.rotate('refresh-token', 'second-replacement', 1, Date.now() + 60_000, 'family'), null);
  assert.ok(second.find('refresh-token').revoked_at);
  second.cleanup();
  assert.equal(second.find('refresh-token'), undefined);
  secondDatabase.close();

  for (const suffix of ['', '-shm', '-wal']) {
    const file = `${databasePath}${suffix}`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});
