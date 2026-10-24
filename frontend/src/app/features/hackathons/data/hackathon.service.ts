import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Hackathon } from './hackathon.model';

@Injectable({ providedIn: 'root' })
export class HackathonService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/hackathons`;

  public list(): Observable<Hackathon[]> { return this.http.get<Hackathon[]>(this.url); }
  public register(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.url}/${id}/registrations`, {});
  }
}
