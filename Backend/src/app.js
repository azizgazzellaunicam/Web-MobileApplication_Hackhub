const express = require('express');
const { selectHighestScoreWinner } = require('./strategy/highest-score-winner');
const { HackathonGateway } = require('./gateway/hackathon-gateway');
const { FakePaymentAdapter } = require('./adapter/fake-payment-adapter');
const { FakeCalendarAdapter } = require('./adapter/fake-calendar-adapter');
const { createDatabase } = require('./database/connection');
const { initializeSchema, migrateSchema } = require('./database/schema');
const { validateStartupConfiguration, seedDemoData, cleanDemoData } = require('./database/seed');
const { createAuthMiddleware } = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');

const { createHttpIdentityDirectory } = require('./modules/identity/http-identity-directory');

const { TeamRepository } = require('./modules/team/team-repository');
const { TeamDirectory } = require('./modules/team/team-directory');
const { TeamService } = require('./modules/team/team-service');
const { registerTeamRoutes } = require('./modules/team/team-controller');

const { HackathonRepository } = require('./modules/hackathon/hackathon-repository');
const { HackathonDirectory } = require('./modules/hackathon/hackathon-directory');
const { HackathonService } = require('./modules/hackathon/hackathon-service');
const { registerHackathonRoutes } = require('./modules/hackathon/hackathon-controller');

const { CompetitionRepository } = require('./modules/competition/competition-repository');
const { CompetitionDirectory } = require('./modules/competition/competition-directory');
const { CompetitionService } = require('./modules/competition/competition-service');
const { registerCompetitionRoutes } = require('./modules/competition/competition-controller');

const { SupportRepository } = require('./modules/support/support-repository');
const { SupportService } = require('./modules/support/support-service');
const { registerSupportRoutes } = require('./modules/support/support-controller');

const { NotificationRepository } = require('./modules/notification/notification-repository');
const { NotificationService } = require('./modules/notification/notification-service');
const { registerNotificationRoutes } = require('./modules/notification/notification-controller');

const { InboxRepository } = require('./modules/events/inbox-repository');
const { InboxService } = require('./modules/events/inbox-service');
const { registerEventRoutes } = require('./modules/events/inbox-controller');

const { readServiceToken } = require('./security/service-token');

async function createApp({ env = process.env } = {}) {
  const port = Number(env.PORT || 3000);
  const runtimeEnvironment = env.NODE_ENV || 'development';
  const database = createDatabase(env);
  await initializeSchema(database);
  await migrateSchema(database);
  await validateStartupConfiguration({ runtimeEnvironment });
  const identityDirectory = createHttpIdentityDirectory(env);
  await seedDemoData({ runtimeEnvironment, database, identityDirectory });
  await cleanDemoData({ runtimeEnvironment, database });

  const teamRepository = new TeamRepository(database);
  const teamDirectory = new TeamDirectory(teamRepository);

  const hackathonRepository = new HackathonRepository(database);
  const hackathonDirectory = new HackathonDirectory(hackathonRepository);
  const hackathonService = new HackathonService(hackathonRepository, identityDirectory);

  const competitionRepository = new CompetitionRepository(database);
  const competitionDirectory = new CompetitionDirectory(competitionRepository);

  // NotificationService and CompetitionService depend on each other: notifications read victories through the competition service.
  let competitionService;
  const notificationService = new NotificationService(
    new NotificationRepository(database),
    (userId) => competitionService.victoriesForUser(userId),
  );
  competitionService = new CompetitionService(
    competitionRepository,
    hackathonDirectory,
    teamDirectory,
    identityDirectory,
    selectHighestScoreWinner,
    new FakePaymentAdapter(),
    notificationService,
  );

  const teamService = new TeamService(
    teamRepository,
    notificationService,
    identityDirectory,
    competitionDirectory,
    hackathonDirectory,
  );
  const gateway = new HackathonGateway(hackathonService, hackathonDirectory, teamDirectory, competitionDirectory);
  const supportService = new SupportService(
    new SupportRepository(database),
    hackathonDirectory,
    teamDirectory,
    competitionDirectory,
    new FakeCalendarAdapter(),
  );

  const { auth, authOptional, role } = createAuthMiddleware();

  const app = express();
  app.use(express.json({ limit: '20kb' }));

  app.get('/health', async (_req, res) => {
    try {
      await database.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });
  registerTeamRoutes({ app, auth, role, teamService });
  registerHackathonRoutes({ app, auth, authOptional, role, hackathonService, gateway });
  registerCompetitionRoutes({ app, auth, role, competitionService });
  registerSupportRoutes({ app, auth, role, supportService });
  registerNotificationRoutes({ app, auth, notificationService });
  registerEventRoutes({ app, serviceToken: readServiceToken(env), inboxService: new InboxService(new InboxRepository(database)) });
  app.use(errorHandler);
  app.use(notFoundHandler);

  return { app, database, port };
}

module.exports = { createApp };
