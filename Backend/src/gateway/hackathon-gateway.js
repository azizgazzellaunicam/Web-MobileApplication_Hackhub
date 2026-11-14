const { HackathonStatus, resolveHackathonStatus } = require('../domain/hackathon-status');

class HackathonGateway {
  constructor(hackathonService, hackathonDirectory, teamDirectory, competitionDirectory) {
    this.hackathonService = hackathonService;
    this.hackathonDirectory = hackathonDirectory;
    this.teamDirectory = teamDirectory;
    this.competitionDirectory = competitionDirectory;
  }

  async serialize(row) {
    const winnerTeamId = await this.competitionDirectory.winnerTeamId(row.id);
    return {
      ...row,
      winner_team_id: winnerTeamId,
      status: resolveHackathonStatus(row, winnerTeamId),
      status_override: row.status_override || null,
    };
  }

  async serializeAll(rows) {
    return Promise.all(rows.map((row) => this.serialize(row)));
  }

  async list(userId) {
    const team = userId ? await this.teamDirectory.teamOfUser(userId) : null;
    const assignments = userId ? await this.hackathonDirectory.assignmentsForUser(userId) : [];
    const assignedById = new Map(assignments.map((assignment) => [assignment.hackathon_id, assignment.role]));
    const registered = new Set(team ? await this.competitionDirectory.registeredHackathonIds(team.team_id) : []);
    const items = await this.serializeAll(await this.hackathonService.list());
    return items.map((item) => ({
      ...item,
      is_registered: registered.has(item.id),
      is_winner: Boolean(team && item.winner_team_id === team.team_id),
      assigned_role: assignedById.get(item.id) || null,
    }));
  }

  async detail(id) {
    return this.serialize(await this.hackathonService.detail(id));
  }

  async assigned(userId) {
    return this.serializeAll(await this.hackathonService.listAssigned(userId));
  }

  async evaluation(userId) {
    const items = await this.serializeAll(await this.hackathonService.listEvaluation(userId));
    return items.filter((item) => item.status === HackathonStatus.EVALUATION);
  }
}

module.exports = { HackathonGateway };
