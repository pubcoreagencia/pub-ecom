import nock from 'nock';
import assert from 'node:assert';
import { AsaasProvider } from '../../../../src/services/payment_hub/providers/asaas_provider';
import { CredentialCipher } from '../../../../src/lib/crypto/credentials';

function mockConnection(env: 'SANDBOX' | 'PRODUCTION') {
  const cipher = new CredentialCipher();
  const encrypted = cipher.encrypt({ apiKey: 'TEST_KEY' });
  return {
    id: 'conn-id',
    environment: env,
    encrypted_credentials: encrypted,
  } as any;
}

async function runTests() {
  // Reconcile hit
  {
    const conn = mockConnection('SANDBOX');
    const provider = new AsaasProvider(conn);
    const externalRef = 'pub_customer:123';
    nock('https://api-sandbox.asaas.com')
      .get('/v3/customers')
      .query({ externalReference: externalRef })
      .reply(200, [{ id: 'customer-asaas-id' }]);
    const result = await (provider as any).reconcileExternalCustomer({
      customerId: '123',
      connectionId: 'conn-id',
      normalizedCustomer: { name: 'John', email: 'john@example.com' }
    });
    assert.strictEqual(result, 'customer-asaas-id', 'reconcile hit');
  }

  // Reconcile miss
  {
    const conn = mockConnection('SANDBOX');
    const provider = new AsaasProvider(conn);
    const externalRef = 'pub_customer:999';
    nock('https://api-sandbox.asaas.com')
      .get('/v3/customers')
      .query({ externalReference: externalRef })
      .reply(200, []);
    const result = await (provider as any).reconcileExternalCustomer({
      customerId: '999',
      connectionId: 'conn-id',
      normalizedCustomer: { name: 'Jane', email: 'jane@example.com' }
    });
    assert.strictEqual(result, null, 'reconcile miss');
  }

  // Create external customer
  {
    const conn = mockConnection('SANDBOX');
    const provider = new AsaasProvider(conn);
    nock('https://api-sandbox.asaas.com')
      .post('/v3/customers', (body) => {
        return body.name === 'Alice' && body.email === 'alice@example.com' && body.externalReference === 'pub_customer:alice@example.com';
      })
      .reply(200, { id: 'new-cust-id' });
    const result = await (provider as any).createExternalCustomer({
      connectionId: 'conn-id',
      normalizedCustomer: { name: 'Alice', email: 'alice@example.com' }
    });
    assert.deepStrictEqual(result, { externalId: 'new-cust-id' }, 'create external');
  }

  // Create payment and PIX QR
  {
    const conn = mockConnection('SANDBOX');
    const provider = new AsaasProvider(conn);
    const paymentId = 'pay-123';
    nock('https://api-sandbox.asaas.com')
      .post('/v3/payments')
      .reply(200, { id: paymentId, status: 'PENDING' });
    nock('https://api-sandbox.asaas.com')
      .get(`/v3/payments/${paymentId}/pixQrCode`)
      .reply(200, { encodedImage: 'img', payload: 'payload', expirationDate: '2026-12-31' });
    const input = { externalCustomerId: 'cust-asaas-id', amount: 15000, orderNumber: 'ORD-1', currency: 'BRL', method: 'PIX' } as any;
    const result = await provider.createPayment(input, {} as any);
    assert.strictEqual(result.providerPaymentId, paymentId, 'payment id');
    assert.deepStrictEqual(result.pixDetails, { qrCode: 'img', payload: 'payload', expiresAt: '2026-12-31' }, 'qr details');
  }

  // Get payment status mapping
  {
    const conn = mockConnection('SANDBOX');
    const provider = new AsaasProvider(conn);
    const paymentId = 'pay-456';
    nock('https://api-sandbox.asaas.com')
      .get(`/v3/payments/${paymentId}`)
      .reply(200, { status: 'CONFIRMED', value: 200.5, gatewayFee: 5.5, netValue: 195.0, paymentDate: '2026-01-01' });
    const result = await provider.getPayment(paymentId, {} as any);
    assert.strictEqual(result.status, 'PAID', 'status mapping');
    assert.strictEqual(result.amount, 20050, 'amount conversion');
    assert.strictEqual(result.fee, 550, 'fee conversion');
    assert.strictEqual(result.netAmount, 19500, 'net amount conversion');
  }

  // Verify webhook
  {
    const conn = mockConnection('SANDBOX');
    const provider = new AsaasProvider(conn);
    const headers = { 'asaas-access-token': 'secret-token' } as any;
    const rawBody = JSON.stringify({ id: 'evt-1', event: 'payment.received' });
    const res = await provider.verifyWebhook(headers, {} as any, rawBody, 'secret-token');
    assert.strictEqual(res.isValid, true, 'webhook valid');
    assert.strictEqual(res.eventDedupKey, 'payment.received:evt-1', 'dedup key');
  }

  console.log('All AsaasProvider tests passed');
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});

function mockConnection(env: 'SANDBOX' | 'PRODUCTION') {
  const cipher = new CredentialCipher();
  const encrypted = cipher.encrypt({ apiKey: 'TEST_KEY' });
  return {
    id: 'conn-id',
    environment: env,
    encrypted_credentials: encrypted,
  } as any;
}

describe('AsaasProvider', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  test('reconcileExternalCustomer hit', async () => {
    const conn = mockConnection('SANDBOX');
    const provider = new AsaasProvider(conn);
    const externalRef = 'pub_customer:123';
    nock('https://api-sandbox.asaas.com')
      .get('/v3/customers')
      .query({ externalReference: externalRef })
      .reply(200, [{ id: 'customer-asaas-id' }]);
    const result = await (provider as any).reconcileExternalCustomer({
      customerId: '123',
      connectionId: 'conn-id',
      normalizedCustomer: { name: 'John', email: 'john@example.com' }
    });
    expect(result).toBe('customer-asaas-id');
  });

  test('reconcileExternalCustomer miss', async () => {
    const conn = mockConnection('SANDBOX');
    const provider = new AsaasProvider(conn);
    const externalRef = 'pub_customer:999';
    nock('https://api-sandbox.asaas.com')
      .get('/v3/customers')
      .query({ externalReference: externalRef })
      .reply(200, []);
    const result = await (provider as any).reconcileExternalCustomer({
      customerId: '999',
      connectionId: 'conn-id',
      normalizedCustomer: { name: 'Jane', email: 'jane@example.com' }
    });
    expect(result).toBeNull();
  });

  test('createExternalCustomer success', async () => {
    const conn = mockConnection('SANDBOX');
    const provider = new AsaasProvider(conn);
    nock('https://api-sandbox.asaas.com')
      .post('/v3/customers', (body) => {
        return body.name === 'Alice' && body.email === 'alice@example.com' && body.externalReference === 'pub_customer:alice@example.com';
      })
      .reply(200, { id: 'new-cust-id' });
    const result = await (provider as any).createExternalCustomer({
      connectionId: 'conn-id',
      normalizedCustomer: { name: 'Alice', email: 'alice@example.com' }
    });
    expect(result).toEqual({ externalId: 'new-cust-id' });
  });

  test('createPayment and retrieve PIX QR', async () => {
    const conn = mockConnection('SANDBOX');
    const provider = new AsaasProvider(conn);
    const paymentId = 'pay-123';
    nock('https://api-sandbox.asaas.com')
      .post('/v3/payments')
      .reply(200, { id: paymentId, status: 'PENDING' });
    nock('https://api-sandbox.asaas.com')
      .get(`/v3/payments/${paymentId}/pixQrCode`)
      .reply(200, { encodedImage: 'img', payload: 'payload', expirationDate: '2026-12-31' });
    const input = { externalCustomerId: 'cust-asaas-id', amount: 15000, orderNumber: 'ORD-1', currency: 'BRL', method: 'PIX' } as any;
    const result = await provider.createPayment(input, {} as any);
    expect(result.providerPaymentId).toBe(paymentId);
    expect(result.pixDetails).toEqual({ qrCode: 'img', payload: 'payload', expiresAt: '2026-12-31' });
  });

  test('getPayment maps status correctly', async () => {
    const conn = mockConnection('SANDBOX');
    const provider = new AsaasProvider(conn);
    const paymentId = 'pay-456';
    nock('https://api-sandbox.asaas.com')
      .get(`/v3/payments/${paymentId}`)
      .reply(200, { status: 'CONFIRMED', value: 200.5, gatewayFee: 5.5, netValue: 195.0, paymentDate: '2026-01-01' });
    const result = await provider.getPayment(paymentId, {} as any);
    expect(result.status).toBe('PAID');
    expect(result.amount).toBe(20050);
    expect(result.fee).toBe(550);
    expect(result.netAmount).toBe(19500);
  });

  test('verifyWebhook validates token', async () => {
    const conn = mockConnection('SANDBOX');
    const provider = new AsaasProvider(conn);
    const headers = { 'asaas-access-token': 'secret-token' } as any;
    const rawBody = JSON.stringify({ id: 'evt-1', event: 'payment.received' });
    const res = await provider.verifyWebhook(headers, {} as any, rawBody, 'secret-token');
    expect(res.isValid).toBe(true);
    expect(res.eventDedupKey).toBe('payment.received:evt-1');
  });
});
