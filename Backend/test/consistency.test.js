const assert = require('node:assert/strict');
const test = require('node:test');
const { TeamRepository } = require('../src/modules/team/team-repository');
const { TeamService } = require('../src/modules/team/team-service');
const { HttpIdentityDirectory } = require('../src/modules/identity/http-identity-directory');
const { createInitializedDatabase, resetDatabase, testServiceToken } = require('./helpers/mariadb-test-utils');

async function setupTeam(t) {
  const database = await createInitializedDatabase();
  t.after(() => database.end());
  await resetDatabase(database);
  const repository = new TeamRepository(database);
  const team = await repository.create('Alpha', 1);
  return { database, repository, team };
}

test('a failed notification rolls back the team invitation it was created for', async (t) => {
  const { database, repository, team } = await setupTeam(t);
  const service = new TeamService(
    repository,
    { create: async () => { throw new Error('notification store unavailable'); } },
    { findIdByEmail: async () => ({ id: 2 }) },
    {},
    {},
  );

  await assert.rejects(service.invite(team.id, 1, 'invitee@example.com'), /notification store unavailable/);

  const [[count]] = await database.execute('SELECT COUNT(*) AS count FROM team_invitations');
  assert.equal(Number(count.count), 0);
});

test('an unavailable Identity service stops a team invitation before any local write', async (t) => {
  const { database, repository, team } = await setupTeam(t);
  const identityDirectory = new HttpIdentityDirectory({
    baseUrl: 'http://127.0.0.1:9',
    serviceToken: testServiceToken,
  });
  const service = new TeamService(repository, { create: async () => {} }, identityDirectory, {}, {});

  await assert.rejects(service.invite(team.id, 1, 'invitee@example.com'), (error) => error.status === 502);

  const [[count]] = await database.execute('SELECT COUNT(*) AS count FROM team_invitations');
  assert.equal(Number(count.count), 0);
});
