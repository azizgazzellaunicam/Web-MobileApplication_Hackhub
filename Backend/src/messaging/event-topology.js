const eventsExchange = 'hackhub.events';
const retryExchange = 'hackhub.events.retry';
const deadLetterExchange = 'hackhub.events.dead';
const backendQueue = 'hackhub.backend.events';
const deadLetterQueue = 'hackhub.backend.events.dead';
const defaultRetryDelaysMs = [1000, 2000, 4000, 8000, 16000];

// Each delay has its own retry queue, so a message never waits behind a longer delay queued before it.
// The retry exchange is direct and uses the delay as routing key: a message goes to exactly one queue. The queue
// dead-letters the message back to the events exchange with its original routing key (the event type).
// Headers bindings are not used here: RabbitMQ ignores binding arguments whose keys start with "x-", so a
// headers binding on x-retry-delay would match every delay and duplicate the message.
function retryQueueName(delayMs) {
  return `hackhub.backend.events.retry.${delayMs}ms`;
}

// Every event reaches the backend queue; the inbox decides which event types it handles.
async function assertEventTopology(channel, { retryDelaysMs = defaultRetryDelaysMs } = {}) {
  await channel.assertExchange(eventsExchange, 'topic', { durable: true });
  await channel.assertExchange(retryExchange, 'direct', { durable: true });
  await channel.assertExchange(deadLetterExchange, 'fanout', { durable: true });
  await channel.assertQueue(backendQueue, { durable: true });
  await channel.assertQueue(deadLetterQueue, { durable: true });
  await channel.bindQueue(backendQueue, eventsExchange, '#');
  await channel.bindQueue(deadLetterQueue, deadLetterExchange, '');
  for (const delayMs of retryDelaysMs) {
    const queue = retryQueueName(delayMs);
    await channel.assertQueue(queue, {
      durable: true,
      arguments: { 'x-message-ttl': delayMs, 'x-dead-letter-exchange': eventsExchange },
    });
    await channel.bindQueue(queue, retryExchange, String(delayMs));
  }
}

module.exports = {
  assertEventTopology,
  backendQueue,
  defaultRetryDelaysMs,
  deadLetterExchange,
  deadLetterQueue,
  eventsExchange,
  retryExchange,
  retryQueueName,
};
