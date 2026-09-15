// tests/services/payment_hub/providers/asaas_sandbox.test.ts
import assert from 'node:assert';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../../../types/supabase';
import { CredentialCipher } from '../../../../src/lib/crypto/credentials';
import { AsaasProvider, getExternalReference } from '../../../../src/services/payment_hub/providers/asaas_provider';

function generateTestCPF(): string {
  const rnd = (n: number) => Math.floor(Math.random() * n);
  const d = Array.from({ length: 9 }, () => rnd(10));
  const calcDigit = (slice: number[]) => {
    const sum = slice.reduce((acc, val, idx) => acc + val * (slice.length + 1 - idx), 0);
    const rem = (sum * 10) % 11;
    return rem === 10 ? 0 : rem;
  };
  const d1 = calcDigit(d);
  const d2 = calcDigit([...d, d1]);
  return [...d, d1, d2].join('');
}

async function main() {
  console.log('== ASAAS SANDBOX REAL OUTBOUND RUNNER ==');

  const supabaseUrl = 'http://127.0.0.1:54321';
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!serviceRoleKey) {
    try {
      const { execSync } = require('child_process');
      const statusStr = execSync('npx supabase status -o json', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      const jsonStr = statusStr.substring(statusStr.indexOf('{'));
      const status = JSON.parse(jsonStr);
      serviceRoleKey = status.SERVICE_ROLE_KEY;
    } catch {
      // Supabase CLI not available or local not running
    }
  }

  if (!serviceRoleKey) {
    console.log('[SANDBOX] Supabase service role key not available.');
    console.log('ASAAS API KEY: MISSING');
    console.log('BLOCKED: ASAAS SANDBOX CONNECTION MISSING');
    console.log('SANDBOX TEST: NOT RUN');
    console.log('REAL ASAAS CALLS: NO');
    process.exit(0);
  }

  const client = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const cipher = new CredentialCipher();

  // Ensure 'asaas' exists in gateway_providers
  await client.from('gateway_providers').upsert({
    id: 'asaas',
    display_name: 'Asaas Provider',
    is_active: true
  });

  // 1. Connection lookup / sync with env key if provided
  let conn: any = null;
  const rawEnvKey = (process.env.ASAAS_SANDBOX_API_KEY || process.env.ASAAS_API_KEY || '').trim();

  if (rawEnvKey && rawEnvKey !== 'TEST_KEY' && rawEnvKey !== 'ASAAS_TEST_KEY' && rawEnvKey !== 'INTEGRATION_KEY_123') {
    const encrypted = cipher.encrypt({ apiKey: rawEnvKey });
    const { data: existingConn } = await client
      .from('gateway_connections')
      .select('id')
      .eq('provider_id', 'asaas')
      .eq('environment', 'SANDBOX')
      .limit(1)
      .maybeSingle();

    if (existingConn) {
      const { data: updatedConn } = await client
        .from('gateway_connections')
        .update({
          status: 'ACTIVE',
          encrypted_credentials: encrypted,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConn.id)
        .select()
        .single();
      conn = updatedConn;
    } else {
      const { data: newConn, error: insertErr } = await client
        .from('gateway_connections')
        .insert({
          organization_id: null,
          store_id: null,
          provider_id: 'asaas',
          environment: 'SANDBOX',
          is_global_default: true,
          status: 'ACTIVE',
          encrypted_credentials: encrypted,
          public_key: 'sandbox'
        })
        .select()
        .single();
      if (insertErr) {
        console.error(`[SANDBOX] Error registering connection: ${insertErr.message}`);
      } else {
        conn = newConn;
      }
    }
  }

  if (!conn) {
    const { data: activeConn } = await client
      .from('gateway_connections')
      .select('*')
      .eq('provider_id', 'asaas')
      .eq('environment', 'SANDBOX')
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle();
    conn = activeConn;
  }

  if (!conn || !conn.encrypted_credentials) {
    console.log('[SANDBOX] No active Asaas sandbox connection found in gateway_connections.');
    console.log('ASAAS API KEY: MISSING');
    console.log('BLOCKED: ASAAS SANDBOX CONNECTION MISSING');
    console.log('SANDBOX TEST: NOT RUN');
    console.log('REAL ASAAS CALLS: NO');
    process.exit(0);
  }

  // 2. Credential loading via CredentialCipher
  let decryptedCreds: any = null;
  try {
    decryptedCreds = cipher.decrypt(conn.encrypted_credentials);
  } catch (err: any) {
    console.log('[SANDBOX] Failed to decrypt connection credentials.');
    console.log('ASAAS API KEY: MISSING');
    console.log('BLOCKED: ASAAS SANDBOX CONNECTION MISSING');
    console.log('SANDBOX TEST: NOT RUN');
    console.log('REAL ASAAS CALLS: NO');
    process.exit(0);
  }

  const apiKey = decryptedCreds?.apiKey;
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim() || apiKey === 'TEST_KEY' || apiKey === 'ASAAS_TEST_KEY' || apiKey === 'INTEGRATION_KEY_123') {
    console.log('[SANDBOX] Connection credentials contain placeholder or empty apiKey.');
    console.log('ASAAS API KEY: MISSING');
    console.log('BLOCKED: ASAAS SANDBOX CONNECTION MISSING');
    console.log('SANDBOX TEST: NOT RUN');
    console.log('REAL ASAAS CALLS: NO');
    process.exit(0);
  }

  console.log('ASAAS API KEY: PRESENT');
  console.log('CONNECTION: ACTIVE (SANDBOX)');

  if (rawEnvKey) {
    const envHash = crypto.createHash('sha256').update(rawEnvKey).digest('hex');
    const storedHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    console.log(`[DIAGNOSTIC] ENV KEY SHA-256: ${envHash.substring(0, 16)}... (length: ${rawEnvKey.length})`);
    console.log(`[DIAGNOSTIC] STORED KEY SHA-256: ${storedHash.substring(0, 16)}... (length: ${apiKey.length})`);
    console.log(`[DIAGNOSTIC] KEY SYNC: ${envHash === storedHash ? 'MATCH' : 'MISMATCH'}`);
    console.log(`[DIAGNOSTIC] KEY PREFIX: ${apiKey.substring(0, 6)}...`);
  } else {
    const storedHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    console.log(`[DIAGNOSTIC] STORED KEY SHA-256: ${storedHash.substring(0, 16)}... (length: ${apiKey.length})`);
    console.log(`[DIAGNOSTIC] KEY PREFIX: ${apiKey.substring(0, 6)}...`);
  }

  // 3. Initialize stateless AsaasProvider
  const provider = new AsaasProvider({ environment: 'SANDBOX' });
  const creds = { apiKey, environment: 'SANDBOX' };

  // 4. Setup disposable customer fixture with document
  const rawDocument = (process.env.ASAAS_SANDBOX_CUSTOMER_DOCUMENT || process.env.ASAAS_CUSTOMER_DOCUMENT || '').trim().replace(/\D/g, '');
  let customerDocument: string;
  if (rawDocument) {
    customerDocument = rawDocument;
    const docType = rawDocument.length === 11 ? 'CPF' : (rawDocument.length === 14 ? 'CNPJ' : 'UNKNOWN');
    console.log('CUSTOMER DOCUMENT: PRESENT');
    console.log(`DOCUMENT TYPE: ${docType}`);
    console.log(`DOCUMENT DIGITS: ${rawDocument.length}`);
  } else {
    customerDocument = generateTestCPF();
    console.log('CUSTOMER DOCUMENT: GENERATED TEST CPF');
    console.log('DOCUMENT TYPE: CPF');
    console.log(`DOCUMENT DIGITS: ${customerDocument.length}`);
  }

  const disposableCustomerId = process.env.ASAAS_SANDBOX_CUSTOMER_ID || '5a56ef2a-4ec7-4e79-962d-d42e843dcaa9';
  const disposableEmail = `sandbox_tester_${disposableCustomerId.substring(0, 8)}@pub.test`;
  const normalizedCustomer = {
    name: 'Sandbox Outbound Tester',
    email: disposableEmail,
    document: customerDocument
  };
  const extRef = getExternalReference(disposableCustomerId);

  let asaasCustomerId: string | null = null;
  let customerResult = '';

  try {
    // 5. Customer Reconcile or Create Flow
    console.log('[STEP 1] Reconciling external customer...');
    const reconciled = await provider.reconcileExternalCustomer(
      {
        customerId: disposableCustomerId,
        connectionId: conn.id,
        normalizedCustomer
      },
      creds
    );

    if (reconciled) {
      asaasCustomerId = reconciled;
      customerResult = 'EXISTING CUSTOMER REUSED';
    } else {
      console.log('[STEP 1] Not found by externalReference. Creating new external customer...');
      const created = await provider.createExternalCustomer(
        {
          customerId: disposableCustomerId,
          connectionId: conn.id,
          normalizedCustomer
        },
        creds
      );
      asaasCustomerId = created.externalId;
      customerResult = 'NEW CUSTOMER CREATED';
    }

    assert.ok(asaasCustomerId, 'Asaas customer ID must be returned');
    assert.ok(asaasCustomerId.startsWith('cus_'), 'Asaas customer ID must start with cus_');

    console.log(`CUSTOMER: ${customerResult}`);
    console.log(`ASAAS CUSTOMER: ${asaasCustomerId}`);
    console.log(`EXTERNAL REFERENCE: ${extRef}`);

    // 6. Payment PIX Flow
    console.log('[STEP 2] Creating real PIX payment in Sandbox...');
    const orderNumber = `SBX-${Date.now()}`;
    const paymentResult = await provider.createPayment(
      {
        orderId: crypto.randomUUID(),
        orderNumber,
        amount: 500, // R$ 5,00 in cents
        currency: 'BRL',
        customer: normalizedCustomer,
        method: 'PIX',
        externalCustomerId: asaasCustomerId,
        idempotencyKey: `idem-sbx-${Date.now()}`
      },
      creds
    );

    assert.ok(paymentResult.providerPaymentId, 'Payment ID must be returned by Asaas');
    assert.strictEqual(paymentResult.method, 'PIX', 'Billing type must be PIX');
    assert.ok(paymentResult.providerPaymentId.startsWith('pay_'), 'Provider payment ID must start with pay_');

    console.log('PAYMENT CREATED: YES');
    console.log(`PAYMENT ID: ${paymentResult.providerPaymentId}`);
    console.log(`BILLING TYPE: ${paymentResult.method}`);
    console.log(`STATUS: ${paymentResult.status}`);

    // 7. PIX QR Code and Payload Validation
    console.log('[STEP 3] Validating PIX QR Code & Payload...');
    assert.ok(paymentResult.pixDetails, 'pixDetails must be present');
    assert.ok(paymentResult.pixDetails.qrCodeUrl, 'PIX payload string must be present');
    assert.ok(paymentResult.pixDetails.qrCode, 'PIX encodedImage must be present');

    const payloadLength = paymentResult.pixDetails.qrCodeUrl.length;
    assert.ok(payloadLength > 10, 'PIX payload must be non-empty');

    console.log('PIX QR CODE: PRESENT');
    console.log('PIX PAYLOAD: PRESENT');
    console.log(`PIX PAYLOAD LENGTH: ${payloadLength}`);
    console.log('PIX IMAGE: PRESENT');

    console.log('== ASAAS SANDBOX REAL OUTBOUND RUN COMPLETED SUCCESSFULLY ==');
    console.log('SANDBOX TEST: PASS');
    console.log('REAL ASAAS CALLS: YES');
    process.exit(0);
  } catch (apiErr: any) {
    console.error(`[SANDBOX ERROR] Real Asaas API call failed: ${apiErr.message}`);
    console.log('SANDBOX TEST: FAIL');
    console.log('REAL ASAAS CALLS: YES');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[SANDBOX] Unexpected runner error:', err);
  process.exit(1);
});
