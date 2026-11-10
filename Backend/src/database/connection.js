const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

function createDatabase(databasePath = process.env.HACKHUB_DB_PATH
  || path.join(__dirname, '..', '..', 'hackhub.sqlite')) {
  const resolvedPath = databasePath === ':memory:'
    ? databasePath
    : path.resolve(__dirname, '..', '..', databasePath);
  if (resolvedPath !== ':memory:') {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }
  return new DatabaseSync(resolvedPath);
}

module.exports = { createDatabase };
