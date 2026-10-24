import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guard';
import { Login } from './features/auth/login/login.component';
import { Profile } from './features/auth/profile/profile.component';
import { HackathonsList } from './features/hackathons/list/hackathons-list.component';
import { Organizer } from './features/organizer/organizer.component';
import { Workspace } from './features/workspace/workspace.component';
import { Staff } from './features/staff/staff.component';
import { Notifications } from './features/notifications/notifications.component';

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [guestGuard] },
  { path: '', component: HackathonsList, canActivate: [authGuard], pathMatch: 'full' },
  { path: 'profilo', component: Profile, canActivate: [authGuard] },
  { path: 'notifiche', component: Notifications, canActivate: [authGuard] },
  { path: 'notifications', component: Notifications, canActivate: [authGuard] },
  { path: 'spazio', component: Workspace, canActivate: [authGuard] },
  { path: 'organizzatore', component: Organizer, canActivate: [authGuard, roleGuard(['ORGANIZER'])] },
  { path: 'staff', component: Staff, canActivate: [authGuard, roleGuard(['JUDGE', 'MENTOR'])] },
  { path: '**', redirectTo: 'login' },
];
