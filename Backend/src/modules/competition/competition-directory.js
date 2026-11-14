class CompetitionDirectory {
  constructor(competitionRepository) {
    this.competitionRepository = competitionRepository;
  }

  async winnerTeamId(hackathonId) {
    return this.competitionRepository.winnerTeamId(hackathonId);
  }

  async registeredHackathonIds(teamId) {
    return this.competitionRepository.registeredHackathonIds(teamId);
  }

  async registeredTeamIds(hackathonId) {
    return this.competitionRepository.registeredTeamIds(hackathonId);
  }

  async isRegistered(hackathonId, teamId) {
    return Boolean(await this.competitionRepository.registration(hackathonId, teamId));
  }
}

module.exports = { CompetitionDirectory };
