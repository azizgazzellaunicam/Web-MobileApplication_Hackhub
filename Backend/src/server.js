const { createServer } = require('node:http');
const { createApp } = require('./app');

if (require.main === module) {
  createApp().then(({ app, database, port, consumer, connection }) => {
    const server = createServer(app).listen(port, () => {
      console.log(`HackHub API in ascolto sulla porta ${port}`);
    });
    consumer.start();

    const shutdown = () => {
      consumer.stop()
        .then(() => connection.close())
        .then(() => new Promise((resolve) => server.close(resolve)))
        .then(() => database.end())
        .then(() => process.exit(0));
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
