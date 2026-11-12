const mysql = require('mysql2/promise');

function readRequiredEnvironmentVariable(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`La variabile d'ambiente ${name} è obbligatoria.`);
  }
  return value;
}

function readPort() {
  const rawPort = process.env.DB_PORT || '3306';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('DB_PORT deve essere un numero intero positivo.');
  }
  return port;
}

function createDatabase() {
  const connectionLimit = Number(process.env.DB_POOL_SIZE || 10);
  if (!Number.isInteger(connectionLimit) || connectionLimit <= 0) {
    throw new Error('DB_POOL_SIZE deve essere un numero intero positivo.');
  }

  return mysql.createPool({
    host: readRequiredEnvironmentVariable('DB_HOST'),
    port: readPort(),
    user: readRequiredEnvironmentVariable('DB_USER'),
    password: readRequiredEnvironmentVariable('DB_PASSWORD'),
    database: readRequiredEnvironmentVariable('DB_NAME'),
    waitForConnections: true,
    connectionLimit,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
  });
}

module.exports = { createDatabase };
