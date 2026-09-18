export const env = {
  get public() {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    return {
      SUPABASE_URL: SUPABASE_URL || '',
      SUPABASE_ANON_KEY: SUPABASE_ANON_KEY || '',
    };
  },

  get server() {
    if (typeof window !== 'undefined') {
      throw new Error("Cannot access server configuration from browser environment.");
    }

    const DATABASE_URL = process.env.DATABASE_URL;
    const NEON_AUTH_JWKS_URL = process.env.NEON_AUTH_JWKS_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:3000';

    if (!DATABASE_URL && !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing mandatory server database configuration.");
    }

    return {
      DATABASE_URL: DATABASE_URL || '',
      NEON_AUTH_JWKS_URL: NEON_AUTH_JWKS_URL || '',
      SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY || '',
      ALLOWED_ORIGINS: ALLOWED_ORIGINS.split(',').map(o => o.trim()),
    };
  }
};
