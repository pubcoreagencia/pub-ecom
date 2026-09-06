import { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { Shell } from "@/components/layout/Shell";
import { HubTable } from "@/components/ui-b";
import {
  RefreshCw,
  ArrowLeft,
  Package,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Download,
  FileJson,
  FileSpreadsheet,
  Play,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { catalogApi } from "@/lib/api/catalog";
import { Store, Product, SyncRun, StoreOperationalStatus, SyncResponse } from "@/lib/api/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function SupplierDetailPage() {
  const params = useParams({ strict: false }) as { supplierId?: string; storeId?: string };
  const supplierId = params.supplierId || params.storeId || "";

  const [supplier, setSupplier] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLimit, setSelectedLimit] = useState<1 | 10 | 50 | 100>(10);
  const [exporting, setExporting] = useState<"json" | "csv" | null>(null);

  const fetchData = async () => {
    if (!supplierId) return;
    try {
      const [supplierData, productsData, runsData] = await Promise.all([
        catalogApi.getStore(supplierId),
        catalogApi.getStoreProducts(supplierId),
        catalogApi.getStoreSyncRuns(supplierId, { limit: 10 }).catch(() => ({ runs: [], total: 0 })),
      ]);
      setSupplier(supplierData);
      setProducts(productsData);
      setSyncRuns(runsData.runs || []);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao carregar dados do fornecedor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [supplierId]);

  const handleSync = async () => {
    if (!supplier || refreshing) return;
    setRefreshing(true);
    toast.info(`Iniciando sincronização de até ${selectedLimit} produtos...`);
    try {
      const res = await catalogApi.refreshStore(supplier.id, selectedLimit);
      if (res.success) {
        toast.success(
          `Sincronização finalizada! ${res.results?.created || 0} adicionados, ${res.results?.updated || 0} atualizados.`,
        );
        await fetchData();
      }
    } catch (err: any) {
      toast.error(`Erro na sincronização: ${err.message || String(err)}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async (format: "json" | "csv") => {
    if (!supplier) return;
    setExporting(format);
    toast.info(`Exportando catálogo completo em formato ${format.toUpperCase()}...`);
    try {
      await catalogApi.downloadSupplierExport(supplier.id, format);
      toast.success(`Download de catálogo ${format.toUpperCase()} iniciado!`);
    } catch (err: any) {
      toast.error(`Falha ao exportar catálogo: ${err.message || String(err)}`);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center p-20">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--hub-primary)]" />
        </div>
      </Shell>
    );
  }

  if (!supplier) {
    return (
      <Shell>
        <div className="text-center py-20 space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h3 className="text-lg font-bold text-white uppercase">Fornecedor não encontrado</h3>
          <Link
            to="/dashboard/suppliers"
            className="text-[var(--hub-primary)] uppercase text-xs font-black inline-block"
          >
            ← Voltar para Fornecedores
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--hub-border)] pb-5">
          <div className="space-y-1">
            <Link
              to="/dashboard/suppliers"
              className="text-[var(--hub-muted)] hover:text-white text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1 mb-1 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar aos Fornecedores
            </Link>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-black/50 border border-[var(--hub-border)] flex items-center justify-center text-[var(--hub-primary)]">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">
                  {supplier.name}
                </h2>
                <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--hub-muted)]">
                  <span>CANONICAL: {supplier.id}</span>
                  <span>•</span>
                  <span>ORIGEM: {supplier.source.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Export Buttons */}
            <Button
              variant="ghost"
              size="sm"
              disabled={exporting !== null}
              onClick={() => handleExport("json")}
              className="border border-[var(--hub-border)] text-[9px] font-black uppercase tracking-widest text-zinc-300 hover:text-white hover:bg-white/5"
            >
              <FileJson className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
              {exporting === "json" ? "Gerando..." : "Exportar JSON"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              disabled={exporting !== null}
              onClick={() => handleExport("csv")}
              className="border border-[var(--hub-border)] text-[9px] font-black uppercase tracking-widest text-zinc-300 hover:text-white hover:bg-white/5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
              {exporting === "csv" ? "Gerando..." : "Exportar CSV"}
            </Button>

            {/* Sync Controls */}
            <div className="flex items-center bg-black/40 border border-[var(--hub-border)] rounded-lg p-1">
              {([10, 50, 100] as const).map((limit) => (
                <button
                  key={limit}
                  onClick={() => setSelectedLimit(limit)}
                  className={cn(
                    "px-2.5 py-1 text-[9px] font-black rounded uppercase transition-colors",
                    selectedLimit === limit
                      ? "bg-[var(--hub-primary)] text-black"
                      : "text-[var(--hub-muted)] hover:text-white"
                  )}
                >
                  {limit}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              disabled={refreshing}
              onClick={handleSync}
              className="hub-bg-primary text-black text-[9px] font-black uppercase tracking-widest px-4"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", refreshing && "animate-spin")} />
              {refreshing ? "Sincronizando..." : `Sync (${selectedLimit})`}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="hub-card p-4 space-y-1 bg-black/40 border border-[var(--hub-border)]">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--hub-muted)]">
              Produtos no Catálogo
            </span>
            <p className="text-2xl font-black text-white italic">{products.length}</p>
          </div>

          <div className="hub-card p-4 space-y-1 bg-black/40 border border-[var(--hub-border)]">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--hub-muted)]">
              Status Operacional
            </span>
            <div className="flex items-center gap-2">
              {supplier.status === "active" ? (
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-base font-bold uppercase text-white">{supplier.status}</span>
            </div>
          </div>

          <div className="hub-card p-4 space-y-1 bg-black/40 border border-[var(--hub-border)]">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--hub-muted)]">
              Estado de Sincronização
            </span>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold uppercase text-[var(--hub-primary)]">
                {supplier.syncState}
              </span>
            </div>
          </div>

          <div className="hub-card p-4 space-y-1 bg-black/40 border border-[var(--hub-border)]">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--hub-muted)]">
              Último Sync
            </span>
            <p className="text-xs font-mono text-white mt-1">
              {supplier.lastSyncAt ? new Date(supplier.lastSyncAt).toLocaleString("pt-BR") : "Nunca"}
            </p>
          </div>
        </div>

        {/* Products Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-white italic">
              Produtos Importados do Fornecedor ({products.length})
            </h3>
          </div>

          <HubTable headers={["Imagem", "Produto", "ID Externo", "SKU", "Preço", "Categoria", "Origem"]}>
            {products.map((prod) => (
              <tr key={prod.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-3">
                  <div className="h-10 w-10 rounded-lg bg-black/40 border border-[var(--hub-border)] flex items-center justify-center overflow-hidden">
                    {prod.images[0] ? (
                      <img src={prod.images[0]} alt={prod.title} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-zinc-600" />
                    )}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className="font-bold text-white text-xs block truncate max-w-xs">{prod.title}</span>
                </td>
                <td className="px-5 py-3 font-mono text-[11px] text-[var(--hub-muted)]">{prod.externalId}</td>
                <td className="px-5 py-3 font-mono text-[11px] text-white">{prod.sku || "-"}</td>
                <td className="px-5 py-3 font-black text-white">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: prod.currency || "BRL" }).format(
                    prod.price
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 rounded bg-black/40 border border-[var(--hub-border)] text-[9px] font-bold text-zinc-400 uppercase">
                    {prod.category || "Geral"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <a
                    href={prod.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-[var(--hub-muted)] hover:text-white transition-colors inline-block"
                    title="Abrir página no marketplace original"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </td>
              </tr>
            ))}

            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center text-[var(--hub-muted)] text-xs uppercase tracking-widest">
                  Nenhum produto sincronizado deste fornecedor ainda. Clique em Sync acima para importar os produtos.
                </td>
              </tr>
            )}
          </HubTable>
        </div>
      </div>
    </Shell>
  );
}
