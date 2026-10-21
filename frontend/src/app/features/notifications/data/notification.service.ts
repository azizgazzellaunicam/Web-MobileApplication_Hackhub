import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface NotificationItem {
  id: number;
  type: 'VICTORY' | 'INVITATION' | string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: number | null;
  created_at: string;
  read_at: string | null;
}

export interface NotificationResponse {
  items: NotificationItem[];
  unreadCount: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/notifications`;
  public readonly unread = signal(0);

  public list(): Observable<NotificationResponse> {
    return this.http.get<NotificationResponse>(this.url);
  }

  public markRead(id: number): Observable<void> {
    return this.http.put<void>(`${this.url}/${id}/read`, {});
  }

  public refreshUnread(): void {
    this.http.get<{ unreadCount: number }>(`${this.url}/unread-count`).subscribe({
      next: (response) => this.unread.set(response.unreadCount),
      error: () => this.unread.set(0),
    });
  }
}
