export interface NormalizedPaymentInput {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: 'BRL';
  customer: {
    name: string;
    email: string;
    document?: string;
  };
  method: 'PIX' | 'CREDIT_CARD';
  externalCustomerId?: string;
  cardToken?: string;
  installments?: number;
  idempotencyKey: string;
}

export interface NormalizedPaymentResult {
  providerPaymentId: string;
  status: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED';
  method: 'PIX' | 'CREDIT_CARD';
  amount: number;
  currency: 'BRL';
  fee?: number;
  netAmount?: number;
  pixDetails?: {
    qrCode: string;
    qrCodeUrl?: string;
    expiresAt: string;
  };
  cardDetails?: {
    brand?: string;
    last4?: string;
    installments?: number;
  };
  rawResponse?: Record<string, any>;
}

export interface NormalizedPaymentStatus {
  status: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'CHARGEBACK';
  amount: number;
  currency: string;
  fee?: number;
  netAmount?: number;
  dateApproved?: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  eventDedupKey: string;
  resourceId: string;
  eventType: string;
}

export type GatewayCredentials = Record<string, unknown>;

export interface ExternalCustomerCapability {
  /**
   * Attempt to find an existing external customer ID based on internal data.
   * Return the external ID or `null` if not found.
   */
  reconcileExternalCustomer?(params: {
    customerId: string;
    connectionId: string;
    normalizedCustomer: { name: string; email: string; document?: string };
  }, creds: GatewayCredentials): Promise<string | null>;

  /**
   * Create a new external customer and return its identifier.
   */
  createExternalCustomer(params: {
    customerId: string;
    connectionId: string;
    normalizedCustomer: { name: string; email: string; document?: string };
    idempotencyKey?: string;
  }, creds: GatewayCredentials): Promise<{ externalId: string; metadata?: Record<string, unknown> }>;
}

export interface PaymentProvider {
  readonly providerId: string;
  createPayment(input: NormalizedPaymentInput, creds: GatewayCredentials): Promise<NormalizedPaymentResult>;
  getPayment(providerPaymentId: string, creds: GatewayCredentials): Promise<NormalizedPaymentStatus>;
  verifyWebhook(headers: Record<string, string>, rawBody: string, secret: string): Promise<WebhookVerificationResult>;
  normalizeStatus(providerStatus: string): 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'CHARGEBACK';
  capabilities?: ExternalCustomerCapability;
}
