import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthResponse {
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
  public readonly isAuthenticated = signal(false);
  public readonly email = signal('');
  public readonly role = signal<UserRole>('USER');

  public login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, { email, password }, { withCredentials: true })
      .pipe(tap((response) => this.saveSession(response)));
  }

  public register(email: string, password: string, name: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, { email, password, name }, { withCredentials: true })
      .pipe(tap((response) => this.saveSession(response)));
  }

  public getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${environment.apiUrl}/auth/profile`, { withCredentials: true });
  }

  public updateProfile(profile: UserProfile): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${environment.apiUrl}/auth/profile`, profile).pipe(
      tap((response) => {
        this.email.set(response.email);
        this.role.set(response.role);
      }),
    );
  }

  public logout(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/logout`, {}, { withCredentials: true }).pipe(
      tap(() => this.clearSession()),
    );
  }

  public clearSession(): void {
    this.isAuthenticated.set(false);
    this.email.set('');
    this.role.set('USER');
  }

  private saveSession(response: AuthResponse): void {
    this.isAuthenticated.set(true);
    this.email.set(response.email);
    this.role.set(response.role);
  }

  public restoreSession(): Observable<boolean> {
    return this.getProfile().pipe(
      tap((profile) => {
        this.isAuthenticated.set(true);
        this.email.set(profile.email);
        this.role.set(profile.role);
      }),
      map(() => true),
      catchError(() => {
        this.clearSession();
        return of(false);
      }),
    );
  }
}
