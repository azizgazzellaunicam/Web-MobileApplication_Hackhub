import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Auth } from './auth.service';

describe('Auth service', () => {
  it('clears local session after successful logout', async () => {
    await TestBed.configureTestingModule({
      providers: [Auth, provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const auth = TestBed.inject(Auth);
    const http = TestBed.inject(HttpTestingController);
    auth.isAuthenticated.set(true);
    auth.email.set('judge@hackhub.it');
    auth.role.set('JUDGE');

    const request = firstValueFrom(auth.logout());
    http.expectOne('/api/auth/logout').flush({});
    await request;
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.email()).toBe('');
    expect(auth.role()).toBe('USER');
    http.verify();
  });

  it('clears local session even when logout request fails', async () => {
    await TestBed.configureTestingModule({
      providers: [Auth, provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const auth = TestBed.inject(Auth);
    const http = TestBed.inject(HttpTestingController);
    auth.isAuthenticated.set(true);
    auth.email.set('judge@hackhub.it');
    auth.role.set('JUDGE');

    const request = firstValueFrom(auth.logout());
    http.expectOne('/api/auth/logout').flush(
      { error: 'Server error' },
      { status: 500, statusText: 'Server Error' },
    );
    await expect(request).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.email()).toBe('');
    expect(auth.role()).toBe('USER');
    http.verify();
  });

  it('coordinates refreshes through the browser Web Locks API when available', async () => {
    await TestBed.configureTestingModule({
      providers: [Auth, provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const auth = TestBed.inject(Auth);
    const http = TestBed.inject(HttpTestingController);
    const previousLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');
    const requestLock = vi.fn((_name: string, callback: () => Promise<boolean>) => callback());
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: requestLock },
    });

    try {
      const refreshed = firstValueFrom(auth.refreshSession());
      http.expectOne('/api/auth/refresh').flush({
        email: 'mario@example.com',
        name: 'Mario',
        role: 'USER',
      });

      await expect(refreshed).resolves.toBe(true);
      expect(requestLock).toHaveBeenCalledOnce();
      expect(requestLock).toHaveBeenCalledWith('hackhub-auth-refresh', expect.any(Function));
      http.verify();
    } finally {
      if (previousLocks) Object.defineProperty(navigator, 'locks', previousLocks);
      else Reflect.deleteProperty(navigator, 'locks');
    }
  });
});
