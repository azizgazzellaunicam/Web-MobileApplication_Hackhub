import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NotificationItem, NotificationService } from './data/notification.service';

@Component({
  standalone: true,
  imports: [DatePipe],
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
})
export class Notifications implements OnInit {
  private readonly service = inject(NotificationService);
  public readonly items = signal<NotificationItem[]>([]);
  public readonly unreadCount = signal(0);
  public readonly error = signal<string | null>(null);

  public ngOnInit(): void {
    this.load();
  }

  public open(item: NotificationItem): void {
    if (item.read_at) return;
    this.service.markRead(item.id).subscribe({
      next: () => {
        this.items.update((items) => items.map((current) => current.id === item.id
          ? { ...current, read_at: new Date().toISOString() }
          : current));
        this.unreadCount.update((count) => Math.max(0, count - 1));
        this.service.unread.update((count) => Math.max(0, count - 1));
      },
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }

  private load(): void {
    this.service.list().subscribe({
      next: (response) => {
        this.items.set(response.items);
        this.unreadCount.set(response.unreadCount);
        this.service.unread.set(response.unreadCount);
      },
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }

  private message(error: unknown): string {
    return error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
      ? error.error.error
      : 'Impossibile caricare le notifiche.';
  }
}
