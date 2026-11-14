const { HttpStatus, httpError } = require('../../http/http-errors');
const { HackathonStatus, resolveHackathonStatus } = require('../../domain/hackathon-status');

class CompetitionService {
  constructor(repository, hackathonDirectory, teamDirectory, identityDirectory, selectWinner, paymentAdapter, notificationService) {
    this.repository = repository;
    this.hackathonDirectory = hackathonDirectory;
    this.teamDirectory = teamDirectory;
    this.identityDirectory = identityDirectory;
    this.selectWinner = selectWinner;
    this.paymentAdapter = paymentAdapter;
    this.notificationService = notificationService;
  }

  async statusOf(hackathon) {
    return resolveHackathonStatus(hackathon, await this.repository.winnerTeamId(hackathon.id));
  }

  async mine(userId) {
    const team = await this.teamDirectory.teamOfUser(userId);
    if (!team) return [];
    const submissions = await this.repository.listSubmissionsByTeam(team.team_id);
    const hackathons = await this.hackathonDirectory.findByIds(submissions.map((item) => item.hackathon_id));
    const teams = await this.teamDirectory.findTeams([team.team_id]);
    return submissions.map((item) => ({
      ...item,
      hackathon_name: hackathons.get(item.hackathon_id)?.name ?? null,
      team_name: teams.get(item.team_id)?.name ?? null,
    }));
  }

  async winsForUser(userId) {
    const team = await this.teamDirectory.teamOfUser(userId);
    if (!team) return [];
    const hackathons = await this.hackathonDirectory.findByIds(
      await this.repository.winnerHackathonIdsForTeam(team.team_id),
    );
    return [...hackathons.values()]
      .sort((left, right) => Date.parse(right.end_date) - Date.parse(left.end_date))
      .map((hackathon) => ({
        id: hackathon.id,
        name: hackathon.name,
        winner_team_id: team.team_id,
        prize: hackathon.prize,
      }));
  }

  // Provider for NotificationService: victories of the user's team, used to backfill VICTORY notifications.
  async victoriesForUser(userId) {
    const team = await this.teamDirectory.teamOfUser(userId);
    if (!team) return [];
    const hackathons = await this.hackathonDirectory.findByIds(
      await this.repository.winnerHackathonIdsForTeam(team.team_id),
    );
    const teamName = (await this.teamDirectory.findTeams([team.team_id])).get(team.team_id)?.name ?? null;
    return [...hackathons.values()].map((hackathon) => ({ id: hackathon.id, name: hackathon.name, teamName }));
  }

  async register(userId, hackathonId) {
    const team = await this.teamDirectory.teamOfUser(userId);
    const hackathon = await this.hackathonDirectory.findById(hackathonId);
    if (!team) throw httpError(HttpStatus.CONFLICT, 'Crea un team prima di iscriverti.');
    if (!hackathon) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (await this.statusOf(hackathon) !== HackathonStatus.OPEN_REGISTRATIONS) throw httpError(HttpStatus.CONFLICT, 'Le iscrizioni non sono aperte.');
    if (await this.repository.registration(hackathonId, team.team_id)) throw httpError(HttpStatus.CONFLICT, 'Il team è già iscritto a questo hackathon.');
    if (await this.teamDirectory.memberCount(team.team_id) > hackathon.max_team_size) throw httpError(HttpStatus.CONFLICT, 'Il team supera il numero massimo di membri.');
    await this.repository.register(hackathonId, team.team_id);
  }

  async createSubmission(userId, hackathonId, content) {
    const team = await this.teamDirectory.teamOfUser(userId);
    const hackathon = await this.hackathonDirectory.findById(hackathonId);
    if (!team || !hackathon || !await this.repository.registration(hackathonId, team.team_id)) throw httpError(HttpStatus.CONFLICT, 'Il team non è iscritto a questo hackathon.');
    if (![HackathonStatus.IN_PROGRESS, HackathonStatus.EVALUATION].includes(await this.statusOf(hackathon))) throw httpError(HttpStatus.CONFLICT, 'Le sottomissioni sono consentite durante l’hackathon o la valutazione.');
    if (await this.repository.submissionForTeam(hackathonId, team.team_id)) throw httpError(HttpStatus.CONFLICT, 'Il team ha già inviato una sottomissione.');
    if (typeof content !== 'string' || !content.trim()) {
      throw httpError(HttpStatus.BAD_REQUEST, 'Il contenuto della sottomissione è obbligatorio.');
    }
    return this.repository.createSubmission(hackathonId, team.team_id, content.trim());
  }

  async updateSubmission(userId, id, content) {
    const submission = await this.repository.submission(id);
    if (!submission) throw httpError(HttpStatus.NOT_FOUND, 'Sottomissione non trovata.');
    if (!await this.teamDirectory.isMember(submission.team_id, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non puoi modificare questa sottomissione.');
    const hackathon = await this.hackathonDirectory.findById(submission.hackathon_id);
    if (!hackathon) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (![HackathonStatus.IN_PROGRESS, HackathonStatus.EVALUATION].includes(await this.statusOf(hackathon))) throw httpError(HttpStatus.CONFLICT, 'La sottomissione non è più modificabile.');
    if (await this.repository.hasEvaluation(id)) throw httpError(HttpStatus.CONFLICT, 'La sottomissione è già stata valutata.');
    if (typeof content !== 'string' || !content.trim()) {
      throw httpError(HttpStatus.BAD_REQUEST, 'Il contenuto della sottomissione è obbligatorio.');
    }
    return this.repository.updateSubmission(id, content.trim());
  }

  async submissions(userId, id) {
    const hackathon = await this.hackathonDirectory.findById(id);
    if (!hackathon) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (!await this.hackathonDirectory.hasAccess(id, userId)) {
      throw httpError(HttpStatus.FORBIDDEN, 'Non puoi consultare queste sottomissioni.');
    }
    const items = await this.repository.listSubmissions(id);
    const teams = await this.teamDirectory.findTeams(items.map((item) => item.team_id));
    return items.map((item) => ({ ...item, team_name: teams.get(item.team_id)?.name ?? null }));
  }

  async evaluate(userId, id, input) {
    const score = Number(input?.score);
    if (!Number.isFinite(score) || score < 0 || score > 10 || typeof input?.comment !== 'string' || !input.comment.trim()) {
      throw httpError(HttpStatus.BAD_REQUEST, 'Punteggio o commento non validi.');
    }
    const submission = await this.repository.submission(id);
    if (!submission) throw httpError(HttpStatus.NOT_FOUND, 'Sottomissione non trovata.');
    const hackathon = await this.hackathonDirectory.findById(submission.hackathon_id);
    if (await this.statusOf(hackathon) !== HackathonStatus.EVALUATION) throw httpError(HttpStatus.CONFLICT, 'La valutazione non è aperta.');
    if (!await this.hackathonDirectory.isJudge(hackathon.id, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non sei assegnato come giudice a questo hackathon.');
    if (await this.repository.evaluationByJudge(id, userId)) throw httpError(HttpStatus.CONFLICT, 'Hai già valutato questa sottomissione.');
    await this.repository.evaluate(id, userId, score, input.comment.trim());
  }

  async evaluations(userId, id) {
    const submission = await this.repository.submission(id);
    if (!submission) throw httpError(HttpStatus.NOT_FOUND, 'Sottomissione non trovata.');
    if (!await this.teamDirectory.isMember(submission.team_id, userId) && !await this.hackathonDirectory.hasAccess(submission.hackathon_id, userId)) {
      throw httpError(HttpStatus.FORBIDDEN, 'Non puoi consultare queste valutazioni.');
    }
    const items = await this.repository.listEvaluations(id);
    const judges = await this.identityDirectory.findProfiles(items.map((item) => item.judge_id));
    return items.map((item) => ({ ...item, judge_name: judges.get(item.judge_id)?.name ?? null }));
  }

  async ranking(userId, id) {
    if (!await this.hackathonDirectory.findById(id)) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (!await this.hackathonDirectory.hasAccess(id, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non puoi consultare questa classifica.');
    const entries = await this.rankingEntries(id);
    return { entries, winner: entries.length ? this.selectWinner(entries) : null };
  }

  async rankingEntries(hackathonId) {
    const rows = await this.repository.ranking(hackathonId);
    const teams = await this.teamDirectory.findTeams(rows.map((row) => row.team_id));
    return rows.map((row) => ({
      teamId: row.team_id,
      teamName: teams.get(row.team_id)?.name ?? null,
      averageScore: Number(row.average_score),
    }));
  }

  async proclaimAuto(userId, hackathonId) {
    const hackathon = await this.hackathonDirectory.findById(hackathonId);
    await this.assertCanProclaim(hackathon, userId);
    await this.assertAllSubmissionsEvaluated(hackathonId);
    const winner = this.selectWinner(await this.rankingEntries(hackathonId));
    await this.payAndProclaim(hackathon, winner.teamId);
    await this.notifyWinner(hackathon, winner.teamId, winner.teamName);
    return { message: 'Vincitore proclamato.', winner };
  }

  async proclaimManual(userId, hackathonId, teamId) {
    const hackathon = await this.hackathonDirectory.findById(hackathonId);
    await this.assertCanProclaim(hackathon, userId);
    await this.assertAllSubmissionsEvaluated(hackathonId);
    if (!await this.repository.registration(hackathonId, teamId)) {
      throw httpError(HttpStatus.CONFLICT, 'Il team vincitore non è iscritto.');
    }
    const submission = await this.repository.submissionForTeam(hackathonId, teamId);
    if (!submission || !await this.repository.hasEvaluation(submission.id)) {
      throw httpError(HttpStatus.CONFLICT, 'Il team deve avere una sottomissione valutata.');
    }
    await this.payAndProclaim(hackathon, teamId);
    const team = (await this.teamDirectory.findTeams([teamId])).get(teamId);
    await this.notifyWinner(hackathon, teamId, team?.name ?? null);
    return { message: 'Vincitore proclamato.', teamId };
  }

  async assertCanProclaim(hackathon, userId) {
    if (!hackathon) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (hackathon.organizer_id !== userId) {
      throw httpError(HttpStatus.FORBIDDEN, 'Solo l’organizzatore dell’hackathon può proclamare il vincitore.');
    }
    if (await this.statusOf(hackathon) !== HackathonStatus.EVALUATION) {
      throw httpError(HttpStatus.CONFLICT, 'La proclamazione è consentita solo in fase di valutazione.');
    }
    if (await this.repository.winnerTeamId(hackathon.id)) throw httpError(HttpStatus.CONFLICT, 'Hackathon già concluso.');
  }

  async assertAllSubmissionsEvaluated(hackathonId) {
    const submissions = await this.repository.listSubmissions(hackathonId);
    if (!submissions.length) {
      throw httpError(HttpStatus.CONFLICT, 'Tutte le sottomissioni devono essere valutate.');
    }
    for (const item of submissions) {
      if (!await this.repository.hasEvaluation(item.id)) {
        throw httpError(HttpStatus.CONFLICT, 'Tutte le sottomissioni devono essere valutate.');
      }
    }
  }

  async payAndProclaim(hackathon, teamId) {
    if (!await this.repository.proclaimWinner(hackathon.id, teamId)) {
      throw httpError(HttpStatus.CONFLICT, 'Hackathon già concluso.');
    }
    try {
      if (!this.paymentAdapter.pay(teamId, hackathon.prize)) throw new Error('Payment declined.');
    } catch (error) {
      try {
        await this.repository.clearWinner(hackathon.id, teamId);
      } catch (rollbackError) {
        console.error('Impossibile compensare la proclamazione dopo il fallimento del pagamento.', rollbackError);
      }
      throw httpError(HttpStatus.BAD_GATEWAY, 'Erogazione del premio non riuscita.');
    }
  }

  async notifyWinner(hackathon, teamId, teamName) {
    for (const memberId of await this.teamDirectory.memberIds(teamId)) {
      await this.notificationService.create(
        memberId,
        'VICTORY',
        'Hai vinto un hackathon',
        `Il tuo team ${teamName} ha vinto ${hackathon.name}.`,
        'HACKATHON',
        hackathon.id,
      );
    }
  }
}

module.exports = { CompetitionService };
