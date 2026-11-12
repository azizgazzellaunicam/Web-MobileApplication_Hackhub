async function validateStartupConfiguration({ runtimeEnvironment, database }) {
  if (runtimeEnvironment === 'production' && process.env.HACKHUB_SEED_DEMO === 'true') {
    throw new Error('HACKHUB_SEED_DEMO non può essere abilitato in produzione.');
  }
  if (runtimeEnvironment === 'production') {
    const [demoAccount] = await database.execute(`
      SELECT 1 AS found
      FROM users
      WHERE email IN (?, ?, ?, ?)
      LIMIT 1
    `, ['mario@hackhub.it', 'admin@hackhub.it', 'giudice@hackhub.it', 'mentore@hackhub.it']);
    if (demoAccount.length) throw new Error('Account demo rilevato nel database di produzione.');
  }
  if (process.env.HACKHUB_SEED_DEMO === 'true'
    && !['development', 'test'].includes(runtimeEnvironment)) {
    throw new Error('Il seed demo richiede NODE_ENV=development o NODE_ENV=test.');
  }
}

async function seedDemoData({ runtimeEnvironment, database, hashPassword }) {
  if (!['development', 'test'].includes(runtimeEnvironment)
    || process.env.HACKHUB_SEED_DEMO === 'false') return;
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

    const [marioRows] = await connection.execute('SELECT id FROM users WHERE email=?', ['mario@hackhub.it']);
    const [adminRows] = await connection.execute('SELECT id FROM users WHERE email=?', ['admin@hackhub.it']);
    const [judgeRows] = await connection.execute('SELECT id FROM users WHERE email=?', ['giudice@hackhub.it']);
    const [mentorRows] = await connection.execute('SELECT id FROM users WHERE email=?', ['mentore@hackhub.it']);

    const mario = marioRows[0].id;
    const admin = adminRows[0].id;
    const judge = judgeRows[0].id;
    const mentor = mentorRows[0].id;

    const [teamResult] = await connection.execute('INSERT INTO teams(name) VALUES(?)', ['Team Alpha']);
    const team = teamResult.insertId;
    await connection.execute('INSERT INTO team_members(team_id,user_id) VALUES(?,?)', [team, mario]);

    const hackathonSql = `
      INSERT INTO hackathons(
        name,regulation,registration_deadline,start_date,end_date,location,prize,max_team_size,organizer_id
      ) VALUES(?,?,?,?,?,?,?,?,?)
    `;
    const [openResult] = await connection.execute(hackathonSql, [
      'HackHub Demo - Iscrizioni',
      'Costruisci una soluzione digitale innovativa.',
      '2026-12-01T23:59:00Z',
      '2026-12-02T09:00:00Z',
      '2026-12-04T18:00:00Z',
      'Roma',
      500,
      5,
      admin,
    ]);
    const [runningResult] = await connection.execute(hackathonSql, [
      'HackHub Demo - In Corso',
      'Progetta il futuro della collaborazione.',
      '2026-01-01T23:59:00Z',
      '2026-01-02T09:00:00Z',
      '2026-12-31T18:00:00Z',
      'Milano',
      750,
      5,
      admin,
    ]);
    const [evaluationResult] = await connection.execute(hackathonSql, [
      'HackHub Demo - Valutazione',
      'Una sfida dedicata all’impatto sociale.',
      '2025-01-01T23:59:00Z',
      '2025-01-02T09:00:00Z',
      '2025-06-30T18:00:00Z',
      'Torino',
      1000,
      5,
      admin,
    ]);

    for (const id of [openResult.insertId, runningResult.insertId, evaluationResult.insertId]) {
      await connection.execute('INSERT INTO hackathon_staff(hackathon_id,user_id,role) VALUES(?,?,?)', [id, judge, 'JUDGE']);
      await connection.execute('INSERT INTO hackathon_staff(hackathon_id,user_id,role) VALUES(?,?,?)', [id, mentor, 'MENTOR']);
    }
    await connection.execute('INSERT INTO registrations(hackathon_id,team_id) VALUES(?,?)', [runningResult.insertId, team]);
    await connection.execute('INSERT INTO submissions(hackathon_id,team_id,content,submitted_at) VALUES(?,?,?,CURRENT_TIMESTAMP)', [runningResult.insertId, team, 'https://repo.demo/team-alpha']);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function cleanDemoData({ runtimeEnvironment, database }) {
  if (!['development', 'test'].includes(runtimeEnvironment)) return;

  const [demoEvaluationRows] = await database.execute("SELECT id FROM hackathons WHERE name='HackHub Demo - Valutazione'");
  const [demoTeamRows] = await database.execute("SELECT id FROM teams WHERE name='Team Alpha'");
  const demoEvaluation = demoEvaluationRows[0];
  const demoTeam = demoTeamRows[0];
  if (demoEvaluation && demoTeam) {
    await database.execute('DELETE FROM submissions WHERE hackathon_id=? AND team_id=?', [demoEvaluation.id, demoTeam.id]);
    await database.execute('DELETE FROM registrations WHERE hackathon_id=? AND team_id=?', [demoEvaluation.id, demoTeam.id]);
  }
  const [demoRunningRows] = await database.execute("SELECT id FROM hackathons WHERE name='HackHub Demo - In Corso'");
  const demoRunning = demoRunningRows[0];
  if (demoRunning && demoTeam) {
    await database.execute('DELETE FROM registrations WHERE team_id=? AND hackathon_id<>?', [demoTeam.id, demoRunning.id]);
  }
}

module.exports = { validateStartupConfiguration, seedDemoData, cleanDemoData };
