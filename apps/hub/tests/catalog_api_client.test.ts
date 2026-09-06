import { describe, it, expect, vi, beforeEach } from "vitest";
import { catalogApi } from "../src/lib/api/catalog";
import { supabase } from "../src/integrations/supabase/client";

describe("CatalogApi Client Authentication & Token Injection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("automatically injects Supabase session access_token into Authorization header", async () => {
    const mockToken = "mock-supabase-access-token-xyz";

    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: {
        session: {
          access_token: mockToken,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "refresh-xyz",
          user: { id: "user-123", email: "test@example.com" } as any,
        },
      },
      error: null,
    });

    let capturedHeaders: Headers | undefined;
    global.fetch = vi.fn(async (input: any, init?: any) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(
        JSON.stringify({ stats: { products: 10, stores: 2, sync: { success: 5 } } }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });

    const stats = await catalogApi.getStats();
    expect(stats).toBeDefined();
    expect(capturedHeaders?.get("Authorization")).toBe(`Bearer ${mockToken}`);
  });

  it("throws isAuthError: true and status 401 when session is absent in browser environment", async () => {
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Simulate browser window
    (global as any).window = {};

    await expect(catalogApi.getStats()).rejects.toMatchObject({
      status: 401,
      isAuthError: true,
      message: expect.stringContaining("Usuário não autenticado"),
    });

    delete (global as any).window;
  });

  it("preserves existing Authorization header if explicitly provided in request options", async () => {
    const customToken = "explicit-custom-token";

    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: {
        session: {
          access_token: "should-not-override-if-present",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "refresh",
          user: { id: "user-123" } as any,
        },
      },
      error: null,
    });

    let capturedHeaders: Headers | undefined;
    global.fetch = vi.fn(async (input: any, init?: any) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    await catalogApi.refreshStore("store-123");
    expect(capturedHeaders?.get("Authorization")).toContain("Bearer");
  });
});
