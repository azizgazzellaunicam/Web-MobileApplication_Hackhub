import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
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
});
