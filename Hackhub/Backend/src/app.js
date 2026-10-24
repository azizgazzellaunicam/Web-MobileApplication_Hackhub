const express = require('express');
const { getHackathonStatus } = require('./domain/hackathon-status');
const { selectHighestScoreWinner } = require('./strategy/highest-score-winner');
const { SqliteRepository } = require('./repository/sqlite-repository');
const { UserRepository } = require('./repository/user-repository');
const { HackathonRepository } = require('./repository/hackathon-repository');
const { NotificationRepository } = require('./repository/notification-repository');
const { TeamRepository } = require('./repository/team-repository');
const { CompetitionRepository } = require('./repository/competition-repository');
const { SupportRepository } = require('./repository/support-repository');
const { HackathonService } = require('./service/hackathon-service');
const { AuthService } = require('./service/auth-service');
const { NotificationService } = require('./service/notification-service');
const { TeamService } = require('./service/team-service');
const { CompetitionService } = require('./service/competition-service');
const { SupportService } = require('./service/support-service');
const { ProfileService } = require('./service/profile-service');
const { registerApiRoutes } = require('./controller/api-controller');
const { registerTeamRoutes } = require('./controller/team-controller');
const { registerCompetitionRoutes } = require('./controller/competition-controller');
const { registerSupportRoutes } = require('./controller/support-controller');
const { FakePaymentAdapter } = require('./adapter/fake-payment-adapter');
const { FakeCalendarAdapter } = require('./adapter/fake-calendar-adapter');
const { httpError } = require('./http/http-errors');
const { createDatabase } = require('./database/connection');
const { initializeSchema, migrateSchema } = require('./database/schema');
const { validateStartupConfiguration, seedDemoData, cleanDemoData } = require('./database/seed');
const { hashPassword, verifyPassword } = require('./security/password');
const { createAuthMiddleware } = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');

const port = Number(process.env.PORT || 3000);
const runtimeEnvironment = process.env.NODE_ENV || 'unknown';
const database = createDatabase();
initializeSchema(database);
migrateSchema(database);
const sessions = new Map();
const repository = new SqliteRepository(database);
validateStartupConfiguration({ runtimeEnvironment, repository });
seedDemoData({ runtimeEnvironment, repository, hashPassword });
cleanDemoData({ runtimeEnvironment, repository });

const userRepository = new UserRepository(database);
const hackathonRepository = new HackathonRepository(database);
const notificationRepository = new NotificationRepository(database);
const teamRepository = new TeamRepository(database);
const competitionRepository = new CompetitionRepository(database);
const supportRepository = new SupportRepository(database);
const notificationService = new NotificationService(notificationRepository);
const authService = new AuthService(userRepository, sessions, hashPassword, verifyPassword);
const hackathonService = new HackathonService(hackathonRepository, statusOf);
const teamService = new TeamService(teamRepository, notificationService);
const paymentAdapter = new FakePaymentAdapter();
const calendarAdapter = new FakeCalendarAdapter();
const profileService = new ProfileService(userRepository);
const competitionService = new CompetitionService(
  competitionRepository,
  statusOf,
  selectHighestScoreWinner,
  hackathonRepository,
  paymentAdapter,
  notificationService,
);
const { auth, authOptional, role } = createAuthMiddleware(sessions);

function fail(status, message) {
  throw httpError(status, message);
}

function validate(body, fields) {
  for (const field of fields) {
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      fail(400, `Il campo ${field} è obbligatorio.`);
    }
  }
}

function statusOf(hackathon) {
  return hackathon.status_override || getHackathonStatus(hackathon);
}

function hackathon(row) {
  return row && {
    ...row,
    status: statusOf(row),
    status_override: row.status_override || null,
  };
}

const app = express();
app.use(express.json({ limit: '20kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
registerTeamRoutes({ app, auth, role, teamService });
registerCompetitionRoutes({
  app,
  auth,
  role,
  competitionService,
});
registerSupportRoutes({
  app,
  auth,
  role,
  supportService: new SupportService(supportRepository, statusOf, calendarAdapter),
});
registerApiRoutes({
  app,
  auth,
  authOptional,
  role,
  hackathon,
  authService,
  profileService,
  notificationService,
  hackathonService,
  competitionService,
});
app.use(errorHandler);
app.use(notFoundHandler);

module.exports = { app, database, sessions, port };
