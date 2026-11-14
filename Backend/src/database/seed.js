const { assertDemoSeedAllowed, isDemoSeedEnabled } = require('./demo-settings');

async function validateStartupConfiguration({ runtimeEnvironment }) {
  assertDemoSeedAllowed(runtimeEnvironment);
}

async function findDemoUserId(identityDirectory, email) {
  const user = await identityDirectory.findIdByEmail(email);
  return user?.id ?? null;
}

async function seedDemoData({ runtimeEnvironment, database, identityDirectory }) {
  if (!isDemoSeedEnabled(runtimeEnvironment)) return;

  const [existingDemoRows] = await database.execute("SELECT 1 FROM hackathons WHERE name='HackHub Demo - Iscrizioni' LIMIT 1");
  if (existingDemoRows.length) return;

  const mario = await findDemoUserId(identityDirectory, 'mario@hackhub.it');
  const admin = await findDemoUserId(identityDirectory, 'admin@hackhub.it');
  const judge = await findDemoUserId(identityDirectory, 'giudice@hackhub.it');
  const mentor = await findDemoUserId(identityDirectory, 'mentore@hackhub.it');
  if (!mario || !admin || !judge || !mentor) {
    throw new Error('Utenti demo non disponibili nel servizio Identity.');
  }

  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();

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
