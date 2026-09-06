import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, ArrowRight, RefreshCw, History, Database, Search, Store } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { toast } from "sonner";
import { catalogApi } from "@/lib/api/catalog";
import { useNavigate } from "@tanstack/react-router";
import { UrlProductImportPage } from "@/components/import/UrlProductImportPage";

type IngestionStatus = "idle" | "running" | "success" | "error";

interface IngestionResult {
  productsFound: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  provider: string;
  duration: number;
  syncRunId: string;
}

export const CatalogIngestion = () => {
  const [activeTab, setActiveTab] = useState<"url-import" | "store-sync">("url-import");
  const [url, setUrl] = useState("");
  const [limit, setLimit] = useState(30);
  const [status, setStatus] = useState<IngestionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [history, setHistory] = useState<IngestionResult[]>([]);
  const navigate = useNavigate();

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setStatus("running");
    setErrorMessage(null);
    setResult(null);

    try {
      const data = await catalogApi.ingestShopee(url, limit);

      const syncStats = data.masterCatalog || {
        total: data.items?.length || 0,
        created: 0,
        updated: 0,
        unchanged: 0,
        failed: 0,
        importDurationMs: 0,
      };

      const meta = data.metadata || {};

      const resultObj: IngestionResult = {
        productsFound: syncStats.total || data.items?.length || 0,
        created: syncStats.created || 0,
        updated: syncStats.updated || 0,
        unchanged: syncStats.unchanged || 0,
        failed: syncStats.failed || 0,
        provider: meta.provider || "apify",
        duration: syncStats.importDurationMs || meta.executionTimeMs || 0,
        syncRunId: meta.requestId || meta.syncRunId || "ingest_run",
      };

      setResult(resultObj);
      setHistory((prev) => [resultObj, ...prev.slice(0, 4)]);
      setStatus("success");
      toast.success("Ingestão concluída com sucesso!");
    } catch (error: any) {
      console.error(error);
      const msg = error.message || "Erro inesperado na ingestão";
      setErrorMessage(msg);
      setStatus("error");
      if (error.status === 401 || error.isAuthError) {
        toast.error(
          error.message ||
            "Usuário não autenticado. Faça login no Supabase para executar a ingestão.",
        );
      } else if (error.status === 403) {
        toast.error(
          error.message ||
            "Apenas administradores MASTER podem disparar operações de scraping e ingestão.",
        );
      } else {
        toast.error(msg);
      }
    }
  };

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--hub-border)] pb-6">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              Ingestion & Import Engine
            </h1>
            <p className="text-[var(--hub-muted)] text-[9px] font-bold uppercase tracking-[0.3em]">
              Importação Direta por URL e Sincronização de Catálogos
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-black/60 p-1 rounded-xl border border-[var(--hub-border)]">
            <button
              onClick={() => setActiveTab("url-import")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "url-import"
                  ? "bg-red-600 text-white shadow-lg shadow-red-600/20"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Importar por URL
            </button>
            <button
              onClick={() => setActiveTab("store-sync")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "store-sync"
                  ? "bg-red-600 text-white shadow-lg shadow-red-600/20"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              Sincronizar Loja
            </button>
          </div>
        </div>

        {activeTab === "url-import" ? (
          <UrlProductImportPage
            onNavigateToProducts={() => navigate({ to: "/dashboard/products" })}
            onOpenProduct={() => navigate({ to: "/dashboard/products" })}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 bg-black/40 border-[var(--hub-border)]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-sm uppercase tracking-widest font-black">
                <RefreshCw
                  className={
                    status === "running"
                      ? "animate-spin text-[var(--hub-primary)]"
                      : "text-[var(--hub-primary)]"
                  }
                />
                Executar Nova Ingestão
              </CardTitle>
              <CardDescription className="text-[var(--hub-muted)] text-[10px] uppercase font-bold tracking-wider">
                Informe a URL da loja Shopee para sincronizar produtos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleIngest} className="space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-[var(--hub-muted)] uppercase tracking-widest italic">
                        URL da Loja Shopee
                      </label>
                      <Input
                        placeholder="https://shopee.com.br/username-ou-id"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="bg-black/60 border-[var(--hub-border)] text-white focus:border-[var(--hub-primary)] h-12"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-[var(--hub-muted)] uppercase tracking-widest italic">
                        Username (Opcional)
                      </label>
                      <Input
                        placeholder="ex: zentta_babuche"
                        className="bg-black/60 border-[var(--hub-border)] text-white h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-[var(--hub-muted)] uppercase tracking-widest italic">
                        Shop ID (Opcional)
                      </label>
                      <Input
                        placeholder="ex: 1729928484"
                        className="bg-black/60 border-[var(--hub-border)] text-white h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-[var(--hub-muted)] uppercase tracking-widest italic">
                        Limite de Produtos
                      </label>
                      <Input
                        type="number"
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="bg-black/60 border-[var(--hub-border)] text-white h-10"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={status === "running" || !url}
                  className="w-full h-12 hub-bg-primary text-black font-black uppercase tracking-[0.2em] text-[11px] shadow-lg shadow-[var(--hub-primary)]/10"
                >
                  {status === "running" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando Ingestão...
                    </>
                  ) : (
                    <>
                      Executar Ingestão Real
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="bg-black/40 border-[var(--hub-border)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-xs uppercase font-black tracking-widest flex items-center gap-2">
                  <Database className="w-4 h-4 text-[var(--hub-primary)]" />
                  Estado da Operação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-[var(--hub-border)]/30">
                  <span className="text-[10px] font-bold text-[var(--hub-muted)] uppercase">
                    Status
                  </span>
                  <Badge
                    className={
                      status === "running"
                        ? "bg-blue-500/20 text-blue-400"
                        : status === "success"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-slate-500/20 text-slate-400"
                    }
                  >
                    {status.toUpperCase()}
                  </Badge>
                </div>
                {result && (
                  <>
                    <div className="flex justify-between items-center py-2 border-b border-[var(--hub-border)]/30">
                      <span className="text-[10px] font-bold text-[var(--hub-muted)] uppercase">
                        Produtos Encontrados
                      </span>
                      <span className="text-sm font-black text-white">{result.productsFound}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-[var(--hub-border)]/30">
                      <span className="text-[10px] font-bold text-[var(--hub-muted)] uppercase">
                        Novos Criados
                      </span>
                      <span className="text-sm font-black text-red-400">{result.created}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-[var(--hub-border)]/30">
                      <span className="text-[10px] font-bold text-[var(--hub-muted)] uppercase">
                        Atualizados
                      </span>
                      <span className="text-sm font-black text-blue-400">{result.updated}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-[var(--hub-border)]/30">
                      <span className="text-[10px] font-bold text-[var(--hub-muted)] uppercase">
                        Falhas
                      </span>
                      <span className="text-sm font-black text-red-400">{result.failed}</span>
                    </div>
                    <div className="pt-2">
                      <p className="text-[9px] text-[var(--hub-muted)] font-mono truncate">
                        ID: {result.syncRunId}
                      </p>
                    </div>
                  </>
                )}
                {errorMessage && (
                  <div className="p-3 bg-red-900/20 border border-red-500/20 rounded-lg text-[10px] text-red-400 font-bold flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorMessage}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-[var(--hub-border)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-xs uppercase font-black tracking-widest flex items-center gap-2">
                  <History className="w-4 h-4 text-[var(--hub-primary)]" />
                  Histórico Recente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {history.length === 0 ? (
                  <p className="text-[10px] text-[var(--hub-muted)] italic">
                    Nenhuma execução registrada
                  </p>
                ) : (
                  history.map((h, i) => (
                    <div
                      key={i}
                      className="text-[10px] border-l-2 border-[var(--hub-primary)] pl-3 py-1 bg-white/5 rounded-r-lg"
                    >
                      <div className="font-black text-white">
                        {h.productsFound} PRODUTOS · {h.provider}
                      </div>
                      <div className="text-[8px] text-[var(--hub-muted)] uppercase">
                        {h.syncRunId.split("-")[0]}... · {(h.duration / 1000).toFixed(1)}s
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        )}
      </div>
    </Shell>
  );
};
