const amqp = require('amqplib');

// One connection per process, shared by the publisher and the consumer. A failed or closed connection is forgotten,
// so the next caller opens a new one.
class RabbitMqConnection {
  constructor({ url, connect = amqp.connect }) {
    this.url = url;
    this.connectImpl = connect;
    this.connection = null;
    this.connecting = null;
    this.closing = false;
  }

  getConnection() {
    if (this.closing) return Promise.reject(new Error('La connessione RabbitMQ è chiusa.'));
    if (this.connection) return Promise.resolve(this.connection);
    if (!this.connecting) this.connecting = this.establish();
    return this.connecting;
  }

  async establish() {
    try {
      const connection = await this.connectImpl(this.url);
      const forget = () => {
        if (this.connection === connection) this.connection = null;
      };
      connection.on('error', forget);
      connection.on('close', forget);
      this.connection = connection;
      return connection;
    } finally {
      this.connecting = null;
    }
  }

  async close() {
    this.closing = true;
    let connection = this.connection;
    this.connection = null;
    if (!connection && this.connecting) connection = await this.connecting.catch(() => null);
    if (connection) await connection.close().catch(() => {});
  }
}

module.exports = { RabbitMqConnection };
