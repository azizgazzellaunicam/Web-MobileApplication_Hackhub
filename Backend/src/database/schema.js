async function initializeSchema(database) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS teams (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS team_members (
      team_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      PRIMARY KEY (team_id, user_id),
      CONSTRAINT fk_team_members_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS hackathons (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      regulation TEXT NOT NULL,
      registration_deadline VARCHAR(32) NOT NULL,
      start_date VARCHAR(32) NOT NULL,
      end_date VARCHAR(32) NOT NULL,
      location VARCHAR(255) NOT NULL,
      prize DECIMAL(10,2) NOT NULL,
      max_team_size INT UNSIGNED NOT NULL,
      organizer_id INT UNSIGNED NOT NULL,
      status_override VARCHAR(32) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS hackathon_staff (
      hackathon_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      role VARCHAR(32) NOT NULL,
      PRIMARY KEY (hackathon_id, user_id, role),
      CONSTRAINT fk_hackathon_staff_hackathon FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS registrations (
      hackathon_id INT UNSIGNED NOT NULL,
      team_id INT UNSIGNED NOT NULL,
      PRIMARY KEY (hackathon_id, team_id),
      CONSTRAINT fk_registrations_hackathon FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE,
      CONSTRAINT fk_registrations_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS submissions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      hackathon_id INT UNSIGNED NOT NULL,
      team_id INT UNSIGNED NOT NULL,
      content TEXT NOT NULL,
      submitted_at DATETIME NOT NULL,
      UNIQUE KEY submissions_hackathon_team_unique (hackathon_id, team_id),
      CONSTRAINT fk_submissions_hackathon FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE,
      CONSTRAINT fk_submissions_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS evaluations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      submission_id INT UNSIGNED NOT NULL,
      judge_id INT UNSIGNED NOT NULL,
      score DECIMAL(4,2) NOT NULL CHECK (score >= 0 AND score <= 10),
      comment TEXT NOT NULL,
      UNIQUE KEY evaluations_submission_judge_unique (submission_id, judge_id),
      CONSTRAINT fk_evaluations_submission FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS winners (
      hackathon_id INT UNSIGNED NOT NULL PRIMARY KEY,
      team_id INT UNSIGNED NOT NULL,
      CONSTRAINT fk_winners_hackathon FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE,
      CONSTRAINT fk_winners_team FOREIGN KEY (team_id) REFERENCES teams(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS support_requests (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      hackathon_id INT UNSIGNED NOT NULL,
      team_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      topic VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      priority VARCHAR(32) NOT NULL DEFAULT 'MEDIA',
      open TINYINT(1) NOT NULL DEFAULT 1,
      CONSTRAINT fk_support_requests_hackathon FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE,
      CONSTRAINT fk_support_requests_team FOREIGN KEY (team_id) REFERENCES teams(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS support_calls (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_id INT UNSIGNED NOT NULL,
      mentor_id INT UNSIGNED NOT NULL,
      scheduled_at VARCHAR(32) NOT NULL,
      link TEXT NOT NULL,
      CONSTRAINT fk_support_calls_request FOREIGN KEY (request_id) REFERENCES support_requests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS team_invitations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      team_id INT UNSIGNED NOT NULL,
      invited_user_id INT UNSIGNED NOT NULL,
      inviter_user_id INT UNSIGNED NOT NULL,
      sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(32) NOT NULL DEFAULT 'IN_ATTESA',
      UNIQUE KEY team_invitations_pending_unique (team_id, invited_user_id, status),
      CONSTRAINT fk_team_invitations_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      type VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      entity_type VARCHAR(64) NULL,
      entity_id INT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    'CREATE UNIQUE INDEX IF NOT EXISTS team_members_one_team_per_user ON team_members(user_id)',
    `CREATE TABLE IF NOT EXISTS inbox_events (
      event_id CHAR(36) NOT NULL PRIMARY KEY,
      event_type VARCHAR(64) NOT NULL,
      received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ];

  for (const statement of statements) {
    await database.execute(statement);
  }
}

async function migrateSchema(database) {

  const [statusOverrideColumn] = await database.execute(`
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'hackathons'
      AND COLUMN_NAME = 'status_override'
    LIMIT 1
  `);
  if (!statusOverrideColumn.length) {
    await database.execute('ALTER TABLE hackathons ADD COLUMN status_override VARCHAR(32) NULL');
  }

  const [duplicateMember] = await database.execute(`
    SELECT user_id
    FROM team_members
    GROUP BY user_id
    HAVING COUNT(*) > 1
    LIMIT 1
  `);
  if (duplicateMember.length) {
    throw new Error(`Impossibile applicare il vincolo di team unico: l’utente ${duplicateMember[0].user_id} appartiene a più team.`);
  }

  await database.execute('CREATE UNIQUE INDEX IF NOT EXISTS team_members_one_team_per_user ON team_members(user_id)');

  const [legacyWinnerColumn] = await database.execute(`
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'hackathons'
      AND COLUMN_NAME = 'winner_team_id'
    LIMIT 1
  `);
  if (legacyWinnerColumn.length) {
    await database.execute(`
      INSERT IGNORE INTO winners (hackathon_id, team_id)
      SELECT id, winner_team_id FROM hackathons WHERE winner_team_id IS NOT NULL
    `);
    await database.execute('ALTER TABLE hackathons DROP FOREIGN KEY fk_hackathons_winner_team');
    await database.execute('ALTER TABLE hackathons DROP COLUMN winner_team_id');
  }

  const [legacyUserForeignKeys] = await database.execute(`
    SELECT TABLE_NAME AS tableName, CONSTRAINT_NAME AS constraintName
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME = 'users'
      AND TABLE_NAME NOT IN ('sessions', 'refresh_tokens')
  `);
  for (const { tableName, constraintName } of legacyUserForeignKeys) {
    await database.execute(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${constraintName}\``);
  }
}

module.exports = { initializeSchema, migrateSchema };
