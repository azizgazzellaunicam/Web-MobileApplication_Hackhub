import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HackathonsList } from './hackathons-list.component';

describe('HackathonsList', () => {
  it('moves a successfully registered hackathon into the registered list', async () => {
    await TestBed.configureTestingModule({
      imports: [HackathonsList],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(HackathonsList);
    fixture.detectChanges();

    http.expectOne('/api/hackathons').flush([{
      id: 12,
      name: 'Hackathon aperto',
      regulation: 'Regolamento',
      registration_deadline: '2027-01-01T23:59:00Z',
      start_date: '2027-01-02T09:00:00Z',
      end_date: '2027-01-04T18:00:00Z',
      location: 'Roma',
      prize: 500,
      max_team_size: 5,
      status: 'ISCRIZIONI_APERTE',
      status_override: null,
      is_registered: false,
      assigned_role: null,
    }]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    const registration = http.expectOne('/api/hackathons/12/registrations');
    registration.flush({ message: 'Team iscritto correttamente.' });
    fixture.detectChanges();

    expect(fixture.componentInstance.registeredHackathons().map((item) => item.id)).toEqual([12]);
    expect(fixture.componentInstance.otherHackathons()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Già iscritto');
    expect(fixture.nativeElement.textContent).toContain('Team iscritto correttamente.');
    http.verify();
  });
});
