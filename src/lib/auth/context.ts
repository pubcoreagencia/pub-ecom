export type AuthenticationState = 'UNAUTHENTICATED' | 'AUTHENTICATED';

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface AuthContext {
  state: AuthenticationState;
  userId?: string;
  session?: AuthSession;
}

export function createUnauthenticatedContext(): AuthContext {
  return {
    state: 'UNAUTHENTICATED'
  };
}

export function createAuthenticatedContext(userId: string, session: AuthSession): AuthContext {
  return {
    state: 'AUTHENTICATED',
    userId,
    session
  };
}
