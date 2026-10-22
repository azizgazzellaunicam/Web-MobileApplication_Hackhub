import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Hackathon } from '../../hackathons/data/hackathon.model';

export interface StaffSubmission {
  id: number;
  content: string;
  team_name: string;
  hackathon_id: number;
}

export interface SupportRequest {
  id: number;
  team_name: string;
  hackathon_name: string;
  topic: string;
  description: string;
  open: number;
}

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl;
  public assigned(): Observable<Hackathon[]> { return this.http.get<Hackathon[]>(`${this.url}/hackathons/assigned`); }
  public evaluation(): Observable<Hackathon[]> { return this.http.get<Hackathon[]>(`${this.url}/hackathons/evaluation`); }
  public submissions(hackathonId: number): Observable<StaffSubmission[]> {
    return this.http.get<StaffSubmission[]>(`${this.url}/hackathons/${hackathonId}/submissions`);
  }
  public evaluate(submissionId: number, score: number, comment: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.url}/submissions/${submissionId}/evaluations`, { score, comment });
  }
  public support(): Observable<SupportRequest[]> {
    return this.http.get<SupportRequest[]>(`${this.url}/support-requests/open`);
  }
  public call(requestId: number, scheduledAt: string): Observable<{ link: string }> {
    return this.http.post<{ link: string }>(`${this.url}/support-requests/${requestId}/calls`, { scheduledAt });
  }
  public close(requestId: number): Observable<void> {
    return this.http.post<void>(`${this.url}/support-requests/${requestId}/close`, {});
  }
}
