const { randomBytes } = require('node:crypto');
const { HttpStatus, httpError } = require('../http/http-errors');

class AuthService {
  constructor(userRepository, sessions, hashPassword, verifyPassword) {
    this.userRepository = userRepository;
    this.sessions = sessions;
    this.hashPassword = hashPassword;
    this.verifyPassword = verifyPassword;
  }

  register(input) {
    const email = String(input?.email || '').trim().toLowerCase();
    const password = String(input?.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      throw httpError(HttpStatus.BAD_REQUEST, 'Email non valida o password troppo corta.');
    }
    const name = typeof input?.name === 'string' && input.name.trim()
      ? input.name.trim()
      : email.split('@')[0];
    const result = this.userRepository.create(name, email, this.hashPassword(password));
    return this.createSession(result.lastInsertRowid);
  }

  login(input) {
    const user = this.userRepository.findByEmail(String(input?.email || '').trim().toLowerCase());
    if (!user || !this.verifyPassword(String(input?.password || ''), user.password_hash)) {
      throw httpError(HttpStatus.UNAUTHORIZED, 'Email o password non corrette.');
    }
    return this.createSession(user.id);
  }

  logout(token) {
    this.sessions.delete(token);
  }

  updateProfile(userId, input) {
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw httpError(HttpStatus.BAD_REQUEST, 'Nome o email non validi.');
    }
    if (this.userRepository.findByEmailExcept(email, userId)) {
      throw httpError(HttpStatus.CONFLICT, 'Email già utilizzata.');
    }
    return this.userRepository.updateProfile(userId, name, email);
  }

  createSession(userId) {
    const user = this.userRepository.findById(userId);
    if (!user) throw httpError(HttpStatus.INTERNAL_SERVER_ERROR, 'Utente non trovato.');
    const token = randomBytes(32).toString('hex');
    this.sessions.set(token, { user, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
    return { token, email: user.email, role: user.role, name: user.name };
  }
}

module.exports = { AuthService };
