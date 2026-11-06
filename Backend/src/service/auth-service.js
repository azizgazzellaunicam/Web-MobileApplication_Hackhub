const { randomUUID } = require('node:crypto');
const { HttpStatus, httpError } = require('../http/http-errors');
const { refreshTokenTtlSeconds, createAccessToken, createRefreshToken } = require('../security/jwt');

class AuthService {
  constructor(userRepository, refreshTokenRepository, hashPassword, verifyPassword) {
    this.userRepository = userRepository;
    this.refreshTokenRepository = refreshTokenRepository;
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
    this.refreshTokenRepository.revoke(token);
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
    const refreshToken = createRefreshToken();
    this.refreshTokenRepository.save(
      refreshToken,
      user.id,
      Date.now() + refreshTokenTtlSeconds * 1000,
      randomUUID(),
    );
    return {
      accessToken: createAccessToken(user),
      refreshToken,
      email: user.email,
      role: user.role,
      name: user.name,
    };
  }

  refresh(token) {
    const current = this.refreshTokenRepository.find(token);
    if (!current) throw httpError(HttpStatus.UNAUTHORIZED, 'Refresh token non valido.');
    if (current.revoked_at) {
      this.refreshTokenRepository.revokeFamily(current.family_id);
      throw httpError(HttpStatus.UNAUTHORIZED, 'Refresh token riutilizzato.');
    }
    const user = this.userRepository.findById(current.user_id);
    if (!user || current.expires_at <= Date.now()) {
      this.refreshTokenRepository.revoke(token);
      throw httpError(HttpStatus.UNAUTHORIZED, 'Refresh token scaduto.');
    }
    const replacement = createRefreshToken();
    if (!this.refreshTokenRepository.rotate(
      token,
      replacement,
      user.id,
      Date.now() + refreshTokenTtlSeconds * 1000,
      current.family_id,
    )) {
      const latest = this.refreshTokenRepository.find(token);
      if (latest?.revoked_at) this.refreshTokenRepository.revokeFamily(latest.family_id);
      throw httpError(HttpStatus.UNAUTHORIZED, 'Refresh token non valido.');
    }
    return {
      accessToken: createAccessToken(user),
      refreshToken: replacement,
      email: user.email,
      role: user.role,
      name: user.name,
    };
  }
}

module.exports = { AuthService };
