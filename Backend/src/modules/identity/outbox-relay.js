// Waits before retrying after the 1st, 2nd, ... failed delivery. One more failure after the last wait dead-letters the event.
const retryDelaysMs = [1000, 2000, 4000, 8000, 16000];

class OutboxRelay {
  constructor({ repository, publisher, batchSize = 50 }) {
    this.repository = repository;
    this.publisher = publisher;
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
          if (failures > retryDelaysMs.length) {
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

  // Marks the event as published only after RabbitMQ confirms it; a failed publish is retried from the outbox.
  async deliver(event) {
    await this.publisher.publish({
      id: event.event_id,
      type: event.event_type,
      occurredAt: event.created_at,
      payload: JSON.parse(event.payload),
    });
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
