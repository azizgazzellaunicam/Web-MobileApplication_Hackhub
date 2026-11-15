const { createDatabase } = require('../../src/database/connection');
const { initializeSchema, migrateSchema } = require('../../src/database/schema');
const { initializeIdentitySchema } = require('../../src/database/identity-schema');

const identityDatabaseName = 'hackhub_identity_test';
const testServiceToken = 'test-service-token-that-is-at-least-32-characters-long';

const tableOrder = [
  'notifications',
  'team_invitations',
  'support_calls',
  'support_requests',
  'evaluations',
  'submissions',
  'registrations',
  'winners',
  'inbox_events',
  'hackathon_staff',
  'hackathons',
  'team_members',
  'teams',
];

const identityTableOrder = [
  'outbox_events',
  'sessions',
  'refresh_tokens',
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

function identityDatabaseEnvironment() {
  return { ...process.env, DB_NAME: identityDatabaseName };
}

async function createInitializedDatabase() {
  applyDefaultDatabaseEnvironment();
  const database = createDatabase();
  await initializeSchema(database);
  await migrateSchema(database);
  return database;
}

async function createInitializedIdentityDatabase() {
  applyDefaultDatabaseEnvironment();
  const database = createDatabase(identityDatabaseEnvironment());
  await initializeIdentitySchema(database);
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

async function resetIdentityDatabase(database) {
  await database.execute('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of identityTableOrder) {
      await database.execute(`TRUNCATE TABLE \`${table}\``);
    }
  } finally {
    await database.execute('SET FOREIGN_KEY_CHECKS = 1');
  }
}

async function startIdentityService({ backendUrl = 'http://127.0.0.1:9' } = {}) {
  applyDefaultDatabaseEnvironment();
  process.env.HACKHUB_SERVICE_TOKEN = testServiceToken;
  process.env.BACKEND_SERVICE_URL = backendUrl;
  const { createIdentityApp } = require('../../src/identity-app');
  const { app, database, outboxRelay } = await createIdentityApp({
    env: { ...identityDatabaseEnvironment(), BACKEND_SERVICE_URL: backendUrl },
  });
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  process.env.IDENTITY_SERVICE_URL = baseUrl;
  return {
    baseUrl,
    database,
    outboxRelay,
    close: async () => {
      outboxRelay.stop();
      server.close();
      await database.end();
    },
  };
}

module.exports = {
  applyDefaultDatabaseEnvironment,
  createInitializedDatabase,
  createInitializedIdentityDatabase,
  resetDatabase,
  resetIdentityDatabase,
  startIdentityService,
  testServiceToken,
};
