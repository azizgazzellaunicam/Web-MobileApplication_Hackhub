function validateStartupConfiguration({ runtimeEnvironment, repository }) {
  if (runtimeEnvironment === 'production' && process.env.HACKHUB_SEED_DEMO === 'true') {
    throw new Error('HACKHUB_SEED_DEMO non può essere abilitato in produzione.');
  }
  if (runtimeEnvironment === 'production') {
    const demoAccount = repository.prepare(`
      SELECT 1 FROM users
      WHERE email IN (
        'mario@hackhub.it', 'admin@hackhub.it', 'giudice@hackhub.it', 'mentore@hackhub.it'
      )
      LIMIT 1
    `).get();
    if (demoAccount) throw new Error('Account demo rilevato nel database di produzione.');
  }
  if (process.env.HACKHUB_SEED_DEMO === 'true'
    && !['development', 'test'].includes(runtimeEnvironment)) {
    throw new Error('Il seed demo richiede NODE_ENV=development o NODE_ENV=test.');
  }
}

function seedDemoData({ runtimeEnvironment, repository, hashPassword }) {
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
  const existingUsers = repository.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (existingUsers) {
    const updateDemoUser = repository.prepare('UPDATE users SET email=?, password_hash=? WHERE email=?');
    updateDemoUser.run('mario@hackhub.it', hashPassword(demoPasswords.user), 'mario.demo@demo.hackhub.local');
    updateDemoUser.run('admin@hackhub.it', hashPassword(demoPasswords.organizer), 'admin.demo@demo.hackhub.local');
    updateDemoUser.run('giudice@hackhub.it', hashPassword(demoPasswords.judge), 'giudice.demo@demo.hackhub.local');
    updateDemoUser.run('mentore@hackhub.it', hashPassword(demoPasswords.mentor), 'mentore.demo@demo.hackhub.local');
    updateDemoUser.run('mario@hackhub.it', hashPassword(demoPasswords.user), 'mario@hackhub.it');
    updateDemoUser.run('admin@hackhub.it', hashPassword(demoPasswords.organizer), 'admin@hackhub.it');
    updateDemoUser.run('giudice@hackhub.it', hashPassword(demoPasswords.judge), 'giudice@hackhub.it');
    updateDemoUser.run('mentore@hackhub.it', hashPassword(demoPasswords.mentor), 'mentore@hackhub.it');
    return;
  }
  const add = repository.prepare('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)');
  add.run('Mario Demo', 'mario@hackhub.it', hashPassword(demoPasswords.user), 'USER');
  add.run('Admin Demo', 'admin@hackhub.it', hashPassword(demoPasswords.organizer), 'ORGANIZER');
  add.run('Giudice Demo', 'giudice@hackhub.it', hashPassword(demoPasswords.judge), 'JUDGE');
  add.run('Mentore Demo', 'mentore@hackhub.it', hashPassword(demoPasswords.mentor), 'MENTOR');
  const mario = repository.prepare('SELECT id FROM users WHERE email=?').get('mario@hackhub.it').id;
  const admin = repository.prepare('SELECT id FROM users WHERE email=?').get('admin@hackhub.it').id;
  const judge = repository.prepare('SELECT id FROM users WHERE email=?').get('giudice@hackhub.it').id;
  const mentor = repository.prepare('SELECT id FROM users WHERE email=?').get('mentore@hackhub.it').id;
  const team = repository.prepare('INSERT INTO teams(name) VALUES(?)').run('Team Alpha').lastInsertRowid;
  repository.prepare('INSERT INTO team_members(team_id,user_id) VALUES(?,?)').run(team, mario);
  const addHackathon = repository.prepare('INSERT INTO hackathons(name,regulation,registration_deadline,start_date,end_date,location,prize,max_team_size,organizer_id) VALUES(?,?,?,?,?,?,?,?,?)');
  const open = addHackathon.run('HackHub Demo - Iscrizioni', 'Costruisci una soluzione digitale innovativa.', '2026-12-01T23:59:00Z', '2026-12-02T09:00:00Z', '2026-12-04T18:00:00Z', 'Roma', 500, 5, admin).lastInsertRowid;
  const running = addHackathon.run('HackHub Demo - In Corso', 'Progetta il futuro della collaborazione.', '2026-01-01T23:59:00Z', '2026-01-02T09:00:00Z', '2026-12-31T18:00:00Z', 'Milano', 750, 5, admin).lastInsertRowid;
  const evaluation = addHackathon.run('HackHub Demo - Valutazione', 'Una sfida dedicata all’impatto sociale.', '2025-01-01T23:59:00Z', '2025-01-02T09:00:00Z', '2025-06-30T18:00:00Z', 'Torino', 1000, 5, admin).lastInsertRowid;
  const staff = repository.prepare('INSERT INTO hackathon_staff(hackathon_id,user_id,role) VALUES(?,?,?)');
  for (const id of [open, running, evaluation]) { staff.run(id, judge, 'JUDGE'); staff.run(id, mentor, 'MENTOR'); }
  repository.prepare('INSERT INTO registrations(hackathon_id,team_id) VALUES(?,?)').run(running, team);
  repository.prepare('INSERT INTO submissions(hackathon_id,team_id,content,submitted_at) VALUES(?,?,?,CURRENT_TIMESTAMP)').run(running, team, 'https://repo.demo/team-alpha');
}

function cleanDemoData({ runtimeEnvironment, repository }) {
  if (!['development', 'test'].includes(runtimeEnvironment)) return;

  const demoEvaluation = repository.prepare("SELECT id FROM hackathons WHERE name='HackHub Demo - Valutazione'").get();
  const demoTeam = repository.prepare("SELECT id FROM teams WHERE name='Team Alpha'").get();
  if (demoEvaluation && demoTeam) {
    repository.prepare('DELETE FROM submissions WHERE hackathon_id=? AND team_id=?').run(demoEvaluation.id, demoTeam.id);
    repository.prepare('DELETE FROM registrations WHERE hackathon_id=? AND team_id=?').run(demoEvaluation.id, demoTeam.id);
  }
  const demoRunning = repository.prepare("SELECT id FROM hackathons WHERE name='HackHub Demo - In Corso'").get();
  if (demoRunning && demoTeam) {
    repository.prepare('DELETE FROM registrations WHERE team_id=? AND hackathon_id<>?').run(demoTeam.id, demoRunning.id);
  }
}

module.exports = { validateStartupConfiguration, seedDemoData, cleanDemoData };
