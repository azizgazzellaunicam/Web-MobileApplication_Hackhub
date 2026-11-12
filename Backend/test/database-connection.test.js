const assert = require('node:assert/strict');
const test = require('node:test');
const { createDatabase } = require('../src/database/connection');
const { applyDefaultDatabaseEnvironment } = require('./helpers/mariadb-test-utils');

test('creates a MariaDB pool using environment variables', async () => {
  applyDefaultDatabaseEnvironment();
  const database = createDatabase();
  try {
    const [rows] = await database.query('SELECT 1 AS value');
    assert.equal(rows[0].value, 1);
  } finally {
    await database.end();
  }
});
