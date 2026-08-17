// Tenant context models the hierarchical ownership represented in the schema.
export interface TenantContext {
  organizationId?: string;
  storeId?: string;
  customerId?: string;
  isResolved: boolean;
}

export function createEmptyTenantContext(): TenantContext {
  return {
    isResolved: false
  };
}

export function resolveTenantContext(
  organizationId?: string,
  storeId?: string,
  customerId?: string
): TenantContext {
  return {
    organizationId,
    storeId,
    customerId,
    isResolved: true
  };
}
