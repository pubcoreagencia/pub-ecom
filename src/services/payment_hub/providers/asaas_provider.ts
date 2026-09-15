import { PaymentProvider, NormalizedPaymentInput, NormalizedPaymentResult, NormalizedPaymentStatus, WebhookVerificationResult, ExternalCustomerCapability } from '../types';
import { AsaasCredentials } from './asaas/types';
import { CredentialCipher } from '../../../lib/crypto/credentials';

/**
 * Asaas PIX Sandbox Provider
 */
export class AsaasProvider implements PaymentProvider {
  readonly providerId = 'asaas';
  /** Connection row from gateway_connections, used for environment and webhook secret */
  private connection: any;
  private creds: AsaasCredentials;
  capabilities: ExternalCustomerCapability;

  constructor(connection: any) {
    this.connection = connection;
    const cipher = new CredentialCipher();
    this.creds = cipher.decrypt(connection.encrypted_credentials) as AsaasCredentials;
    this.capabilities = {
      reconcileExternalCustomer: this.reconcileExternalCustomer.bind(this),
      createExternalCustomer: this.createExternalCustomer.bind(this)
    };
  }

  private baseUrl(env: string): string {
    return env === 'SANDBOX' ? 'https://api-sandbox.asaas.com/v3' : 'https://api-asaas.com/v3';
  }

  private authHeaders(): Record<string, string> {
    return { 'access-token': this.creds.apiKey, 'Content-Type': 'application/json' };
  }

  /**
   * Create a PIX payment. `input.externalCustomerId` must be provided (resolved via capabilities).
   */
  async createPayment(input: NormalizedPaymentInput, _: AsaasCredentials): Promise<NormalizedPaymentResult> {
    if (!input.externalCustomerId) {
      throw new Error('External customer ID is required for Asaas payments');
    }
    const url = `${this.baseUrl(this.connection.environment)}/payments`;
    const body = {
      customer: input.externalCustomerId,
      billingType: 'PIX',
      value: input.amount / 100,
      dueDate: new Date().toISOString().split('T')[0],
      comment: `Order ${input.orderNumber}`
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Asaas createPayment failed: ${res.status} ${err}`);
    }
    const data = await res.json();
    const providerPaymentId = data.id;
    // Retrieve QR code details
    const qrRes = await fetch(`${this.baseUrl(this.connection.environment)}/payments/${providerPaymentId}/pixQrCode`, {
      method: 'GET',
      headers: this.authHeaders()
    });
    const qrData = await qrRes.json();
    const pixDetails = {
      qrCode: qrData.encodedImage || '',
      payload: qrData.payload || '',
      expiresAt: qrData.expirationDate || ''
    };
    const status = this.normalizeStatus(data.status);
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

  async getPayment(providerPaymentId: string, _: AsaasCredentials): Promise<NormalizedPaymentStatus> {
    const url = `${this.baseUrl(this.connection.environment)}/payments/${providerPaymentId}`;
    const res = await fetch(url, { method: 'GET', headers: this.authHeaders() });
    if (!res.ok) throw new Error('Asaas getPayment failed');
    const data = await res.json();
    const status = this.normalizeStatus(data.status);
    return {
      status,
      amount: Number(data.value) * 100,
      currency: 'BRL',
      fee: data.gatewayFee ? Number(data.gatewayFee) * 100 : undefined,
      netAmount: data.netValue ? Number(data.netValue) * 100 : undefined,
      dateApproved: data.paymentDate
    };
  }

  async verifyWebhook(headers: Record<string, string>, _: any, rawBody: string, secret: string): Promise<WebhookVerificationResult> {
    const token = headers['asaas-access-token'];
    const isValid = token === secret;
    const payload = JSON.parse(rawBody);
    const resourceId = payload.id || '';
    const eventType = payload.event || '';
    const eventDedupKey = `${eventType}:${resourceId}`;
    return { isValid, eventDedupKey, resourceId, eventType };
  }

  normalizeStatus(providerStatus: string): 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'CHARGEBACK' {
    switch (providerStatus) {
      case 'RECEIVED':
      case 'PENDING':
        return 'PENDING';
      case 'CONFIRMED':
        return 'PAID';
      case 'CANCELLED':
        return 'CANCELLED';
      case 'REFUNDED':
        return 'REFUNDED';
      case 'CHARGEBACK':
        return 'CHARGEBACK';
      default:
        return 'FAILED';
    }
  }

  // --- External Customer Capabilities ---
  private async reconcileExternalCustomer(params: {
    customerId: string;
    connectionId: string;
    normalizedCustomer: { name: string; email: string; document?: string };
  }): Promise<string | null> {
    const url = `${this.baseUrl(this.connection.environment)}/customers?externalReference=pub_customer:${params.customerId}`;
    const res = await fetch(url, { method: 'GET', headers: this.authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    if (data.length > 1) throw new Error('Multiple external customers found');
    return data[0].id ?? null;
  }

  private async createExternalCustomer(params: {
    connectionId: string;
    normalizedCustomer: { name: string; email: string; document?: string };
    idempotencyKey?: string;
  }): Promise<{ externalId: string; metadata?: Record<string, unknown> }> {
    const externalReference = `pub_customer:${params.normalizedCustomer.email}`;
    const url = `${this.baseUrl(this.connection.environment)}/customers`;
    const body = {
      name: params.normalizedCustomer.name,
      email: params.normalizedCustomer.email,
      cpfCnpj: params.normalizedCustomer.document,
      externalReference
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Asaas createExternalCustomer failed: ${res.status} ${err}`);
    }
    const data = await res.json();
    return { externalId: data.id };
  }
}
