const { BaseRepository } = require('../../repository/base-repository');

class InboxRepository extends BaseRepository {
  // Returns false when the event was already received.
  async recordEvent(event) {
    const { changes } = await this.run(
      'INSERT IGNORE INTO inbox_events(event_id,event_type) VALUES (?,?)',
      [event.id, event.type],
    );
    return changes === 1;
  }
}

module.exports = { InboxRepository };
