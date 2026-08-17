// Database roles: 'anon', 'authenticated', 'service_role'
// Application roles strictly derived from memberships table and domain functions.

export type ApplicationRole = 
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'FINANCE'
  | 'OPERATOR'
  | 'CUSTOMER'
  | 'GUEST'
  | 'SERVICE_ROLE';

export interface RoleContext {
  role: ApplicationRole;
  isPrivileged: boolean;
}

export function createRoleContext(role: ApplicationRole): RoleContext {
  const privilegedRoles: ApplicationRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'FINANCE', 'OPERATOR', 'SERVICE_ROLE'];
  
  return {
    role,
    isPrivileged: privilegedRoles.includes(role)
  };
}
