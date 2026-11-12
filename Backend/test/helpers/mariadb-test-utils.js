const { createDatabase } = require('../../src/database/connection');
const { initializeSchema, migrateSchema } = require('../../src/database/schema');

const tableOrder = [
  'notifications',
  'team_invitations',
  'support_calls',
  'support_requests',
  'evaluations',
  'submissions',
  'registrations',
  'hackathon_staff',
  'hackathons',
  'sessions',
  'refresh_tokens',
  'team_members',
  'teams',
  'users',
];

function applyDefaultDatabaseEnvironment() {
  process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
  process.env.DB_PORT = process.env.DB_PORT || '3306';
  process.env.DB_USER = process.env.DB_USER || 'hackhub';
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'hackhub';
  process.env.DB_NAME = process.env.DB_NAME || 'hackhub_test';
  process.env.DB_POOL_SIZE = process.env.DB_POOL_SIZE || '10';
}

async function createInitializedDatabase() {
  applyDefaultDatabaseEnvironment();
  const database = createDatabase();
  await initializeSchema(database);
  await migrateSchema(database);
  return database;
}

async function resetDatabase(database) {
  await database.execute('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of tableOrder) {
      await database.execute(`TRUNCATE TABLE \`${table}\``);
    }
  } finally {
    await database.execute('SET FOREIGN_KEY_CHECKS = 1');
  }
}

module.exports = {
  applyDefaultDatabaseEnvironment,
  createInitializedDatabase,
  resetDatabase,
};
