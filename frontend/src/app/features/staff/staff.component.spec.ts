import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Auth } from '../../core/auth/auth.service';
import { Staff } from './staff.component';

describe('Staff', () => {
  it('loads all assigned hackathons for a judge, including those not yet in evaluation', async () => {
    await TestBed.configureTestingModule({
      imports: [Staff],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const auth = TestBed.inject(Auth);
    auth.role.set('JUDGE');
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Staff);
    fixture.detectChanges();

    const assigned = http.expectOne('/api/hackathons/assigned');
    const hackathon = {
      id: 42,
      name: 'Hackathon assegnato',
      regulation: 'Test',
      registration_deadline: '2027-01-01T23:59:00Z',
      start_date: '2027-01-02T09:00:00Z',
      end_date: '2027-01-04T18:00:00Z',
      location: 'Roma',
      prize: 500,
      max_team_size: 5,
      status: 'ISCRIZIONI_APERTE' as const,
      status_override: null,
      is_registered: false,
      assigned_role: 'JUDGE' as const,
    };
    assigned.flush([hackathon]);

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Hackathon assegnato');
    expect(fixture.nativeElement.textContent).toContain('Le valutazioni saranno disponibili');
    expect(fixture.componentInstance.canEvaluateSelectedHackathon()).toBe(false);
    http.expectNone('/api/hackathons/42/submissions');
    http.expectNone('/api/hackathons/evaluation');

    fixture.componentInstance.hackathons.set([{ ...hackathon, status: 'VALUTAZIONE' }]);
    fixture.componentInstance.select(42);
    http.expectOne('/api/hackathons/42/submissions').flush([]);
    expect(fixture.componentInstance.canEvaluateSelectedHackathon()).toBe(true);
    http.verify();
  });

  it('lets a mentor choose a registered team and send a report', async () => {
    await TestBed.configureTestingModule({
      imports: [Staff],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    TestBed.inject(Auth).role.set('MENTOR');
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Staff);
    fixture.detectChanges();
    http.expectOne('/api/hackathons/assigned').flush([]);
    http.expectOne('/api/support-requests/open').flush([]);

    fixture.componentInstance.select(7);
    http.expectOne('/api/hackathons/7/teams').flush([{ id: 3, name: 'Team Alpha' }]);
    fixture.detectChanges();

    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    (form.elements.namedItem('teamId') as HTMLSelectElement).value = '3';
    (form.elements.namedItem('description') as HTMLTextAreaElement).value = 'Problema rilevato';
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    const report = http.expectOne('/api/support-requests/report');
    expect(report.request.body).toEqual({ hackathonId: 7, teamId: 3, description: 'Problema rilevato' });
    report.flush({});
    http.expectOne('/api/support-requests/open').flush([]);
    http.verify();
  });
});
