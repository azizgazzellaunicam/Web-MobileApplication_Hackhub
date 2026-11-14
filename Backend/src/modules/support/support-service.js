const { HttpStatus, httpError } = require('../../http/http-errors');
const { HackathonStatus, resolveHackathonStatus } = require('../../domain/hackathon-status');

class SupportService {
  constructor(repository, hackathonDirectory, teamDirectory, competitionDirectory, calendarAdapter) {
    this.repository = repository;
    this.hackathonDirectory = hackathonDirectory;
    this.teamDirectory = teamDirectory;
    this.competitionDirectory = competitionDirectory;
    this.calendarAdapter = calendarAdapter;
  }

  async statusOf(hackathon) {
    return resolveHackathonStatus(hackathon, await this.competitionDirectory.winnerTeamId(hackathon.id));
  }

  async withNames(rows) {
    const hackathons = await this.hackathonDirectory.findByIds(rows.map((row) => row.hackathon_id));
    const teams = await this.teamDirectory.findTeams(rows.map((row) => row.team_id));
    return rows.map((row) => ({
      ...row,
      hackathon_name: hackathons.get(row.hackathon_id)?.name ?? null,
      team_name: teams.get(row.team_id)?.name ?? null,
    }));
  }

  async withTeamNames(rows) {
    const teams = await this.teamDirectory.findTeams(rows.map((row) => row.team_id));
    return rows.map((row) => ({ ...row, team_name: teams.get(row.team_id)?.name ?? null }));
  }

  async create(userId, input) {
    const hackathonId = Number(input?.hackathonId);
    const teamId = Number(input?.teamId);
    if (!input?.topic?.trim() || !input?.description?.trim()) throw httpError(HttpStatus.BAD_REQUEST, 'Topic e descrizione sono obbligatori.');
    const hackathon = await this.hackathonDirectory.findById(hackathonId);
    if (!hackathon || !await this.teamDirectory.isMember(teamId, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Richiesta non associata a un team valido.');
    if (!await this.competitionDirectory.isRegistered(hackathonId, teamId)) throw httpError(HttpStatus.CONFLICT, 'Il team non è iscritto all’hackathon.');
    if (await this.statusOf(hackathon) !== HackathonStatus.IN_PROGRESS) throw httpError(HttpStatus.CONFLICT, 'Il supporto è disponibile solo durante l’hackathon.');
    return this.repository.create({ hackathonId, teamId, userId, topic: input.topic.trim(), description: input.description.trim(), priority: input.priority?.trim() || 'MEDIA' });
  }

  async report(userId, input) {
    const hackathonId = Number(input?.hackathonId);
    const teamId = Number(input?.teamId);
    if (!input?.description?.trim()) throw httpError(HttpStatus.BAD_REQUEST, 'La descrizione è obbligatoria.');
    if (!await this.hackathonDirectory.isMentor(hackathonId, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non sei assegnato a questo hackathon.');
    if (!await this.competitionDirectory.isRegistered(hackathonId, teamId)) throw httpError(HttpStatus.CONFLICT, 'Il team non è iscritto all’hackathon.');
    return this.repository.create({ hackathonId, teamId, userId, topic: 'SEGNALAZIONE', description: input.description.trim(), priority: 'ALTA' });
  }

  async details(userId, id) {
    const request = await this.repository.request(id);
    if (!request) throw httpError(HttpStatus.NOT_FOUND, 'Richiesta non trovata.');
    if (!await this.teamDirectory.isMember(request.team_id, userId) && !await this.hackathonDirectory.isMentor(request.hackathon_id, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non puoi consultare questa richiesta.');
    const [item] = await this.withNames([request]);
    return item;
  }

  async open(userId) {
    const hackathonIds = (await this.hackathonDirectory.assignmentsForUser(userId))
      .filter((assignment) => assignment.role === 'MENTOR')
      .map((assignment) => assignment.hackathon_id);
    return this.withNames(await this.repository.listOpenForHackathons(hackathonIds));
  }

  async mine(userId) {
    const team = await this.teamDirectory.teamOfUser(userId);
    if (!team) return [];
    return this.withNames(await this.repository.listByTeam(team.team_id));
  }

  async teams(userId, id) {
    const hackathon = await this.hackathonDirectory.findById(id);
    if (!hackathon) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (hackathon.organizer_id !== userId && !await this.hackathonDirectory.isMentor(id, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non puoi consultare i team di questo hackathon.');
    const teams = await this.teamDirectory.findTeams(await this.competitionDirectory.registeredTeamIds(id));
    return [...teams.values()]
      .map((team) => ({ id: team.id, name: team.name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'it'));
  }

  async listForHackathon(userId, id) {
    const hackathon = await this.hackathonDirectory.findById(id);
    if (!hackathon) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (hackathon.organizer_id !== userId && !await this.hackathonDirectory.isMentor(id, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non puoi consultare queste richieste.');
    return this.withTeamNames(await this.repository.listByHackathon(id));
  }

  async schedule(userId, id, input) {
    const request = await this.repository.request(id);
    if (!request || !await this.hackathonDirectory.isMentor(request.hackathon_id, userId) || !request.open) throw httpError(HttpStatus.NOT_FOUND, 'Richiesta non trovata o non assegnata.');
    if (!Number.isFinite(Date.parse(input?.scheduledAt)) || Date.parse(input.scheduledAt) <= Date.now()) throw httpError(HttpStatus.BAD_REQUEST, 'La call deve essere fissata in una data futura.');
    return this.repository.createCall(id, userId, input.scheduledAt, this.calendarAdapter.schedule(id, userId, input.scheduledAt));
  }

  async close(userId, id) {
    const request = await this.repository.request(id);
    if (!request) throw httpError(HttpStatus.NOT_FOUND, 'Richiesta non trovata.');
    if (request.user_id !== userId && !await this.hackathonDirectory.isMentor(request.hackathon_id, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non puoi chiudere questa richiesta.');
    await this.repository.close(id);
  }
}

module.exports = { SupportService };
