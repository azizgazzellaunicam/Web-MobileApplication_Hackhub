function initializeSchema(database) {
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'USER',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS teams (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS team_members (team_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
      PRIMARY KEY(team_id, user_id), FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS hackathons (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, regulation TEXT NOT NULL, registration_deadline TEXT NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, location TEXT NOT NULL, prize REAL NOT NULL,
      max_team_size INTEGER NOT NULL, organizer_id INTEGER NOT NULL, winner_team_id INTEGER,
      status_override TEXT,
      FOREIGN KEY(organizer_id) REFERENCES users(id), FOREIGN KEY(winner_team_id) REFERENCES teams(id)
    );
    CREATE TABLE IF NOT EXISTS hackathon_staff (
      hackathon_id INTEGER NOT NULL, user_id INTEGER NOT NULL, role TEXT NOT NULL,
      PRIMARY KEY(hackathon_id, user_id, role), FOREIGN KEY(hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS registrations (hackathon_id INTEGER NOT NULL, team_id INTEGER NOT NULL,
      PRIMARY KEY(hackathon_id, team_id), FOREIGN KEY(hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE,
      FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY, hackathon_id INTEGER NOT NULL, team_id INTEGER NOT NULL, content TEXT NOT NULL,
      submitted_at TEXT NOT NULL, UNIQUE(hackathon_id, team_id), FOREIGN KEY(hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE,
      FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY, submission_id INTEGER NOT NULL, judge_id INTEGER NOT NULL,
      score REAL NOT NULL CHECK(score >= 0 AND score <= 10), comment TEXT NOT NULL,
      UNIQUE(submission_id, judge_id), FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
      FOREIGN KEY(judge_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS support_requests (
      id INTEGER PRIMARY KEY, hackathon_id INTEGER NOT NULL, team_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
      topic TEXT NOT NULL, description TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'MEDIA', open INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY(hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE, FOREIGN KEY(team_id) REFERENCES teams(id),
      FOREIGN KEY(user_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS support_calls (
      id INTEGER PRIMARY KEY, request_id INTEGER NOT NULL, mentor_id INTEGER NOT NULL, scheduled_at TEXT NOT NULL,
      link TEXT NOT NULL, FOREIGN KEY(request_id) REFERENCES support_requests(id) ON DELETE CASCADE, FOREIGN KEY(mentor_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS team_invitations (
      id INTEGER PRIMARY KEY, team_id INTEGER NOT NULL, invited_user_id INTEGER NOT NULL,
      inviter_user_id INTEGER NOT NULL, sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'IN_ATTESA',
      UNIQUE(team_id, invited_user_id, status),
      FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY(invited_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(inviter_user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

function migrateSchema(database) {
  try {
    database.exec('ALTER TABLE hackathons ADD COLUMN status_override TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) throw error;
  }
  const duplicateMember = database.prepare(`
    SELECT user_id FROM team_members GROUP BY user_id HAVING COUNT(*) > 1 LIMIT 1
  `).get();
  if (duplicateMember) {
    throw new Error(`Impossibile applicare il vincolo di team unico: l’utente ${duplicateMember.user_id} appartiene a più team.`);
  }
  database.exec('CREATE UNIQUE INDEX IF NOT EXISTS team_members_one_team_per_user ON team_members(user_id)');
}

module.exports = { initializeSchema, migrateSchema };
