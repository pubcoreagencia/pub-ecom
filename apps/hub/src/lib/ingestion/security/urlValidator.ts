/**
 * SSRF Protection and Target URL Validator
 * Enforces strict protocol, domain whitelisting, and IP restriction.
 */

const ALLOWED_DOMAIN_PATTERNS = [
  /^([a-zA-Z0-9-]+\.)*mercadolivre\.com\.br$/,
  /^([a-zA-Z0-9-]+\.)*mercadolibre\.com$/,
  /^([a-zA-Z0-9-]+\.)*mercadolibre\.com\.[a-z]{2}$/,
  /^([a-zA-Z0-9-]+\.)*shopee\.com\.br$/,
  /^([a-zA-Z0-9-]+\.)*shopee\.com$/,
  /^([a-zA-Z0-9-]+\.)*shopee\.[a-z.]{2,6}$/,
  /^([a-zA-Z0-9-]+\.)*amazon\.com\.br$/,
  /^([a-zA-Z0-9-]+\.)*amazon\.com$/,
  /^([a-zA-Z0-9-]+\.)*amzn\.to$/,
  /^([a-zA-Z0-9-]+\.)*tiktok\.com$/,
  /^([a-zA-Z0-9-]+\.)*shein\.com$/,
  /^([a-zA-Z0-9-]+\.)*aliexpress\.com$/,
  /^([a-zA-Z0-9-]+\.)*magazineluiza\.com\.br$/,
  /^([a-zA-Z0-9-]+\.)*casasbahia\.com\.br$/,
  /^([a-zA-Z0-9-]+\.)*americanas\.com\.br$/,
  /^([a-zA-Z0-9-]+\.)*myshopify\.com$/,
  /^([a-zA-Z0-9-]+\.)*nuvemshop\.com\.br$/,
  /^([a-zA-Z0-9-]+\.)*pubcore\.com\.br$/,
  /^([a-zA-Z0-9-]+\.)*vercel\.store$/,
  /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
];

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254", // AWS/GCP/Azure instance metadata
  "metadata.google.internal",
  "instance-data",
]);

/**
 * Checks if an IPv4 address belongs to a private or link-local range (RFC 1918 / RFC 3927)
 */
function isPrivateIp(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  // 127.0.0.0/8 (Loopback)
  if (parts[0] === 127) return true;

  // 10.0.0.0/8 (Private)
  if (parts[0] === 10) return true;

  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) return true;

  // 192.168.0.0/16 (Private)
  if (parts[0] === 192 && parts[1] === 168) return true;

  // 169.254.0.0/16 (Link-local / Cloud Metadata)
  if (parts[0] === 169 && parts[1] === 254) return true;

  // 0.0.0.0/8
  if (parts[0] === 0) return true;

  return false;
}

export function isAllowedTargetUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") {
    return false;
  }

  const trimmed = rawUrl.trim();

  // Protocol check: only http and https allowed
  if (!/^https?:\/\//i.test(trimmed)) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  // Reject credentials in URL (e.g., http://user:pass@host)
  if (parsed.username || parsed.password) {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // Reject blocked hostnames
  if (BLOCKED_HOSTS.has(hostname)) {
    return false;
  }

  // Reject private IPs
  if (isPrivateIp(hostname)) {
    return false;
  }

  // Reject IPv6 loopback / link-local / private
  if (hostname.includes(":") || hostname.startsWith("[") || hostname.endsWith("]")) {
    return false;
  }

  // Validate hostname against whitelist
  const isWhitelisted = ALLOWED_DOMAIN_PATTERNS.some((pattern) => pattern.test(hostname));
  if (!isWhitelisted) {
    return false;
  }

  return true;
}

export function validateTargetUrl(url: string): void {
  if (!isAllowedTargetUrl(url)) {
    throw new Error(`SSRF Block: URL de destino não permitida ou inválida (${url}).`);
  }
}
