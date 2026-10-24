const { createServer } = require('node:http');
const { app, port } = require('./app');

if (require.main === module) {
  createServer(app).listen(port, () => {
    console.log(`HackHub API in ascolto sulla porta ${port}`);
  });
}

module.exports = { app };
