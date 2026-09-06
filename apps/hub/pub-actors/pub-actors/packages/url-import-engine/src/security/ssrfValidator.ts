export class SsrfValidator {
  private static BLOCKED_HOSTNAMES = new Set([
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "169.254.169.254", // Cloud metadata IP
    "metadata.google.internal",
    "instance-data",
  ]);

  private static BLOCKED_PROTOCOLS = new Set([
    "file:",
    "ftp:",
    "gopher:",
    "data:",
    "javascript:",
    "vbscript:",
  ]);

  /**
   * Validates target URL against SSRF and unauthorized schemes
   */
  static validate(rawUrl: string): { isValid: boolean; sanitizedUrl?: string; error?: string } {
    if (!rawUrl || typeof rawUrl !== "string") {
      return { isValid: false, error: "URL inválida ou ausente." };
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      return { isValid: false, error: "Formato de URL inválido." };
    }

    // Check protocol
    if (!parsed.protocol.startsWith("http")) {
      return {
        isValid: false,
        error: `Protocolo não permitido: ${parsed.protocol}. Apenas HTTP e HTTPS são aceitos.`,
      };
    }

    if (this.BLOCKED_PROTOCOLS.has(parsed.protocol.toLowerCase())) {
      return {
        isValid: false,
        error: `Protocolo perigoso bloqueado: ${parsed.protocol}`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check exact blocked hostnames
    if (this.BLOCKED_HOSTNAMES.has(hostname)) {
      return {
        isValid: false,
        error: `Destino bloqueado por segurança (SSRF): ${hostname}`,
      };
    }

    // Check private IPv4 ranges (10.x.x.x, 172.16.x.x - 172.31.x.x, 192.168.x.x, 127.x.x.x)
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [_, a, b] = ipv4Match.map(Number);
      if (
        a === 10 || // 10.0.0.0/8
        (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
        (a === 192 && b === 168) || // 192.168.0.0/16
        a === 127 || // 127.0.0.0/8
        a === 0 || // 0.0.0.0/8
        (a === 169 && b === 254) // 169.254.0.0/16 Link-local / metadata
      ) {
        return {
          isValid: false,
          error: `Endereço IP privado bloqueado por segurança (SSRF): ${hostname}`,
        };
      }
    }

    return {
      isValid: true,
      sanitizedUrl: parsed.toString(),
    };
  }
}
