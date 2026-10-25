import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { HackathonService } from '../data/hackathon.service';
import { Hackathon } from '../data/hackathon.model';

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, NgTemplateOutlet],
  selector: 'app-hackathons-list',
  templateUrl: './hackathons-list.component.html',
})
export class HackathonsList implements OnInit {
  private readonly service = inject(HackathonService);
  public readonly hackathons = signal<Hackathon[]>([]);
  public readonly loading = signal(true);
  public readonly error = signal<string | null>(null);
  public readonly notice = signal<string | null>(null);
  public readonly registering = signal<number | null>(null);

  public ngOnInit(): void {
    this.service.list().subscribe({
      next: (items) => { this.hackathons.set(items); this.loading.set(false); },
      error: (error: unknown) => { this.error.set(this.message(error)); this.loading.set(false); },
    });
  }
  public register(item: Hackathon): void {
    if (item.is_registered || item.status !== 'ISCRIZIONI_APERTE' || this.registering() !== null) return;
    this.notice.set(null);
    this.error.set(null);
    this.registering.set(item.id);
    this.service.register(item.id).subscribe({
      next: (response) => {
        this.hackathons.update((items) => items.map((current) =>
          current.id === item.id ? { ...current, is_registered: true } : current));
        this.notice.set(response.message);
        this.registering.set(null);
      },
      error: (error: unknown) => {
        this.error.set(this.message(error));
        this.registering.set(null);
      },
    });
  }
  public registeredHackathons(): Hackathon[] {
    return this.hackathons().filter((item) => item.is_registered);
  }
  public assignedHackathons(): Hackathon[] {
    return this.hackathons().filter((item) => item.assigned_role);
  }
  public otherHackathons(): Hackathon[] {
    return this.hackathons().filter((item) => !item.is_registered && !item.assigned_role);
  }
  private message(error: unknown): string {
    return error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
      ? error.error.error : 'Impossibile comunicare con il server.';
  }
}
