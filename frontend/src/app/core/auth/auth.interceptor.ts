import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { Auth } from './auth.service';

function isAuthenticationEndpoint(url: string): boolean {
  return /\/auth\/(login|register|refresh|logout)$/.test(url);
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const authenticatedRequest = request.clone({ withCredentials: true });

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        isAuthenticationEndpoint(request.url)
      ) {
        return throwError(() => error);
      }

      return auth.refreshSession().pipe(
        switchMap((refreshed) => {
          if (!refreshed) return throwError(() => error);
          return next(authenticatedRequest);
        }),
        catchError((refreshError: unknown) => {
          auth.clearSession();
          void router.navigateByUrl('/login');
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
