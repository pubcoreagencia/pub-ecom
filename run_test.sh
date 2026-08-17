npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'http://localhost:54321';
const { execSync } = require('child_process');
const statusStr = execSync('npx supabase status -o json').toString();
const jsonStr = statusStr.substring(statusStr.indexOf('{'));
const status = JSON.parse(jsonStr);
const adminClient = createClient(SUPABASE_URL, status.SERVICE_ROLE_KEY);
(async () => {
    const carts = await adminClient.from('carts').select('*').limit(1);
    const store = await adminClient.from('stores').select('*').limit(1);
    const res = await adminClient.rpc('create_checkout', { p_cart_id: carts.data[0].id, p_store_id: store.data[0].id, p_customer_id: carts.data[0].customer_id });
    console.log(res.error);
})();
"
