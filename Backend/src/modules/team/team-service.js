const { HttpStatus, httpError } = require('../../http/http-errors');

const collator = new Intl.Collator('it', { sensitivity: 'base' });

function isMembershipConflict(error) {
  return error?.code === 'ER_DUP_ENTRY'
    && (error?.message?.includes('team_members.user_id') || error?.message?.includes('team_members_one_team_per_user'));
}

class TeamService {
  constructor(repository, notificationService, identityDirectory, competitionDirectory, hackathonDirectory) {
    this.repository = repository;
    this.notificationService = notificationService;
    this.identityDirectory = identityDirectory;
    this.competitionDirectory = competitionDirectory;
    this.hackathonDirectory = hackathonDirectory;
  }

  membersLabel(memberIds, profiles) {
    return memberIds
      .map((id) => profiles.get(id)?.name)
      .filter(Boolean)
      .sort(collator.compare)
      .join(',');
  }

  async hasStartedRegistration(teamId) {
    for (const hackathonId of await this.competitionDirectory.registeredHackathonIds(teamId)) {
      if (await this.hackathonDirectory.hasStarted(hackathonId)) return true;
    }
    return false;
  }

  async listForUser(userId) {
    const membership = await this.repository.findByMember(userId);
    if (!membership) return [];
    const team = await this.repository.findById(membership.team_id);
    const memberIds = await this.repository.memberIds(team.id);
    const profiles = await this.identityDirectory.findProfiles(memberIds);
    return [{
      id: team.id,
      name: team.name,
      members: this.membersLabel(memberIds, profiles),
      can_leave: await this.hasStartedRegistration(team.id) ? 0 : 1,
    }];
  }

  async listAll() {
    const teams = await this.repository.listTeams();
    const memberships = await this.repository.listMemberships();
    const profiles = await this.identityDirectory.findProfiles(memberships.map((row) => row.user_id));
    const result = [];
    for (const team of teams) {
      const memberIds = memberships.filter((row) => row.team_id === team.id).map((row) => row.user_id);
      if (!memberIds.length) continue;
      result.push({ id: team.id, name: team.name, members: this.membersLabel(memberIds, profiles) });
    }
    return result;
  }

  async listInvitations(userId) {
    const invitedUser = await this.identityDirectory.findById(userId);
    const invitations = await this.repository.listInvitations(userId);
    return invitations.map((invitation) => ({ ...invitation, invited_email: invitedUser?.email ?? null }));
  }

  async leave(teamId, userId) {
    if (!await this.repository.findMember(teamId, userId)) {
      throw httpError(HttpStatus.NOT_FOUND, 'Non appartieni a questo team.');
    }
    if (await this.hasStartedRegistration(teamId)) {
      throw httpError(HttpStatus.CONFLICT, 'Non puoi uscire dal team: un hackathon a cui siete iscritti è già iniziato.');
    }
    await this.repository.removeMember(teamId, userId);
    await this.deleteTeamIfEmpty(teamId);
    return { message: 'Hai lasciato il team.' };
  }

  // A team still referenced by non-cascading FKs (support requests, winners) is kept.
  async deleteTeamIfEmpty(teamId) {
    try {
      return await this.repository.deleteTeamIfEmpty(teamId);
    } catch (error) {
      if (error?.code === 'ER_ROW_IS_REFERENCED_2') return false;
      throw error;
    }
  }

  async create(userId, userName, name) {
    if (!name || !name.trim()) throw httpError(HttpStatus.BAD_REQUEST, 'Il campo name è obbligatorio.');
    if (await this.repository.findByMember(userId)) {
      throw httpError(HttpStatus.CONFLICT, 'Un utente può appartenere a un solo team.');
    }
    try {
      return { ...await this.repository.create(name.trim(), userId), members: userName };
    } catch (error) {
      if (isMembershipConflict(error)) {
        throw httpError(HttpStatus.CONFLICT, 'Un utente può appartenere a un solo team.');
      }
      throw error;
    }
  }

  async invite(teamId, inviterId, email) {
    if (!await this.repository.findMember(teamId, inviterId)) {
      throw httpError(HttpStatus.FORBIDDEN, 'Solo un membro del team può inviare inviti.');
    }
    const invited = await this.identityDirectory.findIdByEmail(email);
    if (!invited) throw httpError(HttpStatus.NOT_FOUND, 'Utente invitato non trovato.');
    if (await this.repository.findByMember(invited.id)) throw httpError(HttpStatus.CONFLICT, 'L’utente appartiene già a un team.');
    if (await this.repository.hasPendingInvitation(teamId, invited.id)) throw httpError(HttpStatus.CONFLICT, 'Invito già pendente.');
    const team = await this.repository.findById(teamId);
    const invitation = await this.repository.createInvitation(teamId, invited.id, inviterId);
    await this.notificationService.create(invited.id, 'INVITATION', 'Nuovo invito al team',
      `Hai ricevuto un invito a partecipare al team ${team.name}.`, 'TEAM_INVITATION', invitation.id);
    return invitation;
  }

  async decideInvitation(id, userId, decision) {
    const status = decision === 'accept' ? 'ACCETTATO' : decision === 'reject' ? 'RIFIUTATO' : null;
    if (!status) throw httpError(HttpStatus.BAD_REQUEST, 'Decisione invito non valida.');
    const invitation = await this.repository.findInvitation(id, userId);
    if (!invitation) throw httpError(HttpStatus.NOT_FOUND, 'Invito non trovato o già gestito.');
    if (status === 'ACCETTATO' && await this.repository.findByMember(userId)) {
      throw httpError(HttpStatus.CONFLICT, 'Appartieni già a un team.');
    }
    try {
      if (!await this.repository.setInvitationStatus(invitation.id, invitation.team_id, status, userId)) {
        throw httpError(HttpStatus.CONFLICT, 'L’invito è già stato gestito.');
      }
    } catch (error) {
      if (isMembershipConflict(error)) {
        throw httpError(HttpStatus.CONFLICT, 'Appartieni già a un team.');
      }
      throw error;
    }
    return { message: status === 'ACCETTATO' ? 'Invito accettato.' : 'Invito rifiutato.' };
  }
}

module.exports = { TeamService };
