export interface RequestContext {
  requestId: string;
  correlationId: string;
  userId?: string;
  organizationId?: string;
  storeId?: string;
  customerId?: string;
  authenticated: boolean;
}

export function createRequestContext(
  requestId: string,
  correlationId: string,
  opts?: Partial<Omit<RequestContext, 'requestId' | 'correlationId'>>
): RequestContext {
  return {
    requestId,
    correlationId,
    userId: opts?.userId,
    organizationId: opts?.organizationId,
    storeId: opts?.storeId,
    customerId: opts?.customerId,
    authenticated: opts?.authenticated ?? false,
  };
}
