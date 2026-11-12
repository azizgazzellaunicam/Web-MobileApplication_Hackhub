const { HttpStatus, httpError } = require('../http/http-errors');

class SupportService {
  constructor(repository, statusOf, calendarAdapter) {
    this.repository = repository;
    this.statusOf = statusOf;
    this.calendarAdapter = calendarAdapter;
  }
  async create(userId, input) {
    const hackathonId = Number(input?.hackathonId); const teamId = Number(input?.teamId);
    if (!input?.topic?.trim() || !input?.description?.trim()) throw httpError(HttpStatus.BAD_REQUEST, 'Topic e descrizione sono obbligatori.');
    const hackathon = await this.repository.hackathon(hackathonId);
    if (!hackathon || !await this.repository.member(teamId, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Richiesta non associata a un team valido.');
    if (!await this.repository.registered(hackathonId, teamId)) throw httpError(HttpStatus.CONFLICT, 'Il team non è iscritto all’hackathon.');
    if (this.statusOf(hackathon) !== 'IN_CORSO') throw httpError(HttpStatus.CONFLICT, 'Il supporto è disponibile solo durante l’hackathon.');
    return this.repository.create({ hackathonId, teamId, userId, topic: input.topic.trim(), description: input.description.trim(), priority: input.priority?.trim() || 'MEDIA' });
  }
  async report(userId, input) {
    const hackathonId = Number(input?.hackathonId); const teamId = Number(input?.teamId);
    if (!input?.description?.trim()) throw httpError(HttpStatus.BAD_REQUEST, 'La descrizione è obbligatoria.');
    if (!await this.repository.mentor(hackathonId, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non sei assegnato a questo hackathon.');
    if (!await this.repository.registered(hackathonId, teamId)) throw httpError(HttpStatus.CONFLICT, 'Il team non è iscritto all’hackathon.');
    return this.repository.create({ hackathonId, teamId, userId, topic: 'SEGNALAZIONE', description: input.description.trim(), priority: 'ALTA' });
  }
  async details(userId, id) {
    const request = await this.repository.details(id);
    if (!request) throw httpError(HttpStatus.NOT_FOUND, 'Richiesta non trovata.');
    if (!await this.repository.member(request.team_id, userId) && !await this.repository.mentor(request.hackathon_id, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non puoi consultare questa richiesta.');
    return request;
  }
  async open(userId) { return this.repository.openForMentor(userId); }
  async mine(userId) { return this.repository.forUser(userId); }
  async teams(userId, id) {
    const hackathon = await this.repository.hackathon(id);
    if (!hackathon) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (hackathon.organizer_id !== userId && !await this.repository.mentor(id, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non puoi consultare i team di questo hackathon.');
    return this.repository.registeredTeams(id);
  }
  async listForHackathon(userId, id) {
    const hackathon = await this.repository.hackathon(id);
    if (!hackathon) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (hackathon.organizer_id !== userId && !await this.repository.mentor(id, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non puoi consultare queste richieste.');
    return this.repository.forHackathon(id);
  }
  async schedule(userId, id, input) {
    const request = await this.repository.request(id);
    if (!request || !await this.repository.mentor(request.hackathon_id, userId) || !request.open) throw httpError(HttpStatus.NOT_FOUND, 'Richiesta non trovata o non assegnata.');
    if (!Number.isFinite(Date.parse(input?.scheduledAt)) || Date.parse(input.scheduledAt) <= Date.now()) throw httpError(HttpStatus.BAD_REQUEST, 'La call deve essere fissata in una data futura.');
    return this.repository.createCall(id, userId, input.scheduledAt, this.calendarAdapter.schedule(id, userId, input.scheduledAt));
  }
  async close(userId, id) {
    const request = await this.repository.request(id);
    if (!request) throw httpError(HttpStatus.NOT_FOUND, 'Richiesta non trovata.');
    if (request.user_id !== userId && !await this.repository.mentor(request.hackathon_id, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non puoi chiudere questa richiesta.');
    await this.repository.close(id);
  }
}

module.exports = { SupportService };
