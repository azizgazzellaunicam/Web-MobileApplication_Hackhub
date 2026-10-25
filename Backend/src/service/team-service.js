const { HttpStatus, httpError } = require('../http/http-errors');

class TeamService {
  constructor(repository, notificationService) {
    this.repository = repository;
    this.notificationService = notificationService;
  }

  listForUser(userId) { return this.repository.listForUser(userId); }
  listAll() { return this.repository.listAll(); }
  listInvitations(userId) { return this.repository.listInvitations(userId); }

  leave(teamId, userId) {
    if (!this.repository.findMember(teamId, userId)) {
      throw httpError(HttpStatus.NOT_FOUND, 'Non appartieni a questo team.');
    }
    if (this.repository.hasStartedRegistration(teamId)) {
      throw httpError(HttpStatus.CONFLICT, 'Non puoi uscire dal team: un hackathon a cui siete iscritti è già iniziato.');
    }
    this.repository.removeMember(teamId, userId);
    return { message: 'Hai lasciato il team.' };
  }

  create(userId, userName, name) {
    if (!name || !name.trim()) throw httpError(HttpStatus.BAD_REQUEST, 'Il campo name è obbligatorio.');
    if (this.repository.findByMember(userId)) {
      throw httpError(HttpStatus.CONFLICT, 'Un utente può appartenere a un solo team.');
    }
    return { ...this.repository.create(name.trim(), userId), members: userName };
  }

  invite(teamId, inviterId, email) {
    if (!this.repository.findMember(teamId, inviterId)) {
      throw httpError(HttpStatus.FORBIDDEN, 'Solo un membro del team può inviare inviti.');
    }
    const invited = this.repository.findUserByEmail(email);
    if (!invited) throw httpError(HttpStatus.NOT_FOUND, 'Utente invitato non trovato.');
    if (this.repository.findByMember(invited.id)) throw httpError(HttpStatus.CONFLICT, 'L’utente appartiene già a un team.');
    if (this.repository.hasPendingInvitation(teamId, invited.id)) throw httpError(HttpStatus.CONFLICT, 'Invito già pendente.');
    const team = this.repository.findById(teamId);
    const invitation = this.repository.createInvitation(teamId, invited.id, inviterId);
    this.notificationService.create(invited.id, 'INVITATION', 'Nuovo invito al team',
      `Hai ricevuto un invito a partecipare al team ${team.name}.`, 'TEAM_INVITATION', invitation.id);
    return invitation;
  }

  decideInvitation(id, userId, decision) {
    const status = decision === 'accept' ? 'ACCETTATO' : decision === 'reject' ? 'RIFIUTATO' : null;
    if (!status) throw httpError(HttpStatus.BAD_REQUEST, 'Decisione invito non valida.');
    const invitation = this.repository.findInvitation(id, userId);
    if (!invitation) throw httpError(HttpStatus.NOT_FOUND, 'Invito non trovato o già gestito.');
    if (status === 'ACCETTATO' && this.repository.findByMember(userId)) {
      throw httpError(HttpStatus.CONFLICT, 'Appartieni già a un team.');
    }
    this.repository.setInvitationStatus(invitation.id, invitation.team_id, status, userId);
    return { message: status === 'ACCETTATO' ? 'Invito accettato.' : 'Invito rifiutato.' };
  }
}

module.exports = { TeamService };
