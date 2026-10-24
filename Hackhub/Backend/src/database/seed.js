function validateStartupConfiguration({ runtimeEnvironment, repository }) {
  if (runtimeEnvironment === 'production' && process.env.HACKHUB_SEED_DEMO === 'true') {
    throw new Error('HACKHUB_SEED_DEMO non può essere abilitato in produzione.');
  }
  if (runtimeEnvironment === 'production') {
    const demoAccount = repository.prepare(`
      SELECT 1 FROM users
      WHERE email IN (
        'mario@hackhub.it', 'admin@hackhub.it', 'giudice@hackhub.it', 'mentore@hackhub.it',
        'mario.demo@demo.hackhub.local', 'admin.demo@demo.hackhub.local',
        'giudice.demo@demo.hackhub.local', 'mentore.demo@demo.hackhub.local'
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
    || process.env.HACKHUB_SEED_DEMO !== 'true') return;
  const demoPasswords = {
    user: process.env.HACKHUB_DEMO_USER_PASSWORD,
    organizer: process.env.HACKHUB_DEMO_ORGANIZER_PASSWORD,
    judge: process.env.HACKHUB_DEMO_JUDGE_PASSWORD,
    mentor: process.env.HACKHUB_DEMO_MENTOR_PASSWORD,
  };
  if (Object.values(demoPasswords).some((password) => !password || password.length < 16)) {
    throw new Error('Ogni password demo deve essere fornita dall’ambiente e contenere almeno 16 caratteri.');
  }
  if (repository.prepare('SELECT COUNT(*) AS count FROM users').get().count) return;
  const add = repository.prepare('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)');
  add.run('Mario Demo', 'mario.demo@demo.hackhub.local', hashPassword(demoPasswords.user), 'USER');
  add.run('Admin Demo', 'admin.demo@demo.hackhub.local', hashPassword(demoPasswords.organizer), 'ORGANIZER');
  add.run('Giudice Demo', 'giudice.demo@demo.hackhub.local', hashPassword(demoPasswords.judge), 'JUDGE');
  add.run('Mentore Demo', 'mentore.demo@demo.hackhub.local', hashPassword(demoPasswords.mentor), 'MENTOR');
  const mario = repository.prepare('SELECT id FROM users WHERE email=?').get('mario.demo@demo.hackhub.local').id;
  const admin = repository.prepare('SELECT id FROM users WHERE email=?').get('admin.demo@demo.hackhub.local').id;
  const judge = repository.prepare('SELECT id FROM users WHERE email=?').get('giudice.demo@demo.hackhub.local').id;
  const mentor = repository.prepare('SELECT id FROM users WHERE email=?').get('mentore.demo@demo.hackhub.local').id;
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

function cleanDemoData(repository) {
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
