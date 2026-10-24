class ProfileService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  wins(userId) {
    return this.userRepository.findWins(userId);
  }
}

module.exports = { ProfileService };
