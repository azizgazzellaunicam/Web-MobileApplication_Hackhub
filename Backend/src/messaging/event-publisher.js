const { assertEventTopology, eventsExchange } = require('./event-topology');

const confirmTimeoutMs = 5000;

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Publishes events with publisher confirms. An event is considered published only when RabbitMQ confirms it.
// Publish the events sequentially: waitForConfirms covers every message published on the channel so far.
class EventPublisher {
  constructor({ connection, timeoutMs = confirmTimeoutMs }) {
    this.connection = connection;
    this.timeoutMs = timeoutMs;
    this.channel = null;
    this.opening = null;
  }

  async publish({ id, type, occurredAt, payload }) {
    const channel = await this.getChannel();
    const body = Buffer.from(JSON.stringify({ id, type, occurredAt, payload }));
    const options = {
      persistent: true,
      contentType: 'application/json',
      messageId: id,
      correlationId: id,
      type,
    };
    try {
      await withTimeout(
        this.publishAndConfirm(channel, type, body, options),
        this.timeoutMs,
        'RabbitMQ non ha confermato il messaggio in tempo.',
      );
    } catch (error) {
      await this.discardChannel(channel);
      throw error;
    }
  }

  async publishAndConfirm(channel, type, body, options) {
    if (!channel.publish(eventsExchange, type, body, options)) {
      await new Promise((resolve) => channel.once('drain', resolve));
    }
    await channel.waitForConfirms();
  }

  async getChannel() {
    if (this.channel) return this.channel;
    if (!this.opening) {
      this.opening = this.openChannel().finally(() => {
        this.opening = null;
      });
    }
    return this.opening;
  }

  async openChannel() {
    const connection = await this.connection.getConnection();
    const channel = await connection.createConfirmChannel();
    channel.on('error', () => {});
    channel.on('close', () => {
      if (this.channel === channel) this.channel = null;
    });
    try {
      await assertEventTopology(channel);
    } catch (error) {
      await closeQuietly(channel);
      throw error;
    }
    this.channel = channel;
    return channel;
  }

  async discardChannel(channel) {
    if (this.channel === channel) this.channel = null;
    await closeQuietly(channel);
  }

  async close() {
    const channel = this.channel;
    this.channel = null;
    if (channel) await closeQuietly(channel);
  }
}

async function closeQuietly(channel) {
  await channel.close().catch(() => {});
}

module.exports = { EventPublisher, withTimeout };
