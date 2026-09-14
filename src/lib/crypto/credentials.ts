import crypto from 'crypto';

export interface KeyConfig {
  current: string;
  keys: Record<string, string>; // version -> 32-byte hex key
}

export class CredentialCipher {
  private keyConfig: KeyConfig;

  constructor(keyConfig?: KeyConfig) {
    if (keyConfig) {
      this.keyConfig = keyConfig;
    } else {
      const rawEnv = process.env.GATEWAY_ENCRYPTION_KEYS;
      const isProduction =
        process.env.APP_ENVIRONMENT === 'PRODUCTION' ||
        process.env.NODE_ENV === 'production';

      if (!rawEnv) {
        if (isProduction) {
          throw new Error(
            'GATEWAY_ENCRYPTION_KEYS is required in production: missing encryption keys environment variable'
          );
        }

        // Fallback default strictly for local test/development environments (deterministic 32-byte key)
        this.keyConfig = {
          current: 'v1',
          keys: {
            v1: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
          }
        };
      } else {
        try {
          this.keyConfig = JSON.parse(rawEnv);
        } catch (err: any) {
          throw new Error(`Invalid GATEWAY_ENCRYPTION_KEYS JSON: ${err.message}`);
        }
      }
    }
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.keyConfig.current || !this.keyConfig.keys) {
      throw new Error('Malformed KeyConfig: current and keys are required');
    }
    const currentKey = this.keyConfig.keys[this.keyConfig.current];
    if (!currentKey) {
      throw new Error(`Current key version ${this.keyConfig.current} not found in keys dict`);
    }
    if (Buffer.from(currentKey, 'hex').length !== 32) {
      throw new Error(`Key ${this.keyConfig.current} must be 32 bytes hex encoded (64 characters)`);
    }
  }

  /**
   * Encrypts plaintext JSON or string using AES-256-GCM
   * Output format: key_version:iv_hex:auth_tag_hex:ciphertext_hex
   */
  public encrypt(data: Record<string, any> | string): string {
    const version = this.keyConfig.current;
    const keyHex = this.keyConfig.keys[version];
    const key = Buffer.from(keyHex, 'hex');

    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    const ivHex = iv.toString('hex');

    return `${version}:${ivHex}:${authTag}:${ciphertext}`;
  }

  /**
   * Decrypts ciphertext formatted as key_version:iv_hex:auth_tag_hex:ciphertext_hex
   */
  public decrypt(payload: string): any {
    const parts = payload.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid ciphertext format. Expected key_version:iv:tag:ciphertext');
    }

    const [version, ivHex, authTagHex, ciphertextHex] = parts;
    const keyHex = this.keyConfig.keys[version];
    if (!keyHex) {
      throw new Error(`Decryption key version ${version} not found in key config`);
    }

    const key = Buffer.from(keyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  }
}
