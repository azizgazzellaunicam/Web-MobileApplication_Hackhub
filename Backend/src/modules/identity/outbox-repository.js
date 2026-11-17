const { BaseRepository } = require('../../repository/base-repository');

class OutboxRepository extends BaseRepository {
  async enqueue(event) {
    await this.run(
      'INSERT INTO outbox_events(event_id,event_type,payload) VALUES (?,?,?)',
      [event.id, event.type, JSON.stringify(event.payload)],
    );
  }

  async findPending(limit) {
    return this.all(`
      SELECT event_id,event_type,payload,created_at,attempts,
        (next_attempt_at IS NOT NULL AND next_attempt_at > NOW(3)) AS waiting
      FROM outbox_events
      WHERE published_at IS NULL AND dead_lettered_at IS NULL
      ORDER BY seq
      LIMIT ${Number(limit)}
    `);
  }

  async markPublished(eventId) {
    await this.run('UPDATE outbox_events SET published_at=NOW(),attempts=attempts+1,last_error=NULL WHERE event_id=?', [eventId]);
  }

  async recordFailure(eventId, message, retryDelayMs) {
    await this.run(
      `UPDATE outbox_events SET attempts=attempts+1,last_error=?,next_attempt_at=DATE_ADD(NOW(3), INTERVAL ${Number(retryDelayMs) * 1000} MICROSECOND) WHERE event_id=?`,
      [message.slice(0, 255), eventId],
    );
  }

  async markDeadLettered(eventId, message) {
    await this.run(
      'UPDATE outbox_events SET attempts=attempts+1,last_error=?,dead_lettered_at=NOW(3),next_attempt_at=NULL WHERE event_id=?',
      [message.slice(0, 255), eventId],
    );
  }
}

module.exports = { OutboxRepository };
