import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthResponse {
  token: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface UserProfile {
  email: string;
  name: string;
  role: UserRole;
  id: number;
}
export type UserRole = 'USER' | 'ORGANIZER' | 'JUDGE' | 'MENTOR';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly storageKey = 'hackhub-auth-token';
  private readonly emailKey = 'hackhub-auth-email';
  private readonly roleKey = 'hackhub-auth-role';

  public readonly isAuthenticated = signal(!!sessionStorage.getItem(this.storageKey));
  public readonly email = signal(sessionStorage.getItem(this.emailKey) ?? '');
  public readonly role = signal((sessionStorage.getItem(this.roleKey) ?? 'USER') as UserRole);

  public get token(): string | null {
    return sessionStorage.getItem(this.storageKey);
  }

  public login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap((response) => this.saveSession(response)));
  }

  public register(email: string, password: string, name: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, { email, password, name })
      .pipe(tap((response) => this.saveSession(response)));
  }

  public getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${environment.apiUrl}/auth/profile`);
  }

  public updateProfile(profile: UserProfile): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${environment.apiUrl}/auth/profile`, profile).pipe(
      tap((response) => {
        sessionStorage.setItem(this.emailKey, response.email);
        sessionStorage.setItem(this.roleKey, response.role);
        this.email.set(response.email);
        this.role.set(response.role);
      }),
    );
  }

  public logout(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/logout`, {}).pipe(
      tap(() => this.clearSession()),
    );
  }

  public clearSession(): void {
    sessionStorage.removeItem(this.storageKey);
    sessionStorage.removeItem(this.emailKey);
    this.isAuthenticated.set(false);
    this.email.set('');
    sessionStorage.removeItem(this.roleKey);
    this.role.set('USER');
  }

  private saveSession(response: AuthResponse): void {
    sessionStorage.setItem(this.storageKey, response.token);
    sessionStorage.setItem(this.emailKey, response.email);
    sessionStorage.setItem(this.roleKey, response.role);
    this.isAuthenticated.set(true);
    this.email.set(response.email);
    this.role.set(response.role);
  }
}
