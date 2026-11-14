const mysql = require('mysql2/promise');

function readRequiredEnvironmentVariable(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`La variabile d'ambiente ${name} è obbligatoria.`);
  }
  return value;
}

function readPort(env) {
  const rawPort = env.DB_PORT || '3306';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('DB_PORT deve essere un numero intero positivo.');
  }
  return port;
}

function createDatabase(env = process.env) {
  const connectionLimit = Number(env.DB_POOL_SIZE || 10);
  if (!Number.isInteger(connectionLimit) || connectionLimit <= 0) {
    throw new Error('DB_POOL_SIZE deve essere un numero intero positivo.');
  }

  return mysql.createPool({
    host: readRequiredEnvironmentVariable(env, 'DB_HOST'),
    port: readPort(env),
    user: readRequiredEnvironmentVariable(env, 'DB_USER'),
    password: readRequiredEnvironmentVariable(env, 'DB_PASSWORD'),
    database: readRequiredEnvironmentVariable(env, 'DB_NAME'),
    waitForConnections: true,
    connectionLimit,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
  });
}

module.exports = { createDatabase };
