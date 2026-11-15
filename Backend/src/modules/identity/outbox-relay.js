const { serviceTokenHeader } = require('../../security/service-token');

const deliveryTimeoutMs = 5000;

class OutboxRelay {
  constructor({ repository, targetUrl, serviceToken, fetchImpl = fetch, batchSize = 50 }) {
    this.repository = repository;
    this.targetUrl = targetUrl.replace(/\/$/, '');
    this.serviceToken = serviceToken;
    this.fetchImpl = fetchImpl;
    this.batchSize = batchSize;
    this.running = false;
    this.timer = null;
  }

  // Events are delivered in order; the first failure stops the batch so later events are not sent ahead of it.
  async publishPending() {
    if (this.running) return 0;
    this.running = true;
    try {
      const events = await this.repository.findPending(this.batchSize);
      let published = 0;
      for (const event of events) {
        try {
          await this.deliver(event);
        } catch (error) {
          await this.repository.recordFailure(event.event_id, error.message);
          break;
        }
        await this.repository.markPublished(event.event_id);
        published += 1;
      }
      return published;
    } finally {
      this.running = false;
    }
  }

  async deliver(event) {
    const response = await this.fetchImpl(`${this.targetUrl}/internal/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [serviceTokenHeader]: this.serviceToken,
      },
      body: JSON.stringify({
        id: event.event_id,
        type: event.event_type,
        occurredAt: event.created_at,
        payload: JSON.parse(event.payload),
      }),
      signal: AbortSignal.timeout(deliveryTimeoutMs),
    });
    if (!response.ok) throw new Error(`Consegna rifiutata con stato ${response.status}.`);
  }

  start(intervalMs = 2000) {
    this.timer = setInterval(() => {
      this.publishPending().catch((error) => console.error(error));
    }, intervalMs);
  }

  stop() {
    clearInterval(this.timer);
  }
}

module.exports = { OutboxRelay };
