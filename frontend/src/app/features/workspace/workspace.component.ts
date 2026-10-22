import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Invitation, Submission, Team, WorkspaceHackathon, WorkspaceService } from './workspace.service';

@Component({ standalone: true, imports: [DatePipe], selector: 'app-workspace', templateUrl: './workspace.component.html' })
export class Workspace implements OnInit {
  private readonly service = inject(WorkspaceService);
  public readonly teams = signal<Team[]>([]);
  public readonly invitations = signal<Invitation[]>([]);
  public readonly submissions = signal<Submission[]>([]);
  public readonly hackathons = signal<WorkspaceHackathon[]>([]);
  public readonly loading = signal(true);
  public readonly error = signal<string | null>(null);
  public readonly notice = signal<string | null>(null);
  public readonly editingSubmission = signal<number | null>(null);
  public readonly pendingInvitations = () => this.invitations().filter((invitation) => invitation.status === 'IN_ATTESA').length;

  public ngOnInit(): void {
    this.refresh();
  }
  public createTeam(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const value = new FormData(form).get('name');
    if (typeof value !== 'string' || !value.trim()) return;
    this.service.createTeam(value).subscribe({
      next: () => { this.notice.set('Team creato.'); form.reset(); this.refresh(); },
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }
  public decide(invitation: Invitation, decision: 'accept' | 'reject'): void {
    this.service.decideInvitation(invitation.id, decision).subscribe({
      next: (response) => { this.notice.set(response.message); this.refresh(); },
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }
  public invite(event: Event, teamId: number): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const email = new FormData(form).get('email');
    if (typeof email !== 'string' || !email.trim()) return;
    this.service.invite(teamId, email).subscribe({
      next: () => { this.notice.set('Invito inviato.'); form.reset(); },
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }
  public submit(event: Event, hackathonId: number): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const content = String(new FormData(form).get('content') ?? '');
    this.service.submit(hackathonId, content).subscribe({
      next: () => { this.notice.set('Sottomissione inviata.'); form.reset(); this.refresh(); },
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }
  public editSubmission(submission: Submission): void {
    this.editingSubmission.set(submission.id);
  }
  public updateSubmission(event: Event, submission: Submission): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const content = String(new FormData(form).get('content') ?? '').trim();
    this.service.updateSubmission(submission.id, content).subscribe({
      next: () => { this.notice.set('Sottomissione aggiornata.'); this.editingSubmission.set(null); this.refresh(); },
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }
  private refresh(): void {
    this.loading.set(true);
    this.service.teams().subscribe({
      next: (teams) => { this.teams.set(teams); this.loading.set(false); },
      error: (error: unknown) => { this.error.set(this.message(error)); this.loading.set(false); },
    });
    this.service.invitations().subscribe({ next: (items) => this.invitations.set(items), error: () => undefined });
    this.service.submissions().subscribe({     next: (items) => this.submissions.set(items), error: () => undefined });
    this.service.hackathons().subscribe({ next: (items) => this.hackathons.set(items), error: () => undefined });
  }
  private message(error: unknown): string {
    return error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
      ? error.error.error : 'Impossibile comunicare con il server.';
  }
}
