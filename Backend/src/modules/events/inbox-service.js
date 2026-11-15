const eventHandlers = {
  // Nessun effetto visibile in questa fase: l'evento viene solo registrato.
  'user.registered': async () => {},
};

class InboxService {
  constructor(inboxRepository) {
    this.inboxRepository = inboxRepository;
  }

  // The inbox row and the handler effects share one transaction, so a failed handler lets the relay retry.
  async receive(event) {
    return this.inboxRepository.transaction(async (repository) => {
      if (!await repository.recordEvent(event)) return 'duplicate';
      const handle = eventHandlers[event.type];
      if (handle) await handle(event);
      return 'accepted';
    });
  }
}

module.exports = { InboxService };
