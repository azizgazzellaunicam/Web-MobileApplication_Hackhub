const { serviceTokenHeader } = require('../../security/service-token');

const deliveryTimeoutMs = 5000;
// Waits before retrying after the 1st, 2nd, ... failed delivery. One more failure after the last wait dead-letters the event.
const retryDelaysMs = [1000, 2000, 4000, 8000, 16000];

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

  // Events are delivered in order. An event waiting for its retry blocks the events behind it;
  // an event that exhausts its retries is dead-lettered so the rest of the outbox keeps moving.
  async publishPending() {
    if (this.running) return 0;
    this.running = true;
    try {
      const events = await this.repository.findPending(this.batchSize);
      let published = 0;
      for (const event of events) {
        if (Number(event.waiting)) break;
        try {
          await this.deliver(event);
        } catch (error) {
          const failures = event.attempts + 1;
          if (error.permanent || failures > retryDelaysMs.length) {
            await this.repository.markDeadLettered(event.event_id, error.message);
            continue;
          }
          await this.repository.recordFailure(event.event_id, error.message, retryDelaysMs[failures - 1]);
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
    if (response.ok) return;
    const error = new Error(`Consegna rifiutata con stato ${response.status}.`);
    // A 4xx is a permanent rejection (408 and 429 are transient and keep being retried).
    error.permanent = response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429;
    throw error;
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
