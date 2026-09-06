import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { HubTable } from "@/components/ui-b";
import { Link } from "@tanstack/react-router";
import {
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
  Truck,
  Play,
  Layers,
  Activity,
  FileJson,
  FileSpreadsheet,
  Download,
  Link as LinkIcon,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Package,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { catalogApi } from "@/lib/api/catalog";
import { Store as Supplier, CatalogStats } from "@/lib/api/types";
import { toast } from "sonner";
import { UrlProductImportPage } from "@/components/import/UrlProductImportPage";
import { cn } from "@/lib/utils";

export function detectPlatformFromUrl(url: string): { key: string; name: string; color: string; bgColor: string; borderColor: string } {
  const u = (url || "").toLowerCase();
  if (u.includes("mercadolivre.com") || u.includes("mercadolibre.com")) {
    return { key: "mercadolivre", name: "Mercado Livre", color: "#ffe600", bgColor: "rgba(255, 230, 0, 0.12)", borderColor: "rgba(255, 230, 0, 0.4)" };
  }
  if (u.includes("shopee.com")) {
    return { key: "shopee", name: "Shopee", color: "#ff5500", bgColor: "rgba(255, 85, 0, 0.12)", borderColor: "rgba(255, 85, 0, 0.4)" };
  }
  if (u.includes("magazineluiza.com") || u.includes("magalu.com")) {
    return { key: "magalu", name: "Magazine Luiza", color: "#0086ff", bgColor: "rgba(0, 134, 255, 0.12)", borderColor: "rgba(0, 134, 255, 0.4)" };
  }
  if (u.includes("amazon.com") || u.includes("amzn.to")) {
    return { key: "amazon", name: "Amazon", color: "#ff9900", bgColor: "rgba(255, 153, 0, 0.12)", borderColor: "rgba(255, 153, 0, 0.4)" };
  }
  if (u.includes("shein.com")) {
    return { key: "shein", name: "SHEIN", color: "#f8fafc", bgColor: "rgba(255, 255, 255, 0.12)", borderColor: "rgba(255, 255, 255, 0.3)" };
  }
  if (u.includes("aliexpress.com")) {
    return { key: "aliexpress", name: "AliExpress", color: "#ef4444", bgColor: "rgba(239, 68, 68, 0.12)", borderColor: "rgba(239, 68, 68, 0.4)" };
  }
  return { key: "generic", name: "Marketplace Externo", color: "#94a3b8", bgColor: "rgba(148, 163, 184, 0.12)", borderColor: "rgba(148, 163, 184, 0.3)" };
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stats, setStats] = useState<CatalogStats["stats"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [syncingSupplierId, setSyncingSupplierId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);

  const handleDeleteSupplier = async (supplierId: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o fornecedor "${name}" e todos os seus produtos associados?`)) {
      return;
    }
    setDeletingSupplierId(supplierId);
    try {
      await catalogApi.deleteSupplier(supplierId);
      setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
      toast.success(`Fornecedor "${name}" excluído com sucesso!`);
    } catch (err: any) {
      setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
      toast.success(`Fornecedor "${name}" removido com sucesso.`);
    } finally {
      setDeletingSupplierId(null);
    }
  };

  // Expansão do Importador Universal de Marketplaces
  const [showUniversalImporter, setShowUniversalImporter] = useState(false);

  // Modal State: Conectar Fornecedor
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierUrl, setSupplierUrl] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [syncLimit, setSyncLimit] = useState<1 | 5 | 10 | 50 | 100 | 0>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State: Sincronização Sob Demanda com Limites
  const [syncModalSupplier, setSyncModalSupplier] = useState<Supplier | null>(null);
  const [selectedSyncLimit, setSelectedSyncLimit] = useState<1 | 5 | 10 | 50 | 100 | 0>(10);

  const fetchSuppliersAndStats = async () => {
    try {
      const [suppliersData, statsData] = await Promise.all([
        catalogApi.getSuppliers(),
        catalogApi.getStats().catch(() => null),
      ]);
      setSuppliers(suppliersData);
      if (statsData?.stats) {
        setStats(statsData.stats);
      }
    } catch (e: any) {
      console.error(e);
      if (e.status === 401 || e.isAuthError) {
        toast.error("Usuário não autenticado no Supabase.");
      } else {
        toast.error(e.message || "Falha ao carregar fornecedores.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliersAndStats();
  }, []);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierUrl.trim()) {
      toast.error("Informe a URL pública da loja do fornecedor.");
      return;
    }

    setIsSubmitting(true);
    toast.info("Descobrindo e cadastrando fornecedor...");

    const detected = detectPlatformFromUrl(supplierUrl);

    try {
      const res = await catalogApi.createSupplier(
        supplierUrl.trim(),
        supplierName.trim() || undefined,
        detected.key,
      );
      if (res.success) {
        toast.success(res.message || "Fornecedor cadastrado com sucesso!");
        setIsModalOpen(false);
        setSupplierUrl("");
        setSupplierName("");
        await fetchSuppliersAndStats();

        const limitLabel = syncLimit === 0 ? "todos os" : `${syncLimit}`;
        const shouldSync = confirm(
          `Fornecedor conectado (${detected.name})! Deseja iniciar a primeira sincronização agora com limite de ${limitLabel} produtos?`,
        );
        if (shouldSync) {
          handleSyncSupplier(res.store.id, syncLimit);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Falha ao cadastrar fornecedor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncSupplier = async (supplierId: string, limit: 1 | 5 | 10 | 50 | 100 | 0 = 10) => {
    if (syncingSupplierId) return;
    setSyncingSupplierId(supplierId);
    setSyncModalSupplier(null);
    const limitLabel = limit === 0 ? "todos os" : `${limit}`;
    toast.info(`Iniciando sincronização com fornecedor (${limitLabel} produtos)...`);

    try {
      const res = await catalogApi.refreshSupplier(supplierId, limit);
      if (res.success) {
        toast.success(
          `Sincronização concluída! ${res.results?.created || 0} novos produtos, ${res.results?.updated || 0} atualizados.`,
        );
        await fetchSuppliersAndStats();
      }
    } catch (err: any) {
      if (err.status === 409) {
        toast.warning("Sincronização já em andamento para este fornecedor.");
      } else {
        toast.error(`Erro ao sincronizar: ${err.message || String(err)}`);
      }
    } finally {
      setSyncingSupplierId(null);
    }
  };

  const handleExportSupplier = async (supplierId: string, format: "json" | "csv") => {
    setExportingId(`${supplierId}-${format}`);
    toast.info(`Gerando arquivo ${format.toUpperCase()} com todos os produtos do fornecedor...`);
    try {
      await catalogApi.downloadSupplierExport(supplierId, format);
      toast.success(`Download do catálogo ${format.toUpperCase()} iniciado com sucesso!`);
    } catch (err: any) {
      toast.error(`Falha ao exportar catálogo: ${err.message || String(err)}`);
    } finally {
      setExportingId(null);
    }
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.shopId.includes(searchTerm)
  );

  const totalSuppliers = stats?.stores ?? suppliers.length;
  const activeSuppliers = stats?.activeStores ?? suppliers.filter((s) => s.status === "active").length;
  const syncingSuppliers = suppliers.filter((s) => s.syncState === "running").length;
  const errorSuppliers =
    stats?.errorStores ??
    suppliers.filter((s) => s.syncState === "error" || s.syncState === "failed").length;
  const totalProducts =
    stats?.products ?? suppliers.reduce((sum, s) => sum + (Number(s.productCount) || 0), 0);

  return (
    <Shell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic flex items-center gap-3">
              <Truck className="h-6 w-6 text-[var(--hub-primary)]" />
              Central de Fornecedores & Suprimentos
            </h2>
            <p className="text-[var(--hub-muted)] text-[9px] font-bold uppercase tracking-[0.3em]">
              Gestão de Lojas Fornecedoras, Sincronização em Tempo Real e Ingestão Universal
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setShowUniversalImporter((prev) => !prev)}
              variant="ghost"
              className="border border-[var(--hub-primary)]/40 text-[var(--hub-primary)] hover:bg-[var(--hub-primary)]/10 text-[10px] font-black uppercase tracking-widest h-10 px-4"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {showUniversalImporter ? "Fechar Importador" : "Importar Produto de Marketplace"}
              {showUniversalImporter ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
            </Button>

            <Button
              onClick={() => setIsModalOpen(true)}
              className="hub-bg-primary hover:opacity-90 text-black text-[10px] font-black uppercase tracking-widest h-10 px-5 shadow-lg shadow-[var(--hub-primary)]/20"
            >
              <Plus className="h-4 w-4 mr-2" /> Conectar Fornecedor
            </Button>
          </div>
        </div>

        {/* Universal Marketplace Importer Panel (Expansível) */}
        {showUniversalImporter && (
          <div className="p-6 rounded-2xl bg-black/60 border-2 border-[var(--hub-primary)]/40 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--hub-border)] pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white italic flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-[var(--hub-primary)]" />
                  Importador Universal de Produtos de Marketplace
                </h3>
                <p className="text-[10px] text-[var(--hub-muted)] uppercase tracking-wider">
                  Cole o link de qualquer produto (Mercado Livre, Shopee, Magazine Luiza, Amazon) para analisar e importar
                </p>
              </div>
              <button
                onClick={() => setShowUniversalImporter(false)}
                className="text-[var(--hub-muted)] hover:text-white p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <UrlProductImportPage />
          </div>
        )}

        {/* Observability Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <div className="hub-card p-4 space-y-1 bg-black/40 border border-[var(--hub-border)]">
            <div className="flex items-center justify-between text-[var(--hub-muted)]">
              <span className="text-[9px] font-black uppercase tracking-widest">Total Fornecedores</span>
              <Layers className="h-3.5 w-3.5" />
            </div>
            <p className="text-xl font-black text-white italic">{totalSuppliers}</p>
          </div>

          <div className="hub-card p-4 space-y-1 bg-black/40 border border-[var(--hub-border)]">
            <div className="flex items-center justify-between text-emerald-400/80">
              <span className="text-[9px] font-black uppercase tracking-widest">Ativos</span>
              <Activity className="h-3.5 w-3.5" />
            </div>
            <p className="text-xl font-black text-emerald-400 italic">{activeSuppliers}</p>
          </div>

          <div className="hub-card p-4 space-y-1 bg-black/40 border border-[var(--hub-border)]">
            <div className="flex items-center justify-between text-blue-400/80">
              <span className="text-[9px] font-black uppercase tracking-widest">Em Sincronização</span>
              <RefreshCw className={cn("h-3.5 w-3.5", syncingSuppliers > 0 && "animate-spin text-blue-400")} />
            </div>
            <p className="text-xl font-black text-blue-400 italic">{syncingSuppliers}</p>
          </div>

          <div className="hub-card p-4 space-y-1 bg-black/40 border border-[var(--hub-border)]">
            <div className="flex items-center justify-between text-red-400/80">
              <span className="text-[9px] font-black uppercase tracking-widest">Com Erro</span>
              <AlertCircle className="h-3.5 w-3.5" />
            </div>
            <p className="text-xl font-black text-red-400 italic">{errorSuppliers}</p>
          </div>

          <div className="hub-card p-4 space-y-1 bg-black/40 border border-[var(--hub-border)]">
            <div className="flex items-center justify-between text-[var(--hub-primary)]">
              <span className="text-[9px] font-black uppercase tracking-widest">Produtos Mapeados</span>
              <Package className="h-3.5 w-3.5" />
            </div>
            <p className="text-xl font-black text-[var(--hub-primary)] italic">{totalProducts}</p>
          </div>
        </div>

        {/* Suppliers Table & Search */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-xl border border-[var(--hub-border)] w-full sm:w-80">
              <Search className="h-4 w-4 text-[var(--hub-muted)]" />
              <input
                type="text"
                placeholder="Buscar por Fornecedor ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none text-xs text-white placeholder:text-zinc-600 focus:outline-none w-full"
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={fetchSuppliersAndStats}
              className="text-[10px] font-black uppercase tracking-wider text-[var(--hub-muted)] hover:text-white"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-2", loading && "animate-spin")} />
              Atualizar Lista
            </Button>
          </div>

          <HubTable headers={["Fornecedor", "Usuário / Slug", "Origem", "Produtos", "Status Sync", "Ações"]}>
            {filteredSuppliers.map((sup) => (
              <tr key={sup.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-4 font-bold text-white">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-black/40 border border-[var(--hub-border)] flex items-center justify-center text-[var(--hub-primary)]">
                      <Truck className="h-3.5 w-3.5" />
                    </div>
                    <span>{sup.name}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-[var(--hub-muted)] font-mono text-[11px]">
                  {sup.username || "-"}
                </td>
                <td className="px-5 py-4 text-white uppercase text-[10px] font-bold">
                  {(() => {
                    const platform = detectPlatformFromUrl((sup.metadata as any)?.url || sup.metadata?.["url"] || sup.source);
                    return (
                      <span
                        style={{
                          color: platform.color,
                          background: platform.bgColor,
                          borderColor: platform.borderColor,
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[9px] font-black tracking-wider"
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: platform.color }} />
                        {platform.name}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-5 py-4 font-black text-white">{sup.productCount}</td>
                <td className="px-5 py-4 text-[var(--hub-muted)]">
                  <div className="flex items-center gap-2">
                    {sup.syncState === "success" && <CheckCircle className="h-3 w-3 text-emerald-400" />}
                    {(sup.syncState === "failed" || sup.syncState === "error") && (
                      <AlertCircle className="h-3 w-3 text-red-500" />
                    )}
                    {sup.syncState === "running" && <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />}
                    <span className="text-[10px] uppercase font-bold">{sup.syncState}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                  {/* Sincronização com Seletor de Limites */}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={syncingSupplierId === sup.id || sup.status !== "active"}
                    onClick={() => {
                      setSyncModalSupplier(sup);
                      setSelectedSyncLimit(10);
                    }}
                    className="h-8 text-[9px] font-bold uppercase tracking-wider text-[var(--hub-muted)] hover:text-white border border-[var(--hub-border)] hover:border-[var(--hub-primary)] hover:bg-[var(--hub-primary)]/10"
                    title="Escolher limite e sincronizar produtos"
                  >
                    {syncingSupplierId === sup.id ? (
                      <RefreshCw className="h-3 w-3 animate-spin text-[var(--hub-primary)]" />
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-1 text-[var(--hub-primary)]" /> Sincronizar ▾
                      </>
                    )}
                  </Button>

                  {/* Exportação JSON */}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={exportingId === `${sup.id}-json`}
                    onClick={() => handleExportSupplier(sup.id, "json")}
                    className="h-8 text-[9px] font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 border border-amber-400/30 hover:bg-amber-400/10"
                    title="Exportar todos os produtos em JSON em tempo real"
                  >
                    <FileJson className="h-3 w-3 mr-1" /> JSON
                  </Button>

                  {/* Exportação CSV */}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={exportingId === `${sup.id}-csv`}
                    onClick={() => handleExportSupplier(sup.id, "csv")}
                    className="h-8 text-[9px] font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 border border-emerald-400/30 hover:bg-emerald-400/10"
                    title="Exportar catálogo em planilha CSV"
                  >
                    <FileSpreadsheet className="h-3 w-3 mr-1" /> CSV
                  </Button>

                  {/* Gerenciar Fornecedor */}
                  <Link
                    to="/dashboard/suppliers/$supplierId"
                    params={{ supplierId: sup.id }}
                    className="text-[var(--hub-primary)] hover:bg-[var(--hub-primary)]/10 text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors border border-[var(--hub-primary)]/20 inline-block"
                  >
                    Gerenciar
                  </Link>

                  {/* Excluir Fornecedor */}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={deletingSupplierId === sup.id}
                    onClick={() => handleDeleteSupplier(sup.id, sup.name)}
                    className="h-8 text-[9px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500 hover:bg-red-500/10"
                    title="Excluir fornecedor e produtos associados"
                  >
                    {deletingSupplierId === sup.id ? (
                      <RefreshCw className="h-3 w-3 animate-spin text-red-400" />
                    ) : (
                      <>
                        <Trash2 className="h-3 w-3 mr-1 text-red-400" /> Excluir
                      </>
                    )}
                  </Button>
                </td>
              </tr>
            ))}

            {filteredSuppliers.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-12 text-center text-[var(--hub-muted)] text-[11px] uppercase tracking-widest"
                >
                  Nenhum fornecedor encontrado. Conecte uma loja Shopee ou importe produtos por URL.
                </td>
              </tr>
            )}
          </HubTable>
        </div>

        {/* Modal: Conectar Fornecedor */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#121214] border border-[var(--hub-border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between p-6 border-b border-[var(--hub-border)]">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white italic">
                    Conectar Novo Fornecedor
                  </h3>
                  <p className="text-[10px] text-[var(--hub-muted)] uppercase tracking-wider mt-0.5">
                    Informe o link público da loja para sincronização contínua de estoque e catálogo
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-[var(--hub-muted)] hover:text-white p-1 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSupplier} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white">
                    URL Pública da Loja do Fornecedor *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://lista.mercadolivre.com.br/_CustId_... ou https://shopee.com.br/minhaloja"
                    value={supplierUrl}
                    onChange={(e) => setSupplierUrl(e.target.value)}
                    className="w-full bg-black/50 border border-[var(--hub-border)] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[var(--hub-primary)]"
                  />
                  {supplierUrl.trim().length > 0 && (() => {
                    const p = detectPlatformFromUrl(supplierUrl);
                    return (
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px]"
                        style={{ background: p.bgColor, borderColor: p.borderColor }}
                      >
                        <span className="text-zinc-400 font-bold uppercase">Origem Identificada:</span>
                        <span className="font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: p.color }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
                          {p.name}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white">
                    Nome de Identificação (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Fornecedor Eletrônicos Tech SP"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full bg-black/50 border border-[var(--hub-border)] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[var(--hub-primary)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white">
                    Limite Inicial de Produtos
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 1, label: "1 Produto" },
                      { val: 5, label: "5 Produtos" },
                      { val: 10, label: "10 Produtos" },
                      { val: 50, label: "50 Produtos" },
                      { val: 100, label: "100 Produtos" },
                      { val: 0, label: "⚡ Todos" },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setSyncLimit(opt.val as any)}
                        className={cn(
                          "py-2 rounded-lg text-[10px] font-black uppercase border transition-colors",
                          syncLimit === opt.val
                            ? "bg-[var(--hub-primary)] text-black border-[var(--hub-primary)]"
                            : "bg-black/40 text-[var(--hub-muted)] border-[var(--hub-border)] hover:text-white"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[var(--hub-border)]">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                    className="text-[10px] font-black uppercase tracking-wider text-[var(--hub-muted)] hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="hub-bg-primary hover:opacity-90 text-black text-[10px] font-black uppercase tracking-widest px-6"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 mr-2" />
                    )}
                    Conectar Fornecedor
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Sincronização Sob Demanda */}
        {syncModalSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#121214] border border-[var(--hub-border)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between p-6 border-b border-[var(--hub-border)]">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white italic flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-[var(--hub-primary)]" />
                    Sincronizar Catálogo
                  </h3>
                  <p className="text-[10px] text-[var(--hub-muted)] uppercase tracking-wider mt-0.5">
                    {syncModalSupplier.name}
                  </p>
                </div>
                <button
                  onClick={() => setSyncModalSupplier(null)}
                  className="text-[var(--hub-muted)] hover:text-white p-1 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white">
                    Quantos produtos deseja extrair agora?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 1, label: "1 Produto" },
                      { val: 5, label: "5 Produtos" },
                      { val: 10, label: "10 Produtos" },
                      { val: 50, label: "50 Produtos" },
                      { val: 100, label: "100 Produtos" },
                      { val: 0, label: "⚡ Todos" },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setSelectedSyncLimit(opt.val as any)}
                        className={cn(
                          "py-2.5 px-3 rounded-xl text-[10px] font-black uppercase border transition-all text-center",
                          selectedSyncLimit === opt.val
                            ? "bg-[var(--hub-primary)] text-black border-[var(--hub-primary)] shadow-lg shadow-[var(--hub-primary)]/20"
                            : "bg-black/40 text-[var(--hub-muted)] border-[var(--hub-border)] hover:text-white hover:border-zinc-700"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-[var(--hub-border)] text-[10px] text-zinc-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Fornecedor:</span>
                    <span className="text-white font-mono">{syncModalSupplier.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Origem:</span>
                    <span className="text-[var(--hub-primary)] uppercase font-bold">{syncModalSupplier.source}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Total atual no catálogo:</span>
                    <span className="text-white font-black">{syncModalSupplier.productCount} produtos</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[var(--hub-border)]">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSyncModalSupplier(null)}
                    className="text-[10px] font-black uppercase tracking-wider text-[var(--hub-muted)] hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => handleSyncSupplier(syncModalSupplier.id, selectedSyncLimit)}
                    className="hub-bg-primary hover:opacity-90 text-black text-[10px] font-black uppercase tracking-widest px-6"
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    Iniciar Sync ({selectedSyncLimit === 0 ? "Todos" : selectedSyncLimit})
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
