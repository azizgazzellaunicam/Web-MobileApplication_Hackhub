const { createServer } = require('node:http');
const { createApp } = require('./app');

if (require.main === module) {
  createApp().then(({ app, port }) => {
    createServer(app).listen(port, () => {
      console.log(`HackHub API in ascolto sulla porta ${port}`);
    });
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
