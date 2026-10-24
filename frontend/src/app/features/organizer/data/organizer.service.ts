import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Hackathon } from '../../hackathons/data/hackathon.model';
import { HackathonStatus } from '../../hackathons/data/hackathon.model';

export interface StaffMember {
  id: number;
  name: string;
  email: string;
  role: 'JUDGE' | 'MENTOR';
}

export interface CreateHackathonRequest {
  name: string;
  regulation: string;
  registrationDeadline: string;
  startDate: string;
  endDate: string;
  location: string;
  prize: number;
  maxTeamSize: number;
  judgeId: number;
  mentorId: number;
}
export type UpdateHackathonRequest = Omit<CreateHackathonRequest, 'judgeId' | 'mentorId'> & {
  judgeId?: number;
  mentorId?: number;
};

export interface RankingEntry {
  teamId: number;
  teamName: string;
  averageScore: number;
}

export interface HackathonRanking {
  entries: RankingEntry[];
  winner: RankingEntry | null;
}

@Injectable({ providedIn: 'root' })
export class OrganizerService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  public staff(): Observable<StaffMember[]> {
    return this.http.get<StaffMember[]>(`${this.apiUrl}/staff`);
  }

  public create(request: CreateHackathonRequest): Observable<Hackathon> {
    return this.http.post<Hackathon>(`${this.apiUrl}/hackathons`, request);
  }
  public hackathons(): Observable<Hackathon[]> {
    return this.http.get<Hackathon[]>(`${this.apiUrl}/hackathons`);
  }
  public updateStatus(id: number, status: HackathonStatus | null): Observable<Hackathon> {
    return this.http.put<Hackathon>(`${this.apiUrl}/hackathons/${id}/status`, { status });
  }
  public update(id: number, request: UpdateHackathonRequest): Observable<Hackathon> {
    return this.http.put<Hackathon>(`${this.apiUrl}/hackathons/${id}`, request);
  }
  public delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/hackathons/${id}`);
  }
  public ranking(id: number): Observable<HackathonRanking> {
    return this.http.get<HackathonRanking>(`${this.apiUrl}/hackathons/${id}/ranking`);
  }
  public proclaimAutomatically(id: number): Observable<{ message: string; winner: RankingEntry }> {
    return this.http.post<{ message: string; winner: RankingEntry }>(`${this.apiUrl}/hackathons/${id}/winner/auto`, {});
  }
  public proclaim(id: number, teamId: number): Observable<{ message: string; teamId: number }> {
    return this.http.post<{ message: string; teamId: number }>(`${this.apiUrl}/hackathons/${id}/winner/${teamId}`, {});
  }
}
