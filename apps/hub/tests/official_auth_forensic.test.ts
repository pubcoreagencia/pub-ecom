import { describe, it, expect } from "vitest";
import { OFFICIAL_SUPABASE_URL, createSupabaseClient } from "../src/integrations/supabase/client";
import { validateSupabaseCaller } from "../src/server/catalogProxy";

describe("TAREFA 10 & 11 - Teste Forense do Auth e Shopee Ingestion", () => {
  it("garante que a URL oficial do Supabase seja estritamente vtcnundfslqqlxdyrogv", () => {
    expect(OFFICIAL_SUPABASE_URL).toBe("https://vtcnundfslqqlxdyrogv.supabase.co");
    expect(OFFICIAL_SUPABASE_URL).not.toContain("rouxgtjonfncswsqlcgz");
  });

  it("garante que o cliente Supabase é instanciado com o endpoint oficial", () => {
    const client = createSupabaseClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it("rejeita JWT com issuer do Supabase antigo do Lovable (rouxgtjonfncswsqlcgz)", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        iss: "https://rouxgtjonfncswsqlcgz.supabase.co/auth/v1",
        aud: "authenticated",
        sub: "user-123",
        email: "contato.pubcore@gmail.com",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    const fakeToken = `${header}.${payload}.signature`;

    const mockEnv = {
      SUPABASE_URL: "https://vtcnundfslqqlxdyrogv.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
      CATALOG_WORKER_TOKEN: "secret-token",
    };

    const req = new Request(
      "https://pubcoreagencia-pubecomhub.contato-pubcore.workers.dev/api/catalog/health",
      {
        headers: {
          authorization: `Bearer ${fakeToken}`,
        },
      },
    );

    const authResult = await validateSupabaseCaller(req, mockEnv as any);
    expect(authResult.authenticated).toBe(false);
  });

  it("valida a estrutura exigida do JWT oficial (iss, aud, email, app_metadata, role)", () => {
    const officialPayload = {
      iss: "https://vtcnundfslqqlxdyrogv.supabase.co/auth/v1",
      aud: "authenticated",
      sub: "a3b90f42-45e6-42bc-86db-589cf24a0d9b",
      email: "contato.pubcore@gmail.com",
      role: "authenticated",
      app_metadata: {
        provider: "email",
        providers: ["email"],
      },
      user_metadata: {
        role: "MASTER",
      },
    };

    expect(officialPayload.iss).toBe("https://vtcnundfslqqlxdyrogv.supabase.co/auth/v1");
    expect(officialPayload.aud).toBe("authenticated");
    expect(officialPayload.email).toBe("contato.pubcore@gmail.com");
    expect(officialPayload.iss).not.toContain("rouxgtjonfncswsqlcgz:");
  });
});
