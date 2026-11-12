const assert = require('node:assert/strict');
const test = require('node:test');
const { TeamRepository } = require('../src/repository/team-repository');
const { TeamService } = require('../src/service/team-service');
const { createInitializedDatabase, resetDatabase } = require('./helpers/mariadb-test-utils');

async function seedUsers(database) {
  await database.execute(`
    INSERT INTO users(id,name,email,password_hash) VALUES
      (1,'First','first@example.test','hash'),
      (2,'Second','second@example.test','hash')
  `);
}

test('enforces one team per user at the database level', async () => {
  const database = await createInitializedDatabase();
  try {
    await resetDatabase(database);
    await seedUsers(database);
    const teams = new TeamRepository(database);
    const first = await teams.create('First team', 1);
    await teams.create('Second team', 2);
    await assert.rejects(() => teams.create('Duplicate membership', 1), /Duplicate entry/);
    const [rows] = await database.execute('SELECT COUNT(*) AS count FROM teams');
    assert.equal(Number(rows[0].count), 2);
    assert.ok(await teams.findMember(first.id, 1));
  } finally {
    await database.end();
  }
});

test('maps unique-membership race failures to conflict responses', async () => {
  const duplicateMembership = Object.assign(
    new Error("Duplicate entry '1' for key 'team_members_one_team_per_user'"),
    { code: 'ER_DUP_ENTRY' },
  );
  const teamService = new TeamService({
    findByMember: async () => null,
    create: async () => { throw duplicateMembership; },
    findInvitation: async () => ({ id: 3, team_id: 4 }),
    setInvitationStatus: async () => { throw duplicateMembership; },
  }, { create: async () => {} });

  await assert.rejects(() => teamService.create(7, 'User', 'Team'), { status: 409 });
  await assert.rejects(() => teamService.decideInvitation(3, 7, 'accept'), { status: 409 });
});
