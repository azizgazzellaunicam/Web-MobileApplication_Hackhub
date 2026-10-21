export interface Hackathon {
  id: number;
  name: string;
  regulation: string;
  registration_deadline: string;
  start_date: string;
  end_date: string;
  location: string;
  prize: number;
  max_team_size: number;
  status: 'ISCRIZIONI_APERTE' | 'IN_CORSO' | 'VALUTAZIONE' | 'CONCLUSO';
  status_override: HackathonStatus | null;
  is_registered: boolean;
  assigned_role: 'JUDGE' | 'MENTOR' | null;
  winner_team_id?: number | null;
}

export type HackathonStatus = Hackathon['status'];
