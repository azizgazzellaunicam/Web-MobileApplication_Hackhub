const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createDatabase } = require('../src/database/connection');
const { initializeSchema, migrateSchema } = require('../src/database/schema');
const { initializeIdentitySchema } = require('../src/database/identity-schema');

const identityTables = ['users', 'sessions', 'refresh_tokens'];
const domainTableOrder = [
  'teams',
  'team_members',
  'hackathons',
  'hackathon_staff',
  'registrations',
  'submissions',
  'evaluations',
  'support_requests',
  'support_calls',
  'team_invitations',
  'notifications',
];

function resolveSqlitePath() {
  const sourcePath = process.env.SQLITE_SOURCE_PATH || path.join(__dirname, '..', 'hackhub.sqlite');
  return path.resolve(sourcePath);
}

function createIdentityDatabase(env = process.env) {
  return createDatabase({
    ...env,
    DB_HOST: env.IDENTITY_DB_HOST || env.DB_HOST,
    DB_PORT: env.IDENTITY_DB_PORT || env.DB_PORT,
    DB_USER: env.IDENTITY_DB_USER || env.DB_USER,
    DB_PASSWORD: env.IDENTITY_DB_PASSWORD || env.DB_PASSWORD,
    DB_NAME: env.IDENTITY_DB_NAME || 'hackhub_identity',
  });
}

function buildInsertStatement(table, columns) {
  const escapedColumns = columns.map((column) => `\`${column}\``).join(',');
  const placeholders = columns.map(() => '?').join(',');
  return `
    INSERT INTO \`${table}\` (${escapedColumns})
    VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE \`${columns[0]}\`=\`${columns[0]}\`
  `;
}

async function migrateTable(pool, sqliteDatabase, table) {
  const rows = sqliteDatabase.prepare(`SELECT * FROM ${table}`).all();
  if (!rows.length) return;
  // hackathons.winner_team_id is now stored in the winners table (see migrateWinners).
  const columns = Object.keys(rows[0]).filter((column) => column !== 'winner_team_id');
  const sql = buildInsertStatement(table, columns);

  for (const row of rows) {
    const values = columns.map((column) => row[column]);
    await pool.execute(sql, values);
  }
}

async function migrateWinners(pool, sqliteDatabase) {
  const columns = sqliteDatabase.prepare('PRAGMA table_info(hackathons)').all().map((column) => column.name);
  if (!columns.includes('winner_team_id')) return;
  const rows = sqliteDatabase.prepare('SELECT id, winner_team_id FROM hackathons WHERE winner_team_id IS NOT NULL').all();
  for (const row of rows) {
    await pool.execute('INSERT IGNORE INTO winners (hackathon_id, team_id) VALUES (?, ?)', [row.id, row.winner_team_id]);
  }
}

async function synchronizeAutoIncrement(pool, table) {
  const [rows] = await pool.execute(`SELECT MAX(id) AS maxId FROM \`${table}\``);
  const maxId = Number(rows[0]?.maxId || 0);
  if (maxId > 0) {
    await pool.execute(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${maxId + 1}`);
  }
}

async function run() {
  const sqlitePath = resolveSqlitePath();
  const sqliteDatabase = new DatabaseSync(sqlitePath, { readOnly: true });
  const pool = createDatabase();
  const identityPool = createIdentityDatabase();
  try {
    await initializeSchema(pool);
    await migrateSchema(pool);
    await initializeIdentitySchema(identityPool);
    await identityPool.execute('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of identityTables) {
      await migrateTable(identityPool, sqliteDatabase, table);
    }
    await identityPool.execute('SET FOREIGN_KEY_CHECKS = 1');

    await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of domainTableOrder) {
      await migrateTable(pool, sqliteDatabase, table);
    }
    await migrateWinners(pool, sqliteDatabase);
    await pool.execute('SET FOREIGN_KEY_CHECKS = 1');

    for (const table of ['users', 'refresh_tokens']) {
      await synchronizeAutoIncrement(identityPool, table);
    }
    for (const table of ['teams', 'hackathons', 'submissions', 'evaluations', 'support_requests', 'support_calls', 'team_invitations', 'notifications']) {
      await synchronizeAutoIncrement(pool, table);
    }
    console.log(`Migrazione completata da ${sqlitePath} verso MariaDB.`);
  } finally {
    sqliteDatabase.close();
    await pool.end();
    await identityPool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
