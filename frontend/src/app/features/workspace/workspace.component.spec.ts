import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Workspace } from './workspace.component';

describe('Workspace', () => {
  it('surfaces errors while loading invitations, submissions, or hackathons', async () => {
    await TestBed.configureTestingModule({
      imports: [Workspace],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Workspace);
    fixture.detectChanges();

    http.expectOne('/api/profile/teams').flush([]);
    http.expectOne('/api/invitations').flush(
      { error: 'Inviti non disponibili.' },
      { status: 500, statusText: 'Server Error' },
    );
    http.expectOne('/api/submissions/mine').flush([]);
    http.expectOne('/api/hackathons').flush([]);
    http.expectOne('/api/support-requests/mine').flush([]);

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Inviti non disponibili.');
    http.verify();
  });

  it('lets a team member create a support request for an ongoing hackathon', async () => {
    await TestBed.configureTestingModule({
      imports: [Workspace],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Workspace);
    fixture.detectChanges();
    http.expectOne('/api/profile/teams').flush([{ id: 5, name: 'Alpha', members: 'Mario', can_leave: false }]);
    http.expectOne('/api/invitations').flush([]);
    http.expectOne('/api/submissions/mine').flush([]);
    http.expectOne('/api/hackathons').flush([{ id: 9, name: 'Live', status: 'IN_CORSO', is_registered: true, is_winner: false }]);
    http.expectOne('/api/support-requests/mine').flush([]);
    fixture.detectChanges();

    const form: HTMLFormElement = Array.from<HTMLFormElement>(fixture.nativeElement.querySelectorAll('form'))
      .find((item) => item.elements.namedItem('topic'))!;
    (form.elements.namedItem('hackathonId') as HTMLSelectElement).value = '9';
    (form.elements.namedItem('topic') as HTMLInputElement).value = 'Bug';
    (form.elements.namedItem('description') as HTMLTextAreaElement).value = 'Non parte';
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    const created = http.expectOne('/api/support-requests');
    expect(created.request.body).toEqual({ hackathonId: 9, teamId: 5, topic: 'Bug', description: 'Non parte', priority: 'MEDIA' });
    created.flush({});
    http.match(() => true).forEach((pending) => pending.flush([]));
  });
});
