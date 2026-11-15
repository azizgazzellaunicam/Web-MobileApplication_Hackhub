const assert = require('node:assert/strict');
const test = require('node:test');
const { SessionRepository } = require('../src/modules/identity/session-repository');
const { createInitializedIdentityDatabase, resetIdentityDatabase } = require('./helpers/mariadb-test-utils');

test('persists valid sessions and removes expired sessions', async () => {
  const database = await createInitializedIdentityDatabase();
  try {
    await resetIdentityDatabase(database);
    await database.execute(`
      INSERT INTO users(id,name,email,password_hash) VALUES(1,'Test','test@example.com','hash')
    `);
    const token = 'persistent-session-token';
    const sessions = new SessionRepository(database);
    await sessions.save(token, 1, Date.now() + 60_000);
    assert.equal((await sessions.findValid(token))?.user.email, 'test@example.com');
    await database.execute('UPDATE sessions SET expires_at=?', [Date.now() - 1]);
    assert.equal(await sessions.findValid(token), null);
  } finally {
    await database.end();
  }
});
