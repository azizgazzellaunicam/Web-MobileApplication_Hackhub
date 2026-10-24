import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Auth, UserProfile } from '../../../core/auth/auth.service';

@Component({ standalone: true, selector: 'app-profile', templateUrl: './profile.component.html' })
export class Profile implements OnInit {
  private readonly auth = inject(Auth);
  public readonly profile = signal<UserProfile | null>(null);
  public readonly loading = signal(true);
  public readonly saving = signal(false);
  public readonly error = signal<string | null>(null);
  public readonly success = signal<string | null>(null);

  public ngOnInit(): void {
    this.auth.getProfile().subscribe({
      next: (profile) => { this.profile.set(profile); this.loading.set(false); },
      error: (error: unknown) => { this.error.set(this.message(error)); this.loading.set(false); },
    });
  }
  public submit(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement) || this.saving()) return;
    const values = new FormData(form);
    const profile: UserProfile = {
      id: this.profile()?.id ?? 0,
      role: this.profile()?.role ?? 'USER',
      name: String(values.get('name') ?? '').trim(),
      email: String(values.get('email') ?? '').trim(),
    };
    this.saving.set(true); this.error.set(null); this.success.set(null);
    this.auth.updateProfile(profile).subscribe({
      next: (updated) => { this.profile.set(updated); this.success.set('Profilo aggiornato correttamente.'); this.saving.set(false); },
      error: (error: unknown) => { this.error.set(this.message(error)); this.saving.set(false); },
    });
  }
  private message(error: unknown): string {
    return error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
      ? error.error.error : 'Impossibile comunicare con il server.';
  }
}
