const { assertDemoSeedAllowed, isDemoSeedEnabled } = require('./demo-settings');

const demoAccountEmails = ['mario@hackhub.it', 'admin@hackhub.it', 'giudice@hackhub.it', 'mentore@hackhub.it'];

async function validateIdentityStartupConfiguration({ runtimeEnvironment, database }) {
  assertDemoSeedAllowed(runtimeEnvironment);
  if (runtimeEnvironment === 'production') {
    const [demoAccount] = await database.execute(`
      SELECT 1 AS found
      FROM users
      WHERE email IN (?, ?, ?, ?)
      LIMIT 1
    `, demoAccountEmails);
    if (demoAccount.length) throw new Error('Account demo rilevato nel database di produzione.');
  }
}

async function seedIdentityDemoData({ runtimeEnvironment, database, hashPassword }) {
  if (!isDemoSeedEnabled(runtimeEnvironment)) return;
  const demoPasswords = {
    user: process.env.HACKHUB_DEMO_USER_PASSWORD || 'password',
    organizer: process.env.HACKHUB_DEMO_ORGANIZER_PASSWORD || 'password',
    judge: process.env.HACKHUB_DEMO_JUDGE_PASSWORD || 'password',
    mentor: process.env.HACKHUB_DEMO_MENTOR_PASSWORD || 'password',
  };
  if (Object.values(demoPasswords).some((password) => !password || password.length < 8)) {
    throw new Error('Ogni password demo deve contenere almeno 8 caratteri.');
  }

  const [existingUsersRows] = await database.execute('SELECT COUNT(*) AS count FROM users');
  const existingUsers = Number(existingUsersRows[0].count);
  if (existingUsers) {
    const updateSql = 'UPDATE users SET email=?, password_hash=? WHERE email=?';
    await database.execute(updateSql, ['mario@hackhub.it', hashPassword(demoPasswords.user), 'mario.demo@demo.hackhub.local']);
    await database.execute(updateSql, ['admin@hackhub.it', hashPassword(demoPasswords.organizer), 'admin.demo@demo.hackhub.local']);
    await database.execute(updateSql, ['giudice@hackhub.it', hashPassword(demoPasswords.judge), 'giudice.demo@demo.hackhub.local']);
    await database.execute(updateSql, ['mentore@hackhub.it', hashPassword(demoPasswords.mentor), 'mentore.demo@demo.hackhub.local']);
    await database.execute(updateSql, ['mario@hackhub.it', hashPassword(demoPasswords.user), 'mario@hackhub.it']);
    await database.execute(updateSql, ['admin@hackhub.it', hashPassword(demoPasswords.organizer), 'admin@hackhub.it']);
    await database.execute(updateSql, ['giudice@hackhub.it', hashPassword(demoPasswords.judge), 'giudice@hackhub.it']);
    await database.execute(updateSql, ['mentore@hackhub.it', hashPassword(demoPasswords.mentor), 'mentore@hackhub.it']);
    return;
  }

  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)', ['Mario Demo', 'mario@hackhub.it', hashPassword(demoPasswords.user), 'USER']);
    await connection.execute('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)', ['Admin Demo', 'admin@hackhub.it', hashPassword(demoPasswords.organizer), 'ORGANIZER']);
    await connection.execute('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)', ['Giudice Demo', 'giudice@hackhub.it', hashPassword(demoPasswords.judge), 'JUDGE']);
    await connection.execute('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)', ['Mentore Demo', 'mentore@hackhub.it', hashPassword(demoPasswords.mentor), 'MENTOR']);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { validateIdentityStartupConfiguration, seedIdentityDemoData };
