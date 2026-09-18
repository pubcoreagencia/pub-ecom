export const env = {
  get public() {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    // Legacy browser compatibility. The Render API runtime no longer requires
    // Supabase credentials, but existing browser/test code can still import this object.
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
    const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:3000';

    if (!DATABASE_URL) {
      throw new Error("Missing mandatory server configuration (DATABASE_URL).");
    }

    return {
      DATABASE_URL,
      NEON_AUTH_JWKS_URL: NEON_AUTH_JWKS_URL || '',
      ALLOWED_ORIGINS: ALLOWED_ORIGINS.split(',').map(o => o.trim()),
    };
  }
};
