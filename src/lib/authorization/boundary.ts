import type { AuthContext } from '../auth/context';
import type { RoleContext, ApplicationRole } from '../context/role';
import type { TenantContext } from '../context/tenant';
import { AppError } from '../errors/model';

// Application authorization acts as an early rejection layer,
// not a replacement for DB RLS.

export interface AuthorizationBoundary {
  auth: AuthContext;
  role?: RoleContext;
  tenant?: TenantContext;
}

export function requireAuthenticated(boundary: AuthorizationBoundary): void {
  if (boundary.auth.state !== 'AUTHENTICATED' || !boundary.auth.userId) {
    throw new AppError({
      code: 'AUTHENTICATION_ERROR',
      publicMessage: 'Authentication required to perform this action.',
      internalMessage: 'Missing valid auth context.',
      httpStatus: 401,
      retryable: false
    });
  }
}

export function requireRole(boundary: AuthorizationBoundary, allowedRoles: ApplicationRole[]): void {
  requireAuthenticated(boundary);
  
  if (!boundary.role || !allowedRoles.includes(boundary.role.role)) {
    throw new AppError({
      code: 'AUTHORIZATION_ERROR',
      publicMessage: 'You do not have permission to access this resource.',
      internalMessage: `Role ${boundary.role?.role} not in allowed roles: ${allowedRoles.join(',')}`,
      httpStatus: 403,
      retryable: false
    });
  }
}

export function requireOrganizationAccess(boundary: AuthorizationBoundary, organizationId: string): void {
  requireAuthenticated(boundary);
  
  if (!boundary.tenant || boundary.tenant.organizationId !== organizationId) {
    throw new AppError({
      code: 'TENANT_ACCESS_ERROR',
      publicMessage: 'Access denied for this organization.',
      internalMessage: `Tenant boundary mismatch. Expected ${organizationId}, got ${boundary.tenant?.organizationId}`,
      httpStatus: 403,
      retryable: false
    });
  }
}
