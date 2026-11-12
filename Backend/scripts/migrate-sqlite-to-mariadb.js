const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createDatabase } = require('../src/database/connection');
const { initializeSchema, migrateSchema } = require('../src/database/schema');

const tableOrder = [
  'users',
  'teams',
  'team_members',
  'sessions',
  'refresh_tokens',
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
  const columns = Object.keys(rows[0]);
  const sql = buildInsertStatement(table, columns);

  for (const row of rows) {
    const values = columns.map((column) => row[column]);
    await pool.execute(sql, values);
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
  try {
    await initializeSchema(pool);
    await migrateSchema(pool);
    await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of tableOrder) {
      await migrateTable(pool, sqliteDatabase, table);
    }
    await pool.execute('SET FOREIGN_KEY_CHECKS = 1');

    for (const table of ['users', 'teams', 'refresh_tokens', 'hackathons', 'submissions', 'evaluations', 'support_requests', 'support_calls', 'team_invitations', 'notifications']) {
      await synchronizeAutoIncrement(pool, table);
    }
    console.log(`Migrazione completata da ${sqlitePath} verso MariaDB.`);
  } finally {
    sqliteDatabase.close();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
