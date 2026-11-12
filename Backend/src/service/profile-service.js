class ProfileService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async wins(userId) {
    return this.userRepository.findWins(userId);
  }
}

module.exports = { ProfileService };
