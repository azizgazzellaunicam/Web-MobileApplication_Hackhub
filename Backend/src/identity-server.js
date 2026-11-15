const { createServer } = require('node:http');
const { createIdentityApp } = require('./identity-app');

if (require.main === module) {
  createIdentityApp().then(({ app, database, port, outboxRelay }) => {
    const server = createServer(app).listen(port, () => {
      console.log(`HackHub Identity Service in ascolto sulla porta ${port}`);
    });
    outboxRelay.start();

    const shutdown = () => {
      outboxRelay.stop();
      server.close(() => database.end().then(() => process.exit(0)));
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
