import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../../core/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  public readonly isRegistering = signal(false);
  public readonly loading = signal(false);
  public readonly error = signal<string | null>(null);
  public toggleMode(): void {
    this.isRegistering.update((registering) => !registering);
    this.error.set(null);
  }

  public submit(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const values = new FormData(form);
    const email = values.get('email');
    const name = values.get('name');
    const password = values.get('password');
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      (this.isRegistering() && typeof name !== 'string')
    ) return;

    if (this.loading()) return;

    this.loading.set(true);
    this.error.set(null);
    const request = this.isRegistering()
      ? this.auth.register(email, password, name as string)
      : this.auth.login(email, password);

    request.subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigateByUrl('/');
      },
      error: (err: unknown) => {
        console.error('Errore durante autenticazione:', err);
        this.error.set(this.getErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.error === 'string') {
      return error.error.error;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Impossibile contattare il server. Verifica che il backend sia avviato.';
  }
}
