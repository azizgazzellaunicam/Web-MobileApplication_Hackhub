const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../src/database/connection');
const { initializeSchema, migrateSchema } = require('../src/database/schema');
const { TeamRepository } = require('../src/repository/team-repository');
const { TeamService } = require('../src/service/team-service');

function withDatabase(callback) {
  const databasePath = path.join(os.tmpdir(), `hackhub-team-${process.pid}-${Date.now()}.sqlite`);
  const database = createDatabase(databasePath);
  try {
    initializeSchema(database);
    migrateSchema(database);
    callback(database);
  } finally {
    database.close();
    for (const suffix of ['', '-shm', '-wal']) {
      const file = `${databasePath}${suffix}`;
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
}

function seedUsers(database) {
  database.prepare(`
    INSERT INTO users(id,name,email,password_hash) VALUES
      (1,'First','first@example.test','hash'),
      (2,'Second','second@example.test','hash')
  `).run();
}

test('enforces one team per user at the database level', () => {
  withDatabase((database) => {
    seedUsers(database);
    const teams = new TeamRepository(database);
    const first = teams.create('First team', 1);
    teams.create('Second team', 2);
    assert.throws(() => teams.create('Duplicate membership', 1), /UNIQUE constraint failed/);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM teams').get().count, 2);
    assert.ok(teams.findMember(first.id, 1));
  });
});

test('maps unique-membership race failures to conflict responses', () => {
  const duplicateMembership = Object.assign(
    new Error('UNIQUE constraint failed: team_members.user_id'),
    { code: 'ERR_SQLITE_ERROR' },
  );
  const teamService = new TeamService({
    findByMember: () => null,
    create: () => { throw duplicateMembership; },
    findInvitation: () => ({ id: 3, team_id: 4 }),
    setInvitationStatus: () => { throw duplicateMembership; },
  }, {});

  assert.throws(() => teamService.create(7, 'User', 'Team'), { status: 409 });
  assert.throws(() => teamService.decideInvitation(3, 7, 'accept'), { status: 409 });
});

test('rolls back team creation if adding its first member fails', () => {
  withDatabase((database) => {
    seedUsers(database);
    database.exec(`
      CREATE TRIGGER fail_team_member_insert
      BEFORE INSERT ON team_members
      BEGIN SELECT RAISE(ABORT, 'test member failure'); END
    `);
    assert.throws(() => new TeamRepository(database).create('Incomplete team', 1), /test member failure/);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM teams').get().count, 0);
  });
});

test('rolls back invitation acceptance if updating the invitation fails', () => {
  withDatabase((database) => {
    seedUsers(database);
    const team = new TeamRepository(database).create('Existing team', 1);
    const invite = new TeamRepository(database).createInvitation(team.id, 2, 1);
    database.exec(`
      CREATE TRIGGER fail_invitation_accept
      BEFORE UPDATE OF status ON team_invitations
      WHEN NEW.status='ACCETTATO'
      BEGIN SELECT RAISE(ABORT, 'test invitation failure'); END
    `);

    assert.throws(
      () => new TeamRepository(database).setInvitationStatus(invite.id, team.id, 'ACCETTATO', 2),
      /test invitation failure/,
    );
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM team_members WHERE user_id=2').get().count, 0);
    assert.equal(database.prepare('SELECT status FROM team_invitations WHERE id=?').get(invite.id).status, 'IN_ATTESA');
  });
});

test('fails clearly when migrating existing users in multiple teams', () => {
  const databasePath = path.join(os.tmpdir(), `hackhub-team-legacy-${process.pid}-${Date.now()}.sqlite`);
  const database = createDatabase(databasePath);
  try {
    database.exec(`
      CREATE TABLE hackathons (id INTEGER PRIMARY KEY, status_override TEXT);
      CREATE TABLE team_members (team_id INTEGER NOT NULL, user_id INTEGER NOT NULL);
      INSERT INTO team_members(team_id,user_id) VALUES(1,7),(2,7);
    `);
    assert.throws(() => migrateSchema(database), /utente 7 appartiene a più team/);
  } finally {
    database.close();
    for (const suffix of ['', '-shm', '-wal']) {
      const file = `${databasePath}${suffix}`;
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
});
