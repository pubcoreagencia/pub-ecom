import {
  PaymentProvider,
  NormalizedPaymentInput,
  NormalizedPaymentResult,
  NormalizedPaymentStatus,
  WebhookVerificationResult,
  ExternalCustomerCapability,
  GatewayCredentials
} from '../types';
import { AsaasCredentials } from './asaas/types';

/**
 * Deterministic helper to format customer external reference for Asaas.
 */
export function getExternalReference(customerId: string): string {
  return `pub_customer:${customerId}`;
}

/**
 * Asaas PIX Sandbox / Production Provider.
 * Stateless with respect to credentials (credentials are passed per-call).
 */
export class AsaasProvider implements PaymentProvider {
  readonly providerId = 'asaas';
  capabilities: ExternalCustomerCapability;

  constructor(private options?: { environment?: 'SANDBOX' | 'PRODUCTION' }) {
    this.capabilities = {
      reconcileExternalCustomer: this.reconcileExternalCustomer.bind(this),
      createExternalCustomer: this.createExternalCustomer.bind(this)
    };
  }

  private getBaseUrl(creds?: GatewayCredentials): string {
    const env = (creds?.environment as string) || this.options?.environment || process.env.APP_ENVIRONMENT || 'SANDBOX';
    return env === 'PRODUCTION' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
  }

  private validateCredentials(creds: GatewayCredentials): AsaasCredentials {
    if (!creds || typeof creds !== 'object' || typeof (creds as any).apiKey !== 'string' || !(creds as any).apiKey.trim()) {
      throw new Error('Invalid Asaas credentials: apiKey is required');
    }
    return { apiKey: (creds as any).apiKey.trim() };
  }

  private authHeaders(apiKey: string): Record<string, string> {
    return {
      'access_token': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'PUB-Ecom'
    };
  }

  /**
   * Create a PIX payment. `input.externalCustomerId` must be provided (resolved via capabilities).
   */
  async createPayment(input: NormalizedPaymentInput, creds: GatewayCredentials): Promise<NormalizedPaymentResult> {
    const validated = this.validateCredentials(creds);
    if (!input.externalCustomerId) {
      throw new Error('External customer ID is required for Asaas payments');
    }
    const url = `${this.getBaseUrl(creds)}/payments`;
    const body = {
      customer: input.externalCustomerId,
      billingType: 'PIX',
      value: input.amount / 100,
      dueDate: new Date().toISOString().split('T')[0],
      comment: `Order ${input.orderNumber}`
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders(validated.apiKey),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Asaas createPayment failed: ${res.status} ${err}`);
    }
    const data: any = await res.json();
    const providerPaymentId = data.id;

    // Retrieve QR code details
    const qrRes = await fetch(`${this.getBaseUrl(creds)}/payments/${providerPaymentId}/pixQrCode`, {
      method: 'GET',
      headers: this.authHeaders(validated.apiKey)
    });
    if (!qrRes.ok) {
      const qrErr = await qrRes.text();
      throw new Error(`Asaas pixQrCode failed: ${qrRes.status} ${qrErr}`);
    }
    const qrData: any = await qrRes.json();
    const pixDetails = {
      qrCode: qrData.encodedImage || '',
      qrCodeUrl: qrData.payload || '',
      expiresAt: qrData.expirationDate || ''
    };
    const normalized = this.normalizeStatus(data.status);
    const status: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' =
      normalized === 'PAID' ? 'PAID' : (normalized === 'AUTHORIZED' ? 'AUTHORIZED' : (normalized === 'CANCELLED' ? 'CANCELLED' : (normalized === 'FAILED' ? 'FAILED' : 'PENDING')));
    return {
      providerPaymentId,
      status,
      method: 'PIX',
      amount: input.amount,
      currency: 'BRL',
      pixDetails,
      rawResponse: data
    };
  }

  async getPayment(providerPaymentId: string, creds: GatewayCredentials): Promise<NormalizedPaymentStatus> {
    const validated = this.validateCredentials(creds);
    const url = `${this.getBaseUrl(creds)}/payments/${providerPaymentId}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders(validated.apiKey)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Asaas getPayment failed: ${res.status} ${err}`);
    }
    const data: any = await res.json();
    const status = this.normalizeStatus(data.status);
    return {
      status,
      amount: Math.round(Number(data.value) * 100),
      currency: 'BRL',
      fee: data.gatewayFee != null ? Math.round(Number(data.gatewayFee) * 100) : undefined,
      netAmount: data.netValue != null ? Math.round(Number(data.netValue) * 100) : undefined,
      dateApproved: data.paymentDate || data.confirmedDate
    };
  }

  async verifyWebhook(headers: Record<string, string>, rawBody: string, secret: string): Promise<WebhookVerificationResult> {
    const token = headers['asaas-access-token'] || headers['Asaas-Access-Token'] || '';
    const isValid = Boolean(secret && token === secret);
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = {};
    }
    const paymentObj = payload.payment || {};
    const resourceId = paymentObj.id || payload.id || '';
    const eventType = payload.event || '';
    const eventDedupKey = `${eventType}:${resourceId}`;
    return { isValid, eventDedupKey, resourceId, eventType };
  }

  normalizeStatus(providerStatus: string): 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'CHARGEBACK' {
    switch (providerStatus) {
      case 'RECEIVED':
      case 'CONFIRMED':
        return 'PAID';
      case 'PENDING':
      case 'AWAITING_RISK_ANALYSIS':
        return 'PENDING';
      case 'REFUNDED':
        return 'REFUNDED';
      case 'CANCELLED':
        return 'CANCELLED';
      case 'CHARGEBACK':
      case 'REFUND_REQUESTED':
      case 'CHARGEBACK_REQUESTED':
      case 'CHARGEBACK_DISPUTE':
      case 'AWAITING_CHARGEBACK_REVERSAL':
        return 'CHARGEBACK';
      default:
        return 'FAILED';
    }
  }

  // --- External Customer Capabilities ---
  async reconcileExternalCustomer(
    params: {
      customerId: string;
      connectionId: string;
      normalizedCustomer: { name: string; email: string; document?: string };
    },
    creds: GatewayCredentials
  ): Promise<string | null> {
    const validated = this.validateCredentials(creds);
    const extRef = getExternalReference(params.customerId);
    const url = `${this.getBaseUrl(creds)}/customers?externalReference=${encodeURIComponent(extRef)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders(validated.apiKey)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Asaas reconcileExternalCustomer failed: ${res.status} ${err}`);
    }
    const data: any = await res.json();
    const customerList = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    if (customerList.length === 0) {
      return null;
    }
    if (customerList.length > 1) {
      throw new Error(`Multiple external customers found for reference ${extRef}`);
    }
    const existing = customerList[0];
    if (params.normalizedCustomer.document && (!existing.cpfCnpj || existing.cpfCnpj !== params.normalizedCustomer.document)) {
      const updateRes = await fetch(`${this.getBaseUrl(creds)}/customers/${existing.id}`, {
        method: 'PUT',
        headers: this.authHeaders(validated.apiKey),
        body: JSON.stringify({ cpfCnpj: params.normalizedCustomer.document })
      });
      if (!updateRes.ok) {
        const updateErr = await updateRes.text();
        throw new Error(`Asaas update customer cpfCnpj failed: ${updateRes.status} ${updateErr}`);
      }
    }
    return existing.id ?? null;
  }

  async createExternalCustomer(
    params: {
      customerId: string;
      connectionId: string;
      normalizedCustomer: { name: string; email: string; document?: string };
      idempotencyKey?: string;
    },
    creds: GatewayCredentials
  ): Promise<{ externalId: string; metadata?: Record<string, unknown> }> {
    const validated = this.validateCredentials(creds);
    const extRef = getExternalReference(params.customerId);
    const url = `${this.getBaseUrl(creds)}/customers`;
    const body: Record<string, any> = {
      name: params.normalizedCustomer.name,
      email: params.normalizedCustomer.email,
      externalReference: extRef
    };
    if (params.normalizedCustomer.document) {
      body.cpfCnpj = params.normalizedCustomer.document;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders(validated.apiKey),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Asaas createExternalCustomer failed: ${res.status} ${err}`);
    }
    const data: any = await res.json();
    if (!data?.id) {
      throw new Error('Asaas createExternalCustomer response missing customer ID');
    }
    return { externalId: data.id };
  }
}
