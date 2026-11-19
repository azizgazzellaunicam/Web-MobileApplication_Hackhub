const express = require('express');
const { createDatabase } = require('./database/connection');
const { initializeIdentitySchema } = require('./database/identity-schema');
const { validateIdentityStartupConfiguration, seedIdentityDemoData } = require('./database/identity-seed');
const { readServiceToken } = require('./security/service-token');
const { hashPassword, verifyPassword } = require('./security/password');
const { createAuthMiddleware } = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');
const { UserRepository } = require('./modules/identity/user-repository');
const { RefreshTokenRepository } = require('./modules/identity/refresh-token-repository');
const { AuthService } = require('./modules/identity/auth-service');
const { registerIdentityRoutes } = require('./modules/identity/identity-controller');
const { registerIdentityInternalRoutes } = require('./modules/identity/identity-internal-controller');
const { OutboxRepository } = require('./modules/identity/outbox-repository');
const { OutboxRelay } = require('./modules/identity/outbox-relay');
const { RabbitMqConnection } = require('./messaging/rabbitmq-connection');
const { EventPublisher } = require('./messaging/event-publisher');

async function createIdentityApp({ env = process.env } = {}) {
  const database = createDatabase(env);
  try {
    const port = Number(env.PORT || 3001);
    const runtimeEnvironment = env.NODE_ENV || 'development';
    readServiceToken(env);
    const rabbitMqUrl = env.RABBITMQ_URL;
    if (!rabbitMqUrl) throw new Error('La variabile d\'ambiente RABBITMQ_URL è obbligatoria.');
    await initializeIdentitySchema(database);
    await validateIdentityStartupConfiguration({ runtimeEnvironment, database });
    await seedIdentityDemoData({ runtimeEnvironment, database, hashPassword });

    const userRepository = new UserRepository(database);
    const refreshTokenRepository = new RefreshTokenRepository(database);
    const authService = new AuthService(userRepository, refreshTokenRepository, hashPassword, verifyPassword);
    const { auth } = createAuthMiddleware();
    const connection = new RabbitMqConnection({ url: rabbitMqUrl });
    const publisher = new EventPublisher({ connection });
    const outboxRelay = new OutboxRelay({
      repository: new OutboxRepository(database),
      publisher,
    });

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
    registerIdentityRoutes({ app, auth, authService, userRepository });
    registerIdentityInternalRoutes({ app, serviceToken: readServiceToken(env), userRepository });
    app.use(errorHandler);
    app.use(notFoundHandler);

    return { app, database, port, outboxRelay, publisher, connection };
  } catch (error) {
    await database.end();
    throw error;
  }
}

module.exports = { createIdentityApp };
