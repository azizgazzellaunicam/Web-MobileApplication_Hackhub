const { HttpStatus, httpError } = require('../http/http-errors');

class CompetitionService {
  constructor(repository, statusOf, selectWinner, hackathonRepository, paymentAdapter, notificationService) {
    this.repository = repository;
    this.statusOf = statusOf;
    this.selectWinner = selectWinner;
    this.hackathonRepository = hackathonRepository;
    this.paymentAdapter = paymentAdapter;
    this.notificationService = notificationService;
  }
  async mine(userId) { return this.repository.listMine(userId); }
  async register(userId, hackathonId) {
    const team = await this.repository.userTeam(userId);
    const hackathon = await this.repository.hackathon(hackathonId);
    if (!team) throw httpError(HttpStatus.CONFLICT, 'Crea un team prima di iscriverti.');
    if (!hackathon) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (this.statusOf(hackathon) !== 'ISCRIZIONI_APERTE') throw httpError(HttpStatus.CONFLICT, 'Le iscrizioni non sono aperte.');
    if (await this.repository.registration(hackathonId, team.team_id)) throw httpError(HttpStatus.CONFLICT, 'Il team è già iscritto a questo hackathon.');
    if (await this.repository.teamSize(team.team_id) > hackathon.max_team_size) throw httpError(HttpStatus.CONFLICT, 'Il team supera il numero massimo di membri.');
    await this.repository.register(hackathonId, team.team_id);
  }
  async createSubmission(userId, hackathonId, content) {
    const team = await this.repository.userTeam(userId);
    const hackathon = await this.repository.hackathon(hackathonId);
    if (!team || !hackathon || !await this.repository.registration(hackathonId, team.team_id)) throw httpError(HttpStatus.CONFLICT, 'Il team non è iscritto a questo hackathon.');
    if (!['IN_CORSO', 'VALUTAZIONE'].includes(this.statusOf(hackathon))) throw httpError(HttpStatus.CONFLICT, 'Le sottomissioni sono consentite durante l’hackathon o la valutazione.');
    if (await this.repository.submissionForTeam(hackathonId, team.team_id)) throw httpError(HttpStatus.CONFLICT, 'Il team ha già inviato una sottomissione.');
    if (typeof content !== 'string' || !content.trim()) {
      throw httpError(HttpStatus.BAD_REQUEST, 'Il contenuto della sottomissione è obbligatorio.');
    }
    return this.repository.createSubmission(hackathonId, team.team_id, content.trim());
  }
  async updateSubmission(userId, id, content) {
    const submission = await this.repository.submission(id);
    if (!submission) throw httpError(HttpStatus.NOT_FOUND, 'Sottomissione non trovata.');
    if (!await this.repository.isTeamMember(submission.team_id, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non puoi modificare questa sottomissione.');
    const hackathon = await this.repository.hackathon(submission.hackathon_id);
    if (!hackathon) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (!['IN_CORSO', 'VALUTAZIONE'].includes(this.statusOf(hackathon))) throw httpError(HttpStatus.CONFLICT, 'La sottomissione non è più modificabile.');
    if (await this.repository.hasEvaluation(id)) throw httpError(HttpStatus.CONFLICT, 'La sottomissione è già stata valutata.');
    if (typeof content !== 'string' || !content.trim()) {
      throw httpError(HttpStatus.BAD_REQUEST, 'Il contenuto della sottomissione è obbligatorio.');
    }
    return this.repository.updateSubmission(id, content.trim());
  }
  async submissions(userId, id) {
    const hackathon = await this.repository.hackathon(id);
    if (!hackathon) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (hackathon.organizer_id !== userId && !await this.repository.canAccessHackathon(id, userId)) {
      throw httpError(HttpStatus.FORBIDDEN, 'Non puoi consultare queste sottomissioni.');
    }
    return this.repository.listSubmissions(id);
  }
  async evaluate(userId, id, input) {
    const score = Number(input?.score);
    if (!Number.isFinite(score) || score < 0 || score > 10 || typeof input?.comment !== 'string' || !input.comment.trim()) {
      throw httpError(HttpStatus.BAD_REQUEST, 'Punteggio o commento non validi.');
    }
    const submission = await this.repository.submission(id);
    if (!submission) throw httpError(HttpStatus.NOT_FOUND, 'Sottomissione non trovata.');
    const hackathon = await this.repository.hackathon(submission.hackathon_id);
    if (this.statusOf(hackathon) !== 'VALUTAZIONE') throw httpError(HttpStatus.CONFLICT, 'La valutazione non è aperta.');
    if (!await this.repository.isJudge(hackathon.id, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non sei assegnato come giudice a questo hackathon.');
    if (await this.repository.evaluationByJudge(id, userId)) throw httpError(HttpStatus.CONFLICT, 'Hai già valutato questa sottomissione.');
    await this.repository.evaluate(id, userId, score, input.comment.trim());
  }
  async evaluations(userId, id) {
    const submission = await this.repository.submission(id);
    if (!submission) throw httpError(HttpStatus.NOT_FOUND, 'Sottomissione non trovata.');
    if (!await this.repository.isTeamMember(submission.team_id, userId) && !await this.repository.canAccessHackathon(submission.hackathon_id, userId)) {
      throw httpError(HttpStatus.FORBIDDEN, 'Non puoi consultare queste valutazioni.');
    }
    return this.repository.listEvaluations(id);
  }
  async ranking(userId, id) {
    if (!await this.repository.hackathon(id)) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (!await this.repository.canAccessHackathon(id, userId)) throw httpError(HttpStatus.FORBIDDEN, 'Non puoi consultare questa classifica.');
    const entries = (await this.repository.ranking(id)).map((entry) => ({ teamId: entry.team_id, teamName: entry.team_name, averageScore: Number(entry.average_score) }));
    return { entries, winner: entries.length ? this.selectWinner(entries) : null };
  }

  async proclaimAuto(userId, hackathonId) {
    const hackathon = await this.hackathonRepository.findById(hackathonId);
    await this.assertCanProclaim(hackathon, userId);
    await this.assertAllSubmissionsEvaluated(hackathonId);
    const entries = (await this.hackathonRepository.ranking(hackathonId)).map((entry) => ({
      teamId: entry.team_id,
      teamName: entry.team_name,
      averageScore: Number(entry.average_score),
    }));
    const winner = this.selectWinner(entries);
    await this.payAndProclaim(hackathon, winner.teamId);
    await this.notifyWinner(hackathon, winner.teamId, winner.teamName);
    return { message: 'Vincitore proclamato.', winner };
  }

  async proclaimManual(userId, hackathonId, teamId) {
    const hackathon = await this.hackathonRepository.findById(hackathonId);
    await this.assertCanProclaim(hackathon, userId);
    await this.assertAllSubmissionsEvaluated(hackathonId);
    if (!await this.hackathonRepository.isTeamRegistered(hackathonId, teamId)) {
      throw httpError(HttpStatus.CONFLICT, 'Il team vincitore non è iscritto.');
    }
    const submission = await this.hackathonRepository.submissionForTeam(hackathonId, teamId);
    if (!submission || !await this.hackathonRepository.hasEvaluation(submission.id)) {
      throw httpError(HttpStatus.CONFLICT, 'Il team deve avere una sottomissione valutata.');
    }
    await this.payAndProclaim(hackathon, teamId);
    const team = await this.hackathonRepository.team(teamId);
    await this.notifyWinner(hackathon, teamId, team.name);
    return { message: 'Vincitore proclamato.', teamId };
  }

  async assertCanProclaim(hackathon, userId) {
    if (!hackathon) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (hackathon.organizer_id !== userId) {
      throw httpError(HttpStatus.FORBIDDEN, 'Solo l’organizzatore dell’hackathon può proclamare il vincitore.');
    }
    if (this.statusOf(hackathon) !== 'VALUTAZIONE') {
      throw httpError(HttpStatus.CONFLICT, 'La proclamazione è consentita solo in fase di valutazione.');
    }
    if (hackathon.winner_team_id) throw httpError(HttpStatus.CONFLICT, 'Hackathon già concluso.');
  }

  async assertAllSubmissionsEvaluated(hackathonId) {
    const submissions = await this.hackathonRepository.submissions(hackathonId);
    if (!submissions.length) {
      throw httpError(HttpStatus.CONFLICT, 'Tutte le sottomissioni devono essere valutate.');
    }
    for (const item of submissions) {
      if (!await this.hackathonRepository.hasEvaluation(item.id)) {
        throw httpError(HttpStatus.CONFLICT, 'Tutte le sottomissioni devono essere valutate.');
      }
    }
  }

  async payAndProclaim(hackathon, teamId) {
    if (!await this.hackathonRepository.proclaimWinner(hackathon.id, teamId)) {
      throw httpError(HttpStatus.CONFLICT, 'Hackathon già concluso.');
    }
    try {
      if (!this.paymentAdapter.pay(teamId, hackathon.prize)) throw new Error('Payment declined.');
    } catch (error) {
      try {
        await this.hackathonRepository.clearWinner(hackathon.id, teamId);
      } catch (rollbackError) {
        console.error('Impossibile compensare la proclamazione dopo il fallimento del pagamento.', rollbackError);
      }
      throw httpError(HttpStatus.BAD_GATEWAY, 'Erogazione del premio non riuscita.');
    }
  }

  async notifyWinner(hackathon, teamId, teamName) {
    for (const member of await this.hackathonRepository.teamMembers(teamId)) {
      await this.notificationService.create(
        member.user_id,
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
