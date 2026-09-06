import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { catalogIngestionService } from "./ingestion/CatalogIngestionService";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateTargetUrl } from "./ingestion/security/urlValidator";

export const analyzeCatalogFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ url: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    // 1. SSRF Protection: Validate target URL before any outbound connection
    validateTargetUrl(data.url);

    // 2. Verify caller has MASTER or FORNECEDOR role
    const supabase = (context as any).supabase;
    const userId = (context as any).userId;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (error || !profile || (profile.role !== "MASTER" && profile.role !== "FORNECEDOR")) {
      throw new Error("Forbidden: Operação permitida apenas para MASTER ou FORNECEDOR.");
    }

    try {
      return await catalogIngestionService.analyzeSource(data.url);
    } catch (err: any) {
      throw new Error(err.message || "Erro ao analisar catálogo");
    }
  });

export const importProductsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        items: z.array(z.any()),
        supplierId: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // 1. Verify caller is MASTER or owns this supplier
    const supabase = (context as any).supabase;
    const userId = (context as any).userId;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    const isMaster = profile?.role === "MASTER";

    if (!isMaster) {
      // Check if user is the supplier owner
      const { data: supplier } = await supabase
        .from("suppliers")
        .select("id, profile_id")
        .eq("id", data.supplierId)
        .single();

      if (!supplier || supplier.profile_id !== userId) {
        throw new Error(
          "Forbidden: Usuário não tem permissão para importar produtos para este fornecedor.",
        );
      }
    }

    return await catalogIngestionService.confirmImport(data.items, data.supplierId);
  });
