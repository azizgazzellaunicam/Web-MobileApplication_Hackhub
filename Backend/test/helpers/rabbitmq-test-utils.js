const amqp = require('amqplib');
const {
  assertEventTopology,
  backendQueue,
  defaultRetryDelaysMs,
  deadLetterExchange,
  deadLetterQueue,
  eventsExchange,
  retryExchange,
  retryQueueName,
} = require('../../src/messaging/event-topology');

// Short delays keep the retry tests fast; they get their own retry queues, separate from production delays.
const testRetryDelaysMs = [20, 40];

async function withConnection(url, action) {
  const connection = await amqp.connect(url);
  try {
    return await action(connection);
  } finally {
    await connection.close();
  }
}

async function resetRabbitMq(url) {
  await withConnection(url, async (connection) => {
    const queues = [
      ...[...defaultRetryDelaysMs, ...testRetryDelaysMs].map(retryQueueName),
      backendQueue,
      deadLetterQueue,
    ];
    for (const queue of queues) {
      const channel = await connection.createChannel();
      await channel.deleteQueue(queue);
      await channel.close().catch(() => {});
    }
    for (const exchange of [eventsExchange, retryExchange, deadLetterExchange]) {
      const channel = await connection.createChannel();
      await channel.deleteExchange(exchange);
      await channel.close().catch(() => {});
    }
    const channel = await connection.createConfirmChannel();
    await assertEventTopology(channel, { retryDelaysMs: testRetryDelaysMs });
    await channel.close();
  });
}

// Publishes a raw message to the events exchange, bypassing the publisher, to simulate malformed input.
async function publishRaw(url, { routingKey, content, options = {} }) {
  await withConnection(url, async (connection) => {
    const channel = await connection.createConfirmChannel();
    channel.publish(eventsExchange, routingKey, Buffer.from(content), { persistent: true, ...options });
    await channel.waitForConfirms();
    await channel.close();
  });
}

// Removes and returns every message currently in the queue.
async function drainQueue(url, queue) {
  return withConnection(url, async (connection) => {
    const channel = await connection.createChannel();
    const messages = [];
    for (let message = await channel.get(queue, { noAck: true }); message !== false;
      message = await channel.get(queue, { noAck: true })) {
      messages.push(message);
    }
    await channel.close();
    return messages;
  });
}

async function queueMessageCount(url, queue) {
  return withConnection(url, async (connection) => {
    const channel = await connection.createChannel();
    const { messageCount } = await channel.checkQueue(queue);
    await channel.close();
    return messageCount;
  });
}

async function waitUntil(check, { timeoutMs = 10000, intervalMs = 25 } = {}) {
  const startedAt = Date.now();
  for (;;) {
    if (await check()) return;
    if (Date.now() - startedAt > timeoutMs) throw new Error('La condizione non è stata soddisfatta in tempo.');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

module.exports = {
  drainQueue,
  publishRaw,
  queueMessageCount,
  resetRabbitMq,
  testRetryDelaysMs,
  waitUntil,
};
