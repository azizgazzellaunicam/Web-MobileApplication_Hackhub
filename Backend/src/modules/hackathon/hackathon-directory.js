class HackathonDirectory {
  constructor(hackathonRepository) {
    this.hackathonRepository = hackathonRepository;
  }

  async findById(id) {
    return await this.hackathonRepository.findById(id) ?? null;
  }

  async findByIds(ids) {
    const hackathons = new Map();
    for (const id of new Set(ids)) {
      const hackathon = await this.hackathonRepository.findById(id);
      if (hackathon) hackathons.set(hackathon.id, hackathon);
    }
    return hackathons;
  }

  async hasStarted(id) {
    const hackathon = await this.hackathonRepository.findById(id);
    return Boolean(hackathon) && Date.parse(hackathon.start_date) <= Date.now();
  }

  async assignmentsForUser(userId) {
    return this.hackathonRepository.assignmentsForUser(userId);
  }

  async hasAccess(hackathonId, userId) {
    const hackathon = await this.hackathonRepository.findById(hackathonId);
    if (!hackathon) return false;
    if (hackathon.organizer_id === userId) return true;
    const staff = await this.hackathonRepository.findStaff(hackathonId);
    return staff.some((member) => member.user_id === userId);
  }

  async isJudge(hackathonId, userId) {
    return this.hasRole(hackathonId, userId, 'JUDGE');
  }

  async isMentor(hackathonId, userId) {
    return this.hasRole(hackathonId, userId, 'MENTOR');
  }

  async hasRole(hackathonId, userId, role) {
    const staff = await this.hackathonRepository.findStaff(hackathonId);
    return staff.some((member) => member.user_id === userId && member.role === role);
  }
}

module.exports = { HackathonDirectory };
