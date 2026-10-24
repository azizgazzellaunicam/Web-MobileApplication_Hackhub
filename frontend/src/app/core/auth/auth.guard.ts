import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth.service';
import { UserRole } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return allowedRoles.includes(auth.role())
    ? true
    : router.createUrlTree(['/']);
};
