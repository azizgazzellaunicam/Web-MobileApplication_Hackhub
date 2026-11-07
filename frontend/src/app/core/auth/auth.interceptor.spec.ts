import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { Auth } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let auth: Auth;
  const router = { navigateByUrl: () => Promise.resolve(true) };

  afterEach(() => {
    http.verify();
  });

  function setup(): void {
    TestBed.configureTestingModule({
      providers: [
        Auth,
        { provide: Router, useValue: router },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(Auth);
    auth.isAuthenticated.set(true);
  }

  it('refreshes once and retries concurrent unauthorized requests', async () => {
    setup();
    const client = TestBed.inject(HttpClient);
    const first = firstValueFrom(client.get('/api/profile/wins'));
    const second = firstValueFrom(client.get('/api/notifications'));

    const failed = http.match((request) => request.url.startsWith('/api/'));
    expect(failed).toHaveLength(2);
    failed.forEach((request) => request.flush({ status: 401 }, { status: 401, statusText: 'Unauthorized' }));

    const refresh = http.expectOne('/api/auth/refresh');
    expect(http.match('/api/auth/refresh')).toHaveLength(0);
    refresh.flush({ email: 'mario@example.com', name: 'Mario', role: 'USER' });

    const retries = http.match((request) => request.url === '/api/profile/wins' || request.url === '/api/notifications');
    expect(retries).toHaveLength(2);
    retries.forEach((request) => request.flush([]));
    await Promise.all([first, second]);
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('clears authentication when refresh fails', async () => {
    setup();
    const client = TestBed.inject(HttpClient);
    const request = firstValueFrom(client.get('/api/profile/wins'));
    http.expectOne('/api/profile/wins').flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });
    await expect(request).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(auth.isAuthenticated()).toBe(false);
  });
});
