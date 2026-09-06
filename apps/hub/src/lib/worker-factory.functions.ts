import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createCatalogWorkerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        repoName: z.string(),
        description: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profile?.role !== "MASTER") {
      throw new Error("Forbidden: Operação de infraestrutura restrita a administradores MASTER.");
    }

    console.log(`[WorkerFactory] Logic to initialize project: ${data.repoName}`);
    return { success: true, message: `Projeto ${data.repoName} preparado para infraestrutura.` };
  });
