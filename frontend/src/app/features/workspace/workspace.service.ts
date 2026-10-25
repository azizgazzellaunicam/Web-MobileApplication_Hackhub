import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Team { id: number; name: string; members: string; can_leave: boolean; }
export interface Invitation { id: number; team_name: string; invited_email: string; status: string; }
export interface Submission { id: number; hackathon_id: number; content: string; hackathon_name: string; team_name: string; submitted_at: string; }
export interface WorkspaceHackathon { id: number; name: string; status: string; is_registered: boolean; is_winner: boolean; }
export interface WinningHackathon { id: number; name: string; winner_team_id: number; prize: number; }

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl;
  public teams(): Observable<Team[]> { return this.http.get<Team[]>(`${this.url}/profile/teams`); }
  public createTeam(name: string): Observable<Team> { return this.http.post<Team>(`${this.url}/teams`, { name }); }
  public leaveTeam(teamId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/teams/${teamId}/membership`);
  }
  public invite(teamId: number, email: string): Observable<Invitation> {
    return this.http.post<Invitation>(`${this.url}/teams/${teamId}/invitations`, { email });
  }
  public invitations(): Observable<Invitation[]> { return this.http.get<Invitation[]>(`${this.url}/invitations`); }
  public decideInvitation(id: number, decision: 'accept' | 'reject'): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.url}/invitations/${id}/${decision}`, {});
  }
  public submissions(): Observable<Submission[]> { return this.http.get<Submission[]>(`${this.url}/submissions/mine`); }
  public hackathons(): Observable<WorkspaceHackathon[]> { return this.http.get<WorkspaceHackathon[]>(`${this.url}/hackathons`); }
  public wins(): Observable<WinningHackathon[]> { return this.http.get<WinningHackathon[]>(`${this.url}/profile/wins`); }
  public submit(hackathonId: number, content: string): Observable<Submission> {
    return this.http.post<Submission>(`${this.url}/hackathons/${hackathonId}/submissions`, { content });
  }
  public updateSubmission(id: number, content: string): Observable<Submission> {
    return this.http.put<Submission>(`${this.url}/submissions/${id}`, { content });
  }
}
