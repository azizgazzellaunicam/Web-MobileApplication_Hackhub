const { HttpStatus, httpError } = require('../../http/http-errors');
const { readServiceToken, serviceTokenHeader } = require('../../security/service-token');

const requestTimeoutMs = 5000;

class HttpIdentityDirectory {
  constructor({ baseUrl, serviceToken, fetchImpl = fetch }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.serviceToken = serviceToken;
    this.fetchImpl = fetchImpl;
  }

  async request(path, { method = 'GET', body } = {}) {
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          [serviceTokenHeader]: this.serviceToken,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch {
      throw httpError(HttpStatus.BAD_GATEWAY, 'Servizio Identity non disponibile.');
    }
    if (response.status === HttpStatus.NOT_FOUND) return null;
    if (!response.ok) throw httpError(HttpStatus.BAD_GATEWAY, 'Servizio Identity non disponibile.');
    return response.json();
  }

  async findById(id) {
    return await this.request(`/internal/users/${encodeURIComponent(id)}`);
  }

  async findProfiles(ids) {
    const profiles = new Map();
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return profiles;
    const users = await this.request('/internal/users/lookup', { method: 'POST', body: { ids: uniqueIds } });
    for (const user of users) profiles.set(user.id, user);
    return profiles;
  }

  async findIdByEmail(email) {
    return await this.request(`/internal/users/by-email?email=${encodeURIComponent(email)}`);
  }

  async findUserWithRole(id, role) {
    return await this.request(`/internal/users/${encodeURIComponent(id)}/roles/${encodeURIComponent(role)}`);
  }

  async listStaffCandidates() {
    return await this.request('/internal/staff-candidates') ?? [];
  }
}

function createHttpIdentityDirectory(env = process.env) {
  const baseUrl = env.IDENTITY_SERVICE_URL;
  if (!baseUrl) throw new Error('La variabile d\'ambiente IDENTITY_SERVICE_URL è obbligatoria.');
  return new HttpIdentityDirectory({ baseUrl, serviceToken: readServiceToken(env) });
}

module.exports = { HttpIdentityDirectory, createHttpIdentityDirectory };
