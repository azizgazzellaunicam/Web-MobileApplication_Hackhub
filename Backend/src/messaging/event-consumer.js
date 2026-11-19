const {
  assertEventTopology,
  backendQueue,
  defaultRetryDelaysMs,
  deadLetterExchange,
  retryExchange,
} = require('./event-topology');

const eventIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class InvalidEventError extends Error {}

function parseEvent(content) {
  let message;
  try {
    message = JSON.parse(content.toString('utf8'));
  } catch {
    throw new InvalidEventError('Il messaggio non è JSON valido.');
  }
  const { id, type, payload } = message ?? {};
  if (typeof id !== 'string' || !eventIdPattern.test(id)
    || typeof type !== 'string' || !type || type.length > 64
    || typeof payload !== 'object' || payload === null) {
    throw new InvalidEventError('Evento non valido.');
  }
  return { id, type, payload };
}

function readFailures(headers) {
  return Number(headers?.['x-attempts']) || 0;
}

// Consumes the backend queue and hands each event to the inbox. Processing is sequential, so events are handled
// one at a time in the order RabbitMQ delivers them. A message is acknowledged only after its outcome is safe:
// the inbox committed it, or the retry/dead-letter copy was confirmed by RabbitMQ.
class EventConsumer {
  constructor({
    connection,
    inboxService,
    retryDelaysMs = defaultRetryDelaysMs,
    prefetch = 10,
    reconnectDelayMs = 2000,
    logger = console,
  }) {
    this.connection = connection;
    this.inboxService = inboxService;
    this.retryDelaysMs = retryDelaysMs;
    this.prefetch = prefetch;
    this.reconnectDelayMs = reconnectDelayMs;
    this.logger = logger;
    this.channel = null;
    this.stopped = true;
    this.reconnectTimer = null;
    this.chain = Promise.resolve();
    this.received = 0;
    this.settled = 0;
  }

  start() {
    this.stopped = false;
    this.connect();
  }

  async connect() {
    if (this.stopped) return;
    try {
      const connection = await this.connection.getConnection();
      const channel = await connection.createConfirmChannel();
      channel.on('error', () => {});
      channel.on('close', () => {
        if (this.channel !== channel) return;
        this.channel = null;
        this.scheduleReconnect();
      });
      if (this.stopped) {
        await channel.close().catch(() => {});
        return;
      }
      await assertEventTopology(channel, { retryDelaysMs: this.retryDelaysMs });
      await channel.prefetch(this.prefetch);
      await channel.consume(backendQueue, (message) => {
        if (message === null) {
          // RabbitMQ cancelled the consumer (for example the queue was deleted): open a new channel.
          this.channel = null;
          channel.close().catch(() => {});
          this.scheduleReconnect();
          return;
        }
        this.received += 1;
        this.chain = this.chain
          .then(() => this.process(channel, message))
          .catch((error) => {
            this.logger.error(error);
          })
          .finally(() => {
            this.settled += 1;
          });
      });
      this.channel = channel;
    } catch (error) {
      this.logger.error(error);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelayMs);
  }

  async process(channel, message) {
    const failures = readFailures(message.properties.headers);
    let event;
    try {
      event = parseEvent(message.content);
    } catch (error) {
      await this.deadLetter(channel, message, failures + 1, error.message);
      return;
    }
    try {
      await this.inboxService.receive(event);
    } catch (error) {
      const attempt = failures + 1;
      if (attempt > this.retryDelaysMs.length) {
        await this.deadLetter(channel, message, attempt, `Consegna esaurita: ${error.message}`);
      } else {
        await this.retry(channel, message, attempt, error.message);
      }
      return;
    }
    channel.ack(message);
  }

  async retry(channel, message, attempt, reason) {
    const delayMs = this.retryDelaysMs[attempt - 1];
    await this.publishConfirmed(channel, retryExchange, String(delayMs), message, {
      'x-attempts': attempt,
      'x-last-error': reason,
    });
    channel.ack(message);
  }

  async deadLetter(channel, message, attempt, reason) {
    await this.publishConfirmed(channel, deadLetterExchange, '', message, {
      'x-attempts': attempt,
      'x-last-error': reason,
    });
    channel.ack(message);
  }

  async publishConfirmed(channel, exchange, routingKey, message, headers) {
    const { properties, fields, content } = message;
    const options = {
      persistent: true,
      contentType: properties.contentType,
      messageId: properties.messageId,
      correlationId: properties.correlationId,
      type: properties.type,
      headers: { ...properties.headers, ...headers },
    };
    const key = exchange === retryExchange ? routingKey : fields.routingKey;
    if (!channel.publish(exchange, key, content, options)) {
      await new Promise((resolve) => channel.once('drain', resolve));
    }
    await channel.waitForConfirms();
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    await this.chain;
    const channel = this.channel;
    this.channel = null;
    if (channel) await channel.close().catch(() => {});
  }
}

module.exports = { EventConsumer, parseEvent };
