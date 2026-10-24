const { HttpStatus, httpError } = require('../http/http-errors');
const { HackathonStatus } = require('../domain/hackathon-status');

class HackathonService {
  constructor(repository, statusOf) {
    this.repository = repository;
    this.statusOf = statusOf;
  }

  list(userId) {
    const team = userId ? this.repository.teamForUser(userId) : null;
    const assignments = userId ? this.repository.assignmentForUser(userId) : [];
    const assignedById = new Map(assignments.map((assignment) => [assignment.hackathon_id, assignment.role]));
    return this.repository.list().map((item) => ({
      ...item,
      is_registered: Boolean(team && this.repository.isRegistered(item.id, team.team_id)),
      is_winner: Boolean(team && item.winner_team_id === team.team_id),
      assigned_role: assignedById.get(item.id) || null,
    }));
  }

  detail(id) {
    const item = this.repository.findById(id);
    if (!item) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    return item;
  }

  assigned(userId) {
    return this.repository.listAssigned(userId);
  }

  evaluation(userId) {
    return this.repository.listEvaluation(userId)
      .filter((item) => this.statusOf(item) === 'VALUTAZIONE');
  }

  staff() {
    return this.repository.listStaff();
  }

  assignStaff(hackathonId, organizerId, input) {
    const hackathon = this.detail(hackathonId);
    if (hackathon.organizer_id !== organizerId) {
      throw httpError(HttpStatus.FORBIDDEN, 'Solo l’organizzatore può assegnare lo staff.');
    }
    const role = input?.role;
    if (!['JUDGE', 'MENTOR'].includes(role)) throw httpError(HttpStatus.BAD_REQUEST, 'Ruolo staff non valido.');
    const member = this.repository.findUserWithRole(Number(input.userId), role);
    if (!member) throw httpError(HttpStatus.BAD_REQUEST, 'L’utente non ha il ruolo richiesto.');
    if (this.repository.findStaff(hackathonId).some((item) => item.user_id === member.id && item.role === role)) {
      throw httpError(HttpStatus.CONFLICT, 'Utente già assegnato a questo hackathon.');
    }
    this.repository.assignStaff(hackathonId, member.id, role);
  }

  create(organizerId, input = {}) {
    this.validateDetails(input);
    const judge = this.repository.findUserWithRole(Number(input.judgeId), 'JUDGE');
    const mentor = this.repository.findUserWithRole(Number(input.mentorId), 'MENTOR');
    if (!judge || !mentor) throw httpError(HttpStatus.BAD_REQUEST, 'È necessario assegnare almeno un giudice e un mentore validi.');
    return this.repository.create({
      ...input,
      name: input.name.trim(),
      regulation: input.regulation.trim(),
      location: input.location.trim(),
      prize: Number(input.prize),
      maxTeamSize: Number(input.maxTeamSize),
      organizerId,
      judgeId: judge.id,
      mentorId: mentor.id,
    });
  }

  validateCreation(input = {}) {
    const deadline = Date.parse(input.registrationDeadline);
    const start = Date.parse(input.startDate);
    const end = Date.parse(input.endDate);
    const prize = Number(input.prize);
    const maxTeamSize = Number(input.maxTeamSize);
    if (!Number.isFinite(deadline) || !Number.isFinite(start) || !Number.isFinite(end)) {
      throw httpError(HttpStatus.BAD_REQUEST, 'Le date dell’hackathon non sono valide.');
    }
    if (
      deadline > start
      || start >= end
      || !Number.isFinite(prize)
      || prize < 0
      || !Number.isInteger(maxTeamSize)
      || maxTeamSize < 1
    ) {
      throw httpError(HttpStatus.BAD_REQUEST, 'Date, premio o dimensione del team non validi.');
    }
  }

  validateDetails(input = {}) {
    const required = ['name', 'regulation', 'registrationDeadline', 'startDate', 'endDate', 'location'];
    for (const field of required) {
      if (typeof input[field] !== 'string' || !input[field].trim()) {
        throw httpError(HttpStatus.BAD_REQUEST, `Il campo ${field} è obbligatorio.`);
      }
    }
    this.validateCreation(input);
    if (!Number.isInteger(Number(input.judgeId)) || !Number.isInteger(Number(input.mentorId))) {
      throw httpError(HttpStatus.BAD_REQUEST, 'Giudice o mentore non validi.');
    }
  }

  update(id, organizerId, input = {}) {
    const hackathon = this.repository.findById(id);
    if (!hackathon) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (hackathon.organizer_id !== organizerId) {
      throw httpError(HttpStatus.FORBIDDEN, 'Solo l’organizzatore dell’hackathon può modificarlo.');
    }
    const staff = this.repository.findStaff(id);
    const currentJudge = staff.find((member) => member.role === 'JUDGE');
    const currentMentor = staff.find((member) => member.role === 'MENTOR');
    const merged = {
      name: input.name ?? hackathon.name,
      regulation: input.regulation ?? hackathon.regulation,
      registrationDeadline: input.registrationDeadline ?? hackathon.registration_deadline,
      startDate: input.startDate ?? hackathon.start_date,
      endDate: input.endDate ?? hackathon.end_date,
      location: input.location ?? hackathon.location,
      prize: input.prize ?? hackathon.prize,
      maxTeamSize: input.maxTeamSize ?? hackathon.max_team_size,
      judgeId: input.judgeId ?? currentJudge?.user_id,
      mentorId: input.mentorId ?? currentMentor?.user_id,
    };
    this.validateDetails(merged);
    const judge = this.repository.findUserWithRole(Number(merged.judgeId), 'JUDGE');
    const mentor = this.repository.findUserWithRole(Number(merged.mentorId), 'MENTOR');
    if (!judge || !mentor) throw httpError(HttpStatus.BAD_REQUEST, 'Giudice o mentore non validi.');
    return this.repository.update(id, {
      ...merged,
      name: merged.name.trim(),
      regulation: merged.regulation.trim(),
      location: merged.location.trim(),
      prize: Number(merged.prize),
      maxTeamSize: Number(merged.maxTeamSize),
      judgeId: judge.id,
      mentorId: mentor.id,
    });
  }

  delete(id, organizerId) {
      const hackathon = this.repository.findById(id);
      if (!hackathon) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
      if (hackathon.organizer_id !== organizerId) {
        throw httpError(HttpStatus.FORBIDDEN, 'Solo l’organizzatore dell’hackathon può eliminarlo.');
      }
      this.repository.delete(id);
  }

  updateStatus(id, organizerId, status) {
    const hackathon = this.repository.findById(id);
    if (!hackathon) throw httpError(HttpStatus.NOT_FOUND, 'Hackathon non trovato.');
    if (hackathon.organizer_id !== organizerId) {
      throw httpError(HttpStatus.FORBIDDEN, 'Solo l’organizzatore dell’hackathon può modificarne lo stato.');
    }
    if (status !== null && !Object.values(HackathonStatus).includes(status)) {
      throw httpError(HttpStatus.BAD_REQUEST, 'Stato hackathon non valido.');
    }
    return this.repository.updateStatus(id, status);
  }
}

module.exports = { HackathonService };
