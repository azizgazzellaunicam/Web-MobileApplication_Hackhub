import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Auth } from './core/auth/auth.service';
import { NotificationService } from './features/notifications/data/notification.service';

@Component({
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  public readonly auth = inject(Auth);
  public readonly notifications = inject(NotificationService);
  public readonly unreadNotifications = this.notifications.unread;
  private readonly router = inject(Router);

  public constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      if (this.auth.isAuthenticated()) this.notifications.refreshUnread();
    });
  }

  public logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: (error: unknown) => {
        console.error('Errore durante la chiusura della sessione:', error);
        this.auth.clearSession();
        void this.router.navigateByUrl('/login');
      },
    });
  }
}
