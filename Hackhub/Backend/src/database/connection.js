const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

function createDatabase(databasePath = process.env.HACKHUB_DB_PATH
  || path.join(__dirname, '..', '..', 'hackhub.sqlite')) {
  return new DatabaseSync(databasePath);
}

module.exports = { createDatabase };
