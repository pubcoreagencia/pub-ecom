// scripts/browser_import_test.mjs
// Usage: node scripts/browser_import_test.mjs <JWT>
// Sends a POST request to the public Hub API endpoint /api/catalog/import/analyze

import fetch from 'node-fetch';

const HUB_URL = 'https://pubcoreagencia-pubecomhub.contato-pubcore.workers.dev/api/catalog/import/analyze';
const jwt = process.argv[2];
if (!jwt) {
  console.error('Usage: node browser_import_test.mjs <JWT>');
  process.exit(1);
}

const payload = {
  url: 'https://www.mercadolivre.com.br/smartphone-motorola-edge-70-fusion-5g-fifa-world-cup-collection-256gb-24gb-8gb-ram-16gb-ram-boost-camera-50mp-sony-lytia-710-tela-15k-extreme-amoled-grafite/p/MLB67444410',
  markupPercent: 0,
};

(async () => {
  const res = await fetch(HUB_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify(payload),
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response body:', text);
})();
