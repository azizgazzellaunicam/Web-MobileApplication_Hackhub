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
      SELECT event_id,event_type,payload,created_at
      FROM outbox_events
      WHERE published_at IS NULL
      ORDER BY seq
      LIMIT ${Number(limit)}
    `);
  }

  async markPublished(eventId) {
    await this.run('UPDATE outbox_events SET published_at=NOW(),attempts=attempts+1,last_error=NULL WHERE event_id=?', [eventId]);
  }

  async recordFailure(eventId, message) {
    await this.run('UPDATE outbox_events SET attempts=attempts+1,last_error=? WHERE event_id=?', [message.slice(0, 255), eventId]);
  }
}

module.exports = { OutboxRepository };
