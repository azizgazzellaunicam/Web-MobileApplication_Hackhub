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

async function createIdentityApp({ env = process.env } = {}) {
  const database = createDatabase(env);
  try {
    const port = Number(env.PORT || 3001);
    const runtimeEnvironment = env.NODE_ENV || 'development';
    const serviceToken = readServiceToken(env);
    const backendUrl = env.BACKEND_SERVICE_URL;
    if (!backendUrl) throw new Error('La variabile d\'ambiente BACKEND_SERVICE_URL è obbligatoria.');
    await initializeIdentitySchema(database);
    await validateIdentityStartupConfiguration({ runtimeEnvironment, database });
    await seedIdentityDemoData({ runtimeEnvironment, database, hashPassword });

    const userRepository = new UserRepository(database);
    const refreshTokenRepository = new RefreshTokenRepository(database);
    const authService = new AuthService(userRepository, refreshTokenRepository, hashPassword, verifyPassword);
    const { auth } = createAuthMiddleware();
    const outboxRelay = new OutboxRelay({
      repository: new OutboxRepository(database),
      targetUrl: backendUrl,
      serviceToken,
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
    registerIdentityInternalRoutes({ app, serviceToken, userRepository });
    app.use(errorHandler);
    app.use(notFoundHandler);

    return { app, database, port, outboxRelay };
  } catch (error) {
    await database.end();
    throw error;
  }
}

module.exports = { createIdentityApp };
