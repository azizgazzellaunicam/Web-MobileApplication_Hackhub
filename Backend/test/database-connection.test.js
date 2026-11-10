const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../src/database/connection');

const backendDirectory = path.join(__dirname, '..');

test('resolves a relative database path from Backend and creates its directory', (context) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'hackhub-db-relative-'));
  context.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));
  const databaseFile = path.join(temporaryDirectory, 'nested', 'database.sqlite');
  const relativePath = path.relative(backendDirectory, databaseFile);

  const database = createDatabase(relativePath);
  database.prepare('CREATE TABLE persistence_check (value TEXT NOT NULL)').run();
  database.prepare('INSERT INTO persistence_check(value) VALUES (?)').run('saved');
  database.close();

  const reopened = createDatabase(databaseFile);
  assert.equal(reopened.prepare('SELECT value FROM persistence_check').get().value, 'saved');
  reopened.close();
});

test('uses HACKHUB_DB_PATH when set to a custom absolute path', (context) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'hackhub-db-env-'));
  context.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));
  const previousPath = process.env.HACKHUB_DB_PATH;
  const databaseFile = path.join(temporaryDirectory, 'created', 'custom.sqlite');
  process.env.HACKHUB_DB_PATH = databaseFile;

  try {
    const database = createDatabase();
    assert.ok(fs.existsSync(databaseFile));
    database.close();
  } finally {
    if (previousPath === undefined) delete process.env.HACKHUB_DB_PATH;
    else process.env.HACKHUB_DB_PATH = previousPath;
  }
});

test('opens an in-memory database without creating a directory', () => {
  const database = createDatabase(':memory:');
  assert.equal(database.prepare('SELECT 1 AS value').get().value, 1);
  database.close();
});
