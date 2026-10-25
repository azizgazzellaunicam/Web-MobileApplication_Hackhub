const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const databasePath = path.join(os.tmpdir(), `hackhub-role-workflow-${process.pid}-${Date.now()}.sqlite`);
process.env.NODE_ENV = 'test';
process.env.HACKHUB_SEED_DEMO = 'true';
process.env.HACKHUB_DEMO_USER_PASSWORD = 'test-user-demo-password-2026';
process.env.HACKHUB_DEMO_ORGANIZER_PASSWORD = 'test-organizer-demo-password-2026';
process.env.HACKHUB_DEMO_JUDGE_PASSWORD = 'test-judge-demo-password-2026';
process.env.HACKHUB_DEMO_MENTOR_PASSWORD = 'test-mentor-demo-password-2026';
process.env.HACKHUB_DB_PATH = databasePath;

const { app, database } = require('../src/app');
let server;
let baseUrl;

test.before(() => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
  database.close();
  for (const suffix of ['', '-shm', '-wal']) {
    const file = `${databasePath}${suffix}`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});

async function request(url, options = {}) {
  const { headers = {}, ...fetchOptions } = options;
  const response = await fetch(`${baseUrl}${url}`, {
    ...fetchOptions,
    headers: { 'content-type': 'application/json', ...headers },
  });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

function asUser(token, options = {}) {
  return {
    ...options,
    headers: { ...options.headers, cookie: `hackhub_session=${token}` },
  };
}

async function login(email, password) {
  const { response, body } = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  assert.equal(Object.hasOwn(body, 'token'), false);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /hackhub_session=[^;]+; Max-Age=28800; Path=\/; HttpOnly; SameSite=Lax/);
  return cookie.match(/hackhub_session=([^;]+)/)[1];
}

async function createHackathon(organizerToken, staff, name) {
  return request('/api/hackathons', asUser(organizerToken, {
    method: 'POST',
    body: JSON.stringify({
      name,
      regulation: 'Regolamento per i test del workflow.',
      registrationDeadline: '2027-01-01T23:59:00Z',
      startDate: '2027-01-02T09:00:00Z',
      endDate: '2027-01-04T18:00:00Z',
      location: 'Roma',
      prize: 500,
      maxTeamSize: 5,
      judgeId: staff.find((member) => member.role === 'JUDGE').id,
      mentorId: staff.find((member) => member.role === 'MENTOR').id,
    }),
  }));
}

test('participants can join a team by invitation and manage their notifications', async () => {
  const participantToken = await login('mario@hackhub.it', 'test-user-demo-password-2026');
  const email = `workflow-${Date.now()}@example.test`;
  const registration = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Workflow Invitee', email, password: 'invitee-password-2026' }),
  });
  assert.equal(registration.response.status, 200);
  assert.equal(registration.body.role, 'USER');
  assert.equal(Object.hasOwn(registration.body, 'token'), false);
  const inviteeCookie = registration.response.headers.get('set-cookie');
  assert.match(inviteeCookie, /hackhub_session=[^;]+/);

  const teams = await request('/api/teams', asUser(participantToken));
  const teamId = teams.body[0].id;
  const invitation = await request(`/api/teams/${teamId}/invitations`, asUser(participantToken, {
    method: 'POST',
    body: JSON.stringify({ email }),
  }));
  assert.equal(invitation.response.status, 201);

  const inviteeToken = inviteeCookie.match(/hackhub_session=([^;]+)/)[1];
  const invitations = await request('/api/invitations', asUser(inviteeToken));
  assert.equal(invitations.body.length, 1);
  assert.equal(invitations.body[0].status, 'IN_ATTESA');
  const accepted = await request(`/api/invitations/${invitation.body.id}/accept`, asUser(inviteeToken, {
    method: 'POST',
    body: JSON.stringify({}),
  }));
  assert.equal(accepted.response.status, 200);
  const inviteeTeams = await request('/api/teams', asUser(inviteeToken));
  assert.equal(inviteeTeams.body[0].id, teamId);
  assert.match(inviteeTeams.body[0].members, /Workflow Invitee/);

  const notificationList = await request('/api/notifications', asUser(inviteeToken));
  const inviteNotification = notificationList.body.items.find((item) => item.type === 'INVITATION');
  assert.ok(inviteNotification);
  const marked = await request(`/api/notifications/${inviteNotification.id}/read`, asUser(inviteeToken, {
    method: 'PUT',
    body: JSON.stringify({}),
  }));
  assert.equal(marked.response.status, 204);
  const unreadCount = await request('/api/notifications/unread-count', asUser(inviteeToken));
  assert.equal(unreadCount.body.unreadCount, 0);
  const profileUpdate = await request('/api/auth/profile', asUser(inviteeToken, {
    method: 'PUT',
    body: JSON.stringify({ name: 'Updated Invitee', email }),
  }));
  assert.equal(profileUpdate.response.status, 200);
  assert.equal(profileUpdate.body.name, 'Updated Invitee');

  const rejectedEmail = `rejected-${Date.now()}@example.test`;
  const rejectedInvitee = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Rejected Invitee', email: rejectedEmail, password: 'rejected-password-2026' }),
  });
  const rejectedInviteeToken = rejectedInvitee.response.headers.get('set-cookie').match(/hackhub_session=([^;]+)/)[1];
  const rejectedInvitation = await request(`/api/teams/${teamId}/invitations`, asUser(participantToken, {
    method: 'POST',
    body: JSON.stringify({ email: rejectedEmail }),
  }));
  const rejectResult = await request(`/api/invitations/${rejectedInvitation.body.id}/reject`, asUser(rejectedInviteeToken, {
    method: 'POST',
    body: JSON.stringify({}),
  }));
  assert.equal(rejectResult.response.status, 200);
  const rejectedList = await request('/api/invitations', asUser(rejectedInviteeToken));
  assert.equal(rejectedList.body[0].status, 'RIFIUTATO');

  const soloEmail = `solo-${Date.now()}@example.test`;
  const solo = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Solo Participant', email: soloEmail, password: 'solo-password-2026' }),
  });
  const soloToken = solo.response.headers.get('set-cookie').match(/hackhub_session=([^;]+)/)[1];
  const createdTeam = await request('/api/teams', asUser(soloToken, {
    method: 'POST',
    body: JSON.stringify({ name: `Solo Team ${Date.now()}` }),
  }));
  assert.equal(createdTeam.response.status, 201);
  const leftTeam = await request(`/api/teams/${createdTeam.body.id}/membership`, asUser(soloToken, {
    method: 'DELETE',
  }));
  assert.equal(leftTeam.response.status, 200);
  const soloTeams = await request('/api/teams', asUser(soloToken));
  assert.deepEqual(soloTeams.body, []);
});

test('organizer, participant, judge, and mentor complete an event workflow', async () => {
  const organizerToken = await login('admin@hackhub.it', 'test-organizer-demo-password-2026');
  const judgeToken = await login('giudice@hackhub.it', 'test-judge-demo-password-2026');
  const mentorToken = await login('mentore@hackhub.it', 'test-mentor-demo-password-2026');
  const participantToken = await login('mario@hackhub.it', 'test-user-demo-password-2026');
  const staffResult = await request('/api/staff', asUser(organizerToken));
  assert.equal(staffResult.response.status, 200);

  const created = await createHackathon(organizerToken, staffResult.body, `Workflow ${Date.now()}`);
  assert.equal(created.response.status, 201);
  const hackathonId = created.body.id;

  const secondJudgeId = database.prepare(
    'INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)',
  ).run('Workflow Secondary Judge', `judge-${Date.now()}@example.test`, 'unused-test-hash', 'JUDGE').lastInsertRowid;
  const assignment = await request(`/api/hackathons/${hackathonId}/staff`, asUser(organizerToken, {
    method: 'POST',
    body: JSON.stringify({ userId: secondJudgeId, role: 'JUDGE' }),
  }));
  assert.equal(assignment.response.status, 201);
  const duplicateAssignment = await request(`/api/hackathons/${hackathonId}/staff`, asUser(organizerToken, {
    method: 'POST',
    body: JSON.stringify({ userId: secondJudgeId, role: 'JUDGE' }),
  }));
  assert.equal(duplicateAssignment.response.status, 409);

  const updated = await request(`/api/hackathons/${hackathonId}`, asUser(organizerToken, {
    method: 'PUT',
    body: JSON.stringify({ name: `${created.body.name} aggiornato` }),
  }));
  assert.equal(updated.response.status, 200);
  assert.match(updated.body.name, /aggiornato/);

  const judgeAssignments = await request('/api/hackathons/assigned', asUser(judgeToken));
  const mentorAssignments = await request('/api/hackathons/assigned', asUser(mentorToken));
  assert.ok(judgeAssignments.body.some((item) => item.id === hackathonId));
  assert.ok(mentorAssignments.body.some((item) => item.id === hackathonId));
  const evaluationBefore = await request('/api/hackathons/evaluation', asUser(judgeToken));
  assert.ok(!evaluationBefore.body.some((item) => item.id === hackathonId));

  const teams = await request('/api/teams', asUser(participantToken));
  const teamId = teams.body[0].id;
  const leaveStartedTeam = await request(`/api/teams/${teamId}/membership`, asUser(participantToken, {
    method: 'DELETE',
  }));
  assert.equal(leaveStartedTeam.response.status, 409);
  const allTeams = await request('/api/teams/all', asUser(organizerToken));
  assert.ok(allTeams.body.some((team) => team.id === teamId));
  const statusOpen = await request(`/api/hackathons/${hackathonId}/status`, asUser(organizerToken, {
    method: 'PUT',
    body: JSON.stringify({ status: 'ISCRIZIONI_APERTE' }),
  }));
  assert.equal(statusOpen.body.status, 'ISCRIZIONI_APERTE');
  const registration = await request(`/api/hackathons/${hackathonId}/registrations`, asUser(participantToken, {
    method: 'POST',
    body: JSON.stringify({}),
  }));
  assert.equal(registration.response.status, 201);

  await request(`/api/hackathons/${hackathonId}/status`, asUser(organizerToken, {
    method: 'PUT',
    body: JSON.stringify({ status: 'IN_CORSO' }),
  }));
  const submission = await request(`/api/hackathons/${hackathonId}/submissions`, asUser(participantToken, {
    method: 'POST',
    body: JSON.stringify({ content: 'https://example.test/project' }),
  }));
  assert.equal(submission.response.status, 201);
  const editedSubmission = await request(`/api/submissions/${submission.body.id}`, asUser(participantToken, {
    method: 'PUT',
    body: JSON.stringify({ content: 'https://example.test/project-v2' }),
  }));
  assert.equal(editedSubmission.body.content, 'https://example.test/project-v2');

  const supportRequest = await request('/api/support-requests', asUser(participantToken, {
    method: 'POST',
    body: JSON.stringify({
      hackathonId,
      teamId,
      topic: 'Problema tecnico',
      description: 'Serve aiuto con il prototipo.',
    }),
  }));
  assert.equal(supportRequest.response.status, 201);
  const participantDetails = await request(`/api/support-requests/${supportRequest.body.id}`, asUser(participantToken));
  assert.equal(participantDetails.response.status, 200);
  const mentorDetails = await request(`/api/support-requests/${supportRequest.body.id}`, asUser(mentorToken));
  assert.equal(mentorDetails.response.status, 200);
  const judgeDetails = await request(`/api/support-requests/${supportRequest.body.id}`, asUser(judgeToken));
  assert.equal(judgeDetails.response.status, 403);
  const judgeSupportList = await request(`/api/hackathons/${hackathonId}/support-requests`, asUser(judgeToken));
  assert.equal(judgeSupportList.response.status, 403);
  const openRequests = await request('/api/support-requests/open', asUser(mentorToken));
  assert.ok(openRequests.body.some((item) => item.id === supportRequest.body.id));
  const mineRequests = await request('/api/support-requests/mine', asUser(participantToken));
  assert.ok(mineRequests.body.some((item) => item.id === supportRequest.body.id));
  const mentorTeams = await request(`/api/hackathons/${hackathonId}/teams`, asUser(mentorToken));
  assert.equal(mentorTeams.response.status, 200);
  assert.ok(mentorTeams.body.some((item) => item.id === teamId));
  const judgeTeams = await request(`/api/hackathons/${hackathonId}/teams`, asUser(judgeToken));
  assert.equal(judgeTeams.response.status, 403);
  const hackathonRequests = await request(`/api/hackathons/${hackathonId}/support-requests`, asUser(mentorToken));
  assert.ok(hackathonRequests.body.some((item) => item.id === supportRequest.body.id));
  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const call = await request(`/api/support-requests/${supportRequest.body.id}/calls`, asUser(mentorToken, {
    method: 'POST',
    body: JSON.stringify({ scheduledAt }),
  }));
  assert.equal(call.response.status, 201);
  assert.match(call.body.link, /^https:\/\/calendar\.hackhub\.local\/call\//);
  const judgeClose = await request(`/api/support-requests/${supportRequest.body.id}/close`, asUser(judgeToken, {
    method: 'POST',
    body: JSON.stringify({}),
  }));
  assert.equal(judgeClose.response.status, 403);
  const closedRequest = await request(`/api/support-requests/${supportRequest.body.id}/close`, asUser(mentorToken, {
    method: 'POST',
    body: JSON.stringify({}),
  }));
  assert.equal(closedRequest.response.status, 204);
  const participantOwnedRequest = await request('/api/support-requests', asUser(participantToken, {
    method: 'POST',
    body: JSON.stringify({
      hackathonId,
      teamId,
      topic: 'Ultimo controllo',
      description: 'Richiesta chiusa dal suo autore.',
    }),
  }));
  assert.equal(participantOwnedRequest.response.status, 201);
  const participantClose = await request(`/api/support-requests/${participantOwnedRequest.body.id}/close`, asUser(participantToken, {
    method: 'POST',
    body: JSON.stringify({}),
  }));
  assert.equal(participantClose.response.status, 204);

  const mentorReport = await request('/api/support-requests/report', asUser(mentorToken, {
    method: 'POST',
    body: JSON.stringify({ hackathonId, teamId, description: 'Segnalazione del mentore.' }),
  }));
  assert.equal(mentorReport.response.status, 201);
  assert.equal(mentorReport.body.topic, 'SEGNALAZIONE');

  await request(`/api/hackathons/${hackathonId}/status`, asUser(organizerToken, {
    method: 'PUT',
    body: JSON.stringify({ status: 'VALUTAZIONE' }),
  }));
  const evaluationHackathons = await request('/api/hackathons/evaluation', asUser(judgeToken));
  assert.ok(evaluationHackathons.body.some((item) => item.id === hackathonId));
  const submissions = await request(`/api/hackathons/${hackathonId}/submissions`, asUser(judgeToken));
  assert.equal(submissions.body.length, 1);
  const mentorEvaluation = await request(`/api/submissions/${submission.body.id}/evaluations`, asUser(mentorToken, {
    method: 'POST',
    body: JSON.stringify({ score: 9, comment: 'Il mentore non può valutare.' }),
  }));
  assert.equal(mentorEvaluation.response.status, 403);
  const evaluation = await request(`/api/submissions/${submission.body.id}/evaluations`, asUser(judgeToken, {
    method: 'POST',
    body: JSON.stringify({ score: 9.5, comment: 'Ottimo lavoro.' }),
  }));
  assert.equal(evaluation.response.status, 201);
  const duplicateEvaluation = await request(`/api/submissions/${submission.body.id}/evaluations`, asUser(judgeToken, {
    method: 'POST',
    body: JSON.stringify({ score: 8, comment: 'Secondo voto.' }),
  }));
  assert.equal(duplicateEvaluation.response.status, 409);

  const ranking = await request(`/api/hackathons/${hackathonId}/ranking`, asUser(organizerToken));
  assert.equal(ranking.body.entries[0].teamId, teamId);
  const winner = await request(`/api/hackathons/${hackathonId}/winner/auto`, asUser(organizerToken, {
    method: 'POST',
    body: JSON.stringify({}),
  }));
  assert.equal(winner.response.status, 200);
  assert.equal(winner.body.winner.teamId, teamId);
  const wins = await request('/api/profile/wins', asUser(participantToken));
  assert.ok(wins.body.some((item) => item.id === hackathonId));
  const notifications = await request('/api/notifications', asUser(participantToken));
  assert.ok(notifications.body.items.some((item) => item.type === 'VICTORY' && item.entity_id === hackathonId));

  const manualEvent = await createHackathon(organizerToken, staffResult.body, `Manual winner ${Date.now()}`);
  assert.equal(manualEvent.response.status, 201);
  await request(`/api/hackathons/${manualEvent.body.id}/status`, asUser(organizerToken, {
    method: 'PUT',
    body: JSON.stringify({ status: 'ISCRIZIONI_APERTE' }),
  }));
  const secondRegistration = await request(`/api/hackathons/${manualEvent.body.id}/registrations`, asUser(participantToken, {
    method: 'POST',
    body: JSON.stringify({}),
  }));
  assert.equal(secondRegistration.response.status, 201);
  await request(`/api/hackathons/${manualEvent.body.id}/status`, asUser(organizerToken, {
    method: 'PUT',
    body: JSON.stringify({ status: 'IN_CORSO' }),
  }));
  const secondSubmission = await request(`/api/hackathons/${manualEvent.body.id}/submissions`, asUser(participantToken, {
    method: 'POST',
    body: JSON.stringify({ content: 'https://example.test/manual-winner' }),
  }));
  assert.equal(secondSubmission.response.status, 201);
  await request(`/api/hackathons/${manualEvent.body.id}/status`, asUser(organizerToken, {
    method: 'PUT',
    body: JSON.stringify({ status: 'VALUTAZIONE' }),
  }));
  const secondEvaluation = await request(`/api/submissions/${secondSubmission.body.id}/evaluations`, asUser(judgeToken, {
    method: 'POST',
    body: JSON.stringify({ score: 8, comment: 'Valutazione valida.' }),
  }));
  assert.equal(secondEvaluation.response.status, 201);
  const manualWinner = await request(`/api/hackathons/${manualEvent.body.id}/winner/${teamId}`, asUser(organizerToken, {
    method: 'POST',
    body: JSON.stringify({}),
  }));
  assert.equal(manualWinner.response.status, 200);
  assert.equal(manualWinner.body.teamId, teamId);

  const deletable = await createHackathon(organizerToken, staffResult.body, `Delete ${Date.now()}`);
  assert.equal(deletable.response.status, 201);
  const forbiddenDelete = await request(`/api/hackathons/${deletable.body.id}`, asUser(participantToken, {
    method: 'DELETE',
  }));
  assert.equal(forbiddenDelete.response.status, 403);
  const deleted = await request(`/api/hackathons/${deletable.body.id}`, asUser(organizerToken, {
    method: 'DELETE',
  }));
  assert.equal(deleted.response.status, 204);
  const missingEvent = await request(`/api/hackathons/${deletable.body.id}`);
  assert.equal(missingEvent.response.status, 404);
});

test('role-restricted actions reject users without the required role', async () => {
  const participantToken = await login('mario@hackhub.it', 'test-user-demo-password-2026');
  const judgeToken = await login('giudice@hackhub.it', 'test-judge-demo-password-2026');
  const organizerStaff = await request('/api/staff', asUser(participantToken));
  const allTeams = await request('/api/teams/all', asUser(judgeToken));
  const mentorReport = await request('/api/support-requests/report', asUser(judgeToken, {
    method: 'POST',
    body: JSON.stringify({ hackathonId: 1, teamId: 1, description: 'Non consentito.' }),
  }));
  const createHackathonAsParticipant = await request('/api/hackathons', asUser(participantToken, {
    method: 'POST',
    body: JSON.stringify({}),
  }));
  const assignAsJudge = await request('/api/hackathons/1/staff', asUser(judgeToken, {
    method: 'POST',
    body: JSON.stringify({ userId: 3, role: 'JUDGE' }),
  }));
  assert.equal(organizerStaff.response.status, 403);
  assert.equal(allTeams.response.status, 403);
  assert.equal(mentorReport.response.status, 403);
  assert.equal(createHackathonAsParticipant.response.status, 403);
  assert.equal(assignAsJudge.response.status, 403);
});
