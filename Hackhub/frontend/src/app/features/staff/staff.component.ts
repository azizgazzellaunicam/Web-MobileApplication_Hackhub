import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Auth } from '../../core/auth/auth.service';
import { Hackathon } from '../hackathons/data/hackathon.model';
import { StaffService, StaffSubmission, SupportRequest } from './data/staff.service';

@Component({
  standalone: true,
  selector: 'app-staff',
  templateUrl: './staff.component.html',
})
export class Staff implements OnInit {
  public readonly auth = inject(Auth);
  private readonly service = inject(StaffService);
  public readonly hackathons = signal<Hackathon[]>([]);
  public readonly submissions = signal<StaffSubmission[]>([]);
  public readonly requests = signal<SupportRequest[]>([]);
  public readonly error = signal<string | null>(null);
  public readonly notice = signal<string | null>(null);
  public readonly teams = signal<{ id: number; name: string }[]>([]);
  public readonly selectedHackathon = signal<number | null>(null);

  public ngOnInit(): void {
    if (this.auth.role() === 'JUDGE') {
      this.service.assigned().subscribe({
        next: (items) => { this.hackathons.set(items); if (items[0]) this.select(items[0].id); },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
    } else {
      this.service.assigned().subscribe({
        next: (items) => this.hackathons.set(items),
        error: (error: unknown) => this.error.set(this.message(error)),
      });
      this.loadSupport();
    }
  }
  public select(id: number): void {
    this.selectedHackathon.set(id);
    if (this.auth.role() === 'MENTOR') {
      this.teams.set([]);
      this.service.teams(id).subscribe({
        next: (items) => this.teams.set(items),
        error: (error: unknown) => this.error.set(this.message(error)),
      });
      return;
    }
    const hackathon = this.hackathons().find((item) => item.id === id);
    if (this.auth.role() === 'JUDGE' && hackathon?.status !== 'VALUTAZIONE') {
      this.submissions.set([]);
      return;
    }
    this.service.submissions(id).subscribe({
      next: (items) => this.submissions.set(items),
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }
  public canEvaluateSelectedHackathon(): boolean {
    return this.hackathons().some((item) =>
      item.id === this.selectedHackathon() && item.status === 'VALUTAZIONE');
  }
  public evaluate(event: Event, submission: StaffSubmission): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const values = new FormData(form);
    const score = Number(values.get('score'));
    const comment = String(values.get('comment') ?? '').trim();
    this.service.evaluate(submission.id, score, comment).subscribe({
      next: (response) => { this.notice.set(response.message); form.reset(); },
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }
  public report(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget;
    const hackathonId = this.selectedHackathon();
    if (!(form instanceof HTMLFormElement) || hackathonId === null) return;
    const values = new FormData(form);
    const teamId = Number(values.get('teamId'));
    const description = String(values.get('description') ?? '').trim();
    if (!teamId || !description) return;
    this.service.report(hackathonId, teamId, description).subscribe({
      next: () => { this.error.set(null); this.notice.set('Segnalazione inviata.'); form.reset(); this.loadSupport(); },
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }
  public schedule(event: Event, request: SupportRequest): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const scheduledAt = String(new FormData(form).get('scheduledAt') ?? '');
    this.service.call(request.id, scheduledAt).subscribe({
      next: (response) => { this.notice.set(`Call pianificata: ${response.link}`); form.reset(); },
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }
  public close(request: SupportRequest): void {
    this.service.close(request.id).subscribe({
      next: () => { this.notice.set('Richiesta chiusa.'); this.loadSupport(); },
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }
  private loadSupport(): void {
    this.service.support().subscribe({
      next: (items) => this.requests.set(items),
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }
  private message(error: unknown): string {
    return error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
      ? error.error.error : 'Impossibile comunicare con il server.';
  }
}
