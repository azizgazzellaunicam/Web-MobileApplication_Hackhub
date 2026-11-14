class TeamDirectory {
  constructor(teamRepository) {
    this.teamRepository = teamRepository;
  }

  async teamOfUser(userId) {
    return await this.teamRepository.findByMember(userId) ?? null;
  }

  async isMember(teamId, userId) {
    return Boolean(await this.teamRepository.findMember(teamId, userId));
  }

  async memberIds(teamId) {
    return this.teamRepository.memberIds(teamId);
  }

  async memberCount(teamId) {
    return this.teamRepository.countMembers(teamId);
  }

  async findTeams(ids) {
    const teams = new Map();
    for (const id of new Set(ids)) {
      const team = await this.teamRepository.findById(id);
      if (team) teams.set(team.id, team);
    }
    return teams;
  }

  async listTeams() {
    return this.teamRepository.listTeams();
  }
}

module.exports = { TeamDirectory };
