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

export interface PaymentProvider {
  readonly providerId: string;
  createPayment(input: NormalizedPaymentInput, creds: Record<string, any>): Promise<NormalizedPaymentResult>;
  getPayment(providerPaymentId: string, creds: Record<string, any>): Promise<NormalizedPaymentStatus>;
  verifyWebhook(headers: Record<string, string>, rawBody: string, secret: string): Promise<WebhookVerificationResult>;
  normalizeStatus(providerStatus: string): 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'CHARGEBACK';
}
