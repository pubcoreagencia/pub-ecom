// tests/services/payment_hub/providers/asaas_sandbox.test.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../../../types/supabase';
import { CredentialCipher } from '../../../../src/lib/crypto/credentials';
import { AsaasProvider } from '../../../../src/services/payment_hub/providers/asaas_provider';

async function main() {
  console.log('== ASAAS SANDBOX REAL INTEGRATION TEST ==');

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
    console.log('[SANDBOX] Supabase service role key not available. Skipping sandbox test.');
    console.log('SANDBOX TEST: NOT RUN');
    console.log('REAL ASAAS CALLS: NO');
    process.exit(0);
  }

  const client = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Query active Asaas sandbox connection
  const { data: conn, error } = await client
    .from('gateway_connections')
    .select('*')
    .eq('provider_id', 'asaas')
    .eq('environment', 'SANDBOX')
    .eq('status', 'ACTIVE')
    .limit(1)
    .maybeSingle();

  if (error || !conn || !conn.encrypted_credentials) {
    console.log('[SANDBOX] No active Asaas sandbox connection found in gateway_connections.');
    console.log('SANDBOX TEST: NOT RUN');
    console.log('REAL ASAAS CALLS: NO');
    process.exit(0);
  }

  let decryptedCreds: any = null;
  try {
    const cipher = new CredentialCipher();
    decryptedCreds = cipher.decrypt(conn.encrypted_credentials);
  } catch (err: any) {
    console.log(`[SANDBOX] Failed to decrypt connection credentials: ${err.message}`);
    console.log('SANDBOX TEST: NOT RUN');
    console.log('REAL ASAAS CALLS: NO');
    process.exit(0);
  }

  const apiKey = decryptedCreds?.apiKey;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.includes('TEST') || apiKey.includes('INTEGRATION') || !apiKey.startsWith('$aact_')) {
    console.log('[SANDBOX] Connection credentials contain placeholder/empty apiKey. Skipping live calls.');
    console.log('SANDBOX TEST: NOT RUN');
    console.log('REAL ASAAS CALLS: NO');
    process.exit(0);
  }

  console.log('[SANDBOX] Valid sandbox credentials found. Invoking Asaas Sandbox API...');
  const provider = new AsaasProvider();

  try {
    // Attempt real call to verify Asaas connectivity: customer reconciliation check
    const result = await provider.reconcileExternalCustomer(
      {
        customerId: '00000000-0000-0000-0000-000000000000',
        connectionId: conn.id,
        normalizedCustomer: {
          name: 'Connectivity Check',
          email: 'check@connectivity.test'
        }
      },
      {
        apiKey,
        environment: 'SANDBOX'
      }
    );

    console.log(`[SANDBOX] Connectivity check successful. Reconcile result: ${result}`);
    console.log('SANDBOX TEST: PASS');
    console.log('REAL ASAAS CALLS: YES');
    process.exit(0);
  } catch (apiErr: any) {
    console.error(`[SANDBOX] Real Asaas API call failed: ${apiErr.message}`);
    console.log('SANDBOX TEST: FAIL');
    console.log('REAL ASAAS CALLS: YES');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[SANDBOX] Unexpected error:', err);
  process.exit(1);
});
