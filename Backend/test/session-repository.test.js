const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../src/database/connection');
const { initializeSchema } = require('../src/database/schema');
const { SessionRepository } = require('../src/repository/session-repository');

test('persists valid sessions across database reopen and removes expired sessions', () => {
  const databasePath = path.join(os.tmpdir(), `hackhub-session-${process.pid}-${Date.now()}.sqlite`);
  const firstDatabase = createDatabase(databasePath);
  initializeSchema(firstDatabase);
  firstDatabase.prepare(`
    INSERT INTO users(id,name,email,password_hash) VALUES(1,'Test','test@example.com','hash')
  `).run();
  const token = 'persistent-session-token';
  new SessionRepository(firstDatabase).save(token, 1, Date.now() + 60_000);
  firstDatabase.close();

  const secondDatabase = createDatabase(databasePath);
  const sessions = new SessionRepository(secondDatabase);
  assert.equal(sessions.findValid(token)?.user.email, 'test@example.com');
  secondDatabase.prepare('UPDATE sessions SET expires_at=?').run(Date.now() - 1);
  assert.equal(sessions.findValid(token), null);
  secondDatabase.close();

  for (const suffix of ['', '-shm', '-wal']) {
    const file = `${databasePath}${suffix}`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});
