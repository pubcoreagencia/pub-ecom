export const env = {
  get public() {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing mandatory public configuration.");
    }

    return {
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    };
  },

  get server() {
    // Only accessible on server environment
    if (typeof window !== 'undefined') {
      throw new Error("Cannot access server configuration from browser environment.");
    }

    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:3000';

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing mandatory server configuration (SUPABASE_SERVICE_ROLE_KEY).");
    }

    return {
      SUPABASE_SERVICE_ROLE_KEY,
      ALLOWED_ORIGINS: ALLOWED_ORIGINS.split(',').map(o => o.trim()),
    };
  }
};
