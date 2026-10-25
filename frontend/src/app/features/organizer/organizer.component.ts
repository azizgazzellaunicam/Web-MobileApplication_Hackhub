import { HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { HackathonRanking, OrganizerService, StaffMember, UpdateHackathonRequest } from './data/organizer.service';
import { Hackathon, HackathonStatus } from '../hackathons/data/hackathon.model';

@Component({
  standalone: true,
  imports: [DecimalPipe],
  selector: 'app-organizer',
  templateUrl: './organizer.component.html',
})
export class Organizer implements OnInit {
  private readonly service = inject(OrganizerService);
  public readonly staff = signal<StaffMember[]>([]);
  public readonly loading = signal(true);
  public readonly saving = signal(false);
  public readonly error = signal<string | null>(null);
  public readonly success = signal<string | null>(null);
  public readonly hackathons = signal<Hackathon[]>([]);
  public readonly statuses: HackathonStatus[] = ['ISCRIZIONI_APERTE', 'ISCRIZIONI_CHIUSE', 'IN_CORSO', 'VALUTAZIONE', 'CONCLUSO'];
  public readonly statusDrafts = signal<Record<number, HackathonStatus | null>>({});
  public readonly statusSaving = signal<number | null>(null);
  public readonly rankings = signal<Record<number, HackathonRanking>>({});
  public readonly rankingLoading = signal<number | null>(null);
  public readonly winnerSaving = signal<number | null>(null);
  public readonly editingHackathon = signal<number | null>(null);
  public readonly deletingHackathon = signal<number | null>(null);

  public ngOnInit(): void {
    this.service.staff().subscribe({
      next: (staff) => { this.staff.set(staff); this.loading.set(false); },
      error: (error: unknown) => { this.error.set(this.message(error)); this.loading.set(false); },
    });
    this.service.hackathons().subscribe({
      next: (items) => this.hackathons.set(items),
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }

  public judges(): StaffMember[] { return this.staff().filter((member) => member.role === 'JUDGE'); }
  public mentors(): StaffMember[] { return this.staff().filter((member) => member.role === 'MENTOR'); }

  public submit(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement) || this.saving()) return;
    const values = new FormData(form);
    const request = {
      name: this.value(values, 'name'),
      regulation: this.value(values, 'regulation'),
      registrationDeadline: this.value(values, 'registrationDeadline'),
      startDate: this.value(values, 'startDate'),
      endDate: this.value(values, 'endDate'),
      location: this.value(values, 'location'),
      prize: Number(this.value(values, 'prize')),
      maxTeamSize: Number(this.value(values, 'maxTeamSize')),
      judgeId: Number(this.value(values, 'judgeId')),
      mentorId: Number(this.value(values, 'mentorId')),
    };
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.service.create(request).subscribe({
      next: () => { this.success.set('Hackathon creato e staff assegnato correttamente.'); this.saving.set(false); form.reset(); },
      error: (error: unknown) => { this.error.set(this.message(error)); this.saving.set(false); },
    });
  }
  public selectStatus(item: Hackathon): string {
    return this.statusDrafts()[item.id] ?? item.status_override ?? '';
  }

  public edit(item: Hackathon): void {
    this.editingHackathon.set(item.id);
  }

  public cancelEdit(): void {
    this.editingHackathon.set(null);
  }

  public dateInput(value: string): string {
    return value ? value.slice(0, 16) : '';
  }

  public update(event: Event, item: Hackathon): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const values = new FormData(form);
    const request: UpdateHackathonRequest = {
      name: this.value(values, 'name'),
      regulation: this.value(values, 'regulation'),
      registrationDeadline: this.value(values, 'registrationDeadline'),
      startDate: this.value(values, 'startDate'),
      endDate: this.value(values, 'endDate'),
      location: this.value(values, 'location'),
      prize: Number(this.value(values, 'prize')),
      maxTeamSize: Number(this.value(values, 'maxTeamSize')),
      judgeId: this.optionalNumber(values, 'judgeId'),
      mentorId: this.optionalNumber(values, 'mentorId'),
    };
    this.saving.set(true);
    this.service.update(item.id, request).subscribe({
      next: (updated) => {
        this.hackathons.update((items) => items.map((current) => current.id === updated.id ? updated : current));
        this.editingHackathon.set(null);
        this.saving.set(false);
        this.success.set('Hackathon aggiornato.');
      },
      error: (error: unknown) => { this.saving.set(false); this.error.set(this.message(error)); },
    });
  }

  public delete(item: Hackathon): void {
    if (!window.confirm(`Eliminare "${item.name}"? Verranno eliminate anche iscrizioni, sottomissioni, valutazioni e richieste di supporto collegate.`)) return;
    this.deletingHackathon.set(item.id);
    this.service.delete(item.id).subscribe({
      next: () => {
        this.hackathons.update((items) => items.filter((current) => current.id !== item.id));
        this.deletingHackathon.set(null);
        this.success.set('Hackathon eliminato e dipendenze rimosse.');
      },
      error: (error: unknown) => { this.deletingHackathon.set(null); this.error.set(this.message(error)); },
    });
  }

  public draftStatus(item: Hackathon, event: Event): void {
    if (!(event.target instanceof HTMLSelectElement)) return;
    const value = event.target.value;
    this.statusDrafts.update((drafts) => ({
      ...drafts,
      [item.id]: value ? value as HackathonStatus : null,
    }));
  }

  public saveStatus(item: Hackathon): void {
    const value = this.statusDrafts()[item.id] ?? item.status_override ?? null;
    this.statusSaving.set(item.id);
    this.error.set(null);
    this.service.updateStatus(item.id, value).subscribe({
      next: (updated) => {
        this.hackathons.update((items) => items.map((current) => current.id === updated.id ? updated : current));
        this.statusDrafts.update((drafts) => {
          const next = { ...drafts };
          delete next[item.id];
          return next;
        });
        this.statusSaving.set(null);
        this.success.set('Stato aggiornato.');
      },
      error: (error: unknown) => {
        this.statusSaving.set(null);
        this.error.set(this.message(error));
      },
    });
  }
  public loadRanking(item: Hackathon): void {
    this.rankingLoading.set(item.id);
    this.service.ranking(item.id).subscribe({
      next: (ranking) => {
        this.rankings.update((items) => ({ ...items, [item.id]: ranking }));
        this.rankingLoading.set(null);
      },
      error: (error: unknown) => {
        this.rankingLoading.set(null);
        this.error.set(this.message(error));
      },
    });
  }
  public proclaimAutomatically(item: Hackathon): void {
    this.winnerSaving.set(item.id);
    this.service.proclaimAutomatically(item.id).subscribe({
      next: (response) => {
        this.winnerSaving.set(null);
        this.success.set(`${response.message} Vincitore: ${response.winner.teamName}.`);
        this.loadHackathons();
      },
      error: (error: unknown) => {
        this.winnerSaving.set(null);
        this.error.set(this.message(error));
      },
    });
  }
  public proclaim(item: Hackathon, teamId: number, teamName: string): void {
    this.winnerSaving.set(item.id);
    this.service.proclaim(item.id, teamId).subscribe({
      next: (response) => {
        this.winnerSaving.set(null);
        this.success.set(`${response.message} Vincitore: ${teamName}.`);
        this.loadHackathons();
      },
      error: (error: unknown) => {
        this.winnerSaving.set(null);
        this.error.set(this.message(error));
      },
    });
  }

  private loadHackathons(): void {
    this.service.hackathons().subscribe({
      next: (items) => this.hackathons.set(items),
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }

  private value(values: FormData, key: string): string {
    const value = values.get(key);
    return typeof value === 'string' ? value.trim() : '';
  }

  private optionalNumber(values: FormData, key: string): number | undefined {
    const value = this.value(values, key);
    return value ? Number(value) : undefined;
  }

  private message(error: unknown): string {
    return error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
      ? error.error.error
      : 'Impossibile comunicare con il server.';
  }
}
