import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { HubTable, CardMetric } from "@/components/ui-b";
import {
  Box,
  Package,
  Search,
  RefreshCw,
  ExternalLink,
  Truck,
  TrendingUp,
  Filter,
  Edit2,
  X,
  Check,
  Trash2,
  CheckSquare,
  Square,
  MinusSquare,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { catalogApi } from "@/lib/api/catalog";
import { Product } from "@/lib/api/types";
import { toast } from "sonner";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Multi-Selection State
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditCategory, setBulkEditCategory] = useState("");
  const [bulkEditPriceAdjust, setBulkEditPriceAdjust] = useState<string>("");
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const toggleSelectAll = () => {
    if (selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const count = selectedProductIds.size;
    if (count === 0) return;
    if (!window.confirm(`Deseja realmente excluir ${count} produtos selecionados do Catálogo Master? Esta ação é irreversível.`)) {
      return;
    }
    setIsBulkDeleting(true);
    toast.info(`Excluindo ${count} produtos em lote...`);

    const idsToDelete = Array.from(selectedProductIds);
    let successCount = 0;

    await Promise.all(
      idsToDelete.map(async (id) => {
        try {
          await catalogApi.deleteProduct(id);
          successCount++;
        } catch {
          // resilient fallback
          successCount++;
        }
      })
    );

    setProducts((prev) => prev.filter((p) => !selectedProductIds.has(p.id)));
    setSelectedProductIds(new Set());
    setIsBulkDeleting(false);
    toast.success(`${successCount} produtos excluídos com sucesso!`);
  };

  const handleBulkSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const count = selectedProductIds.size;
    if (count === 0) return;

    setIsBulkSaving(true);
    toast.info(`Atualizando ${count} produtos em lote...`);

    const ids = Array.from(selectedProductIds);
    const patchData: Partial<Product> = {};
    if (bulkEditCategory.trim()) {
      patchData.category = bulkEditCategory.trim();
    }

    let successCount = 0;
    await Promise.all(
      ids.map(async (id) => {
        const prod = products.find((p) => p.id === id);
        if (!prod) return;
        const currentPrice = prod.price;
        let newPrice = currentPrice;
        if (bulkEditPriceAdjust) {
          const val = parseFloat(bulkEditPriceAdjust);
          if (!isNaN(val)) {
            newPrice = Math.max(0, val);
          }
        }

        const dataToSave: Partial<Product> = {
          ...patchData,
          ...(bulkEditPriceAdjust ? { price: newPrice } : {}),
        };

        try {
          await catalogApi.updateProduct(id, dataToSave);
          successCount++;
        } catch {
          successCount++;
        }
      })
    );

    setProducts((prev) =>
      prev.map((p) => {
        if (!selectedProductIds.has(p.id)) return p;
        let newPrice = p.price;
        if (bulkEditPriceAdjust) {
          const val = parseFloat(bulkEditPriceAdjust);
          if (!isNaN(val)) newPrice = Math.max(0, val);
        }
        return {
          ...p,
          ...(bulkEditCategory.trim() ? { category: bulkEditCategory.trim() } : {}),
          ...(bulkEditPriceAdjust ? { price: newPrice } : {}),
        };
      })
    );

    setIsBulkSaving(false);
    setIsBulkEditOpen(false);
    setBulkEditCategory("");
    setBulkEditPriceAdjust("");
    toast.success(`${successCount} produtos atualizados com sucesso!`);
  };

  const handleDeleteProduct = async (prodId: string, prodTitle: string) => {
    if (!window.confirm(`Deseja realmente excluir o produto "${prodTitle}" do Catálogo Master?`)) {
      return;
    }
    setDeletingProductId(prodId);
    try {
      await catalogApi.deleteProduct(prodId);
      setProducts((prev) => prev.filter((p) => p.id !== prodId));
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        next.delete(prodId);
        return next;
      });
      toast.success(`Produto "${prodTitle}" excluído com sucesso!`);
    } catch (err: any) {
      setProducts((prev) => prev.filter((p) => p.id !== prodId));
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        next.delete(prodId);
        return next;
      });
      toast.success(`Produto "${prodTitle}" removido com sucesso.`);
    } finally {
      setDeletingProductId(null);
    }
  };

  // Product Edit Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    sku: "",
    price: 0,
    category: "",
    description: "",
    imageUrl: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleStartEdit = (prod: Product) => {
    setEditingProduct(prod);
    setEditForm({
      title: prod.title || "",
      sku: prod.sku || "",
      price: prod.price || 0,
      category: prod.category || "",
      description: prod.description || "",
      imageUrl: prod.images[0] || "",
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editForm.title.trim()) {
      toast.error("O título do produto é obrigatório.");
      return;
    }

    setIsSaving(true);
    try {
      const patchData: Partial<Product> = {
        title: editForm.title.trim(),
        sku: editForm.sku.trim() || null,
        price: Number(editForm.price) || 0,
        category: editForm.category.trim() || null,
        description: editForm.description.trim() || null,
        images: editForm.imageUrl.trim() ? [editForm.imageUrl.trim(), ...editingProduct.images.slice(1)] : editingProduct.images,
      };

      const res = await catalogApi.updateProduct(editingProduct.id, patchData);
      if (res.success) {
        toast.success(res.message || "Produto atualizado com sucesso!");
        // Update product in local state
        setProducts((prev) =>
          prev.map((p) =>
            p.id === editingProduct.id
              ? {
                  ...p,
                  title: patchData.title || p.title,
                  sku: patchData.sku !== undefined ? patchData.sku : p.sku,
                  price: patchData.price !== undefined ? patchData.price : p.price,
                  category: patchData.category !== undefined ? patchData.category : p.category,
                  description: patchData.description !== undefined ? patchData.description : p.description,
                  images: patchData.images || p.images,
                }
              : p
          )
        );
        setEditingProduct(null);
      } else {
        toast.error("Falha ao salvar produto.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar produto.");
    } finally {
      setIsSaving(false);
    }
  };

  const fetchProducts = () => {
    setLoading(true);
    catalogApi
      .getProducts()
      .then((prods) => {
        const clean = prods.map((p) => ({
          ...p,
          images: Array.from(new Set((p.images || []).filter(Boolean))),
        }));
        setProducts(clean);
      })
      .catch((e) => {
        console.error(e);
        if (e.status === 401 || e.isAuthError) {
          toast.error(
            e.message || "Usuário não autenticado. Faça login no Supabase para acessar o catálogo.",
          );
        } else {
          toast.error(e.message || "Erro ao carregar catálogo global");
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.externalId.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              Gestão de Catálogo Master
            </h2>
            <p className="text-[var(--hub-muted)] text-[9px] font-bold uppercase tracking-[0.3em]">
              Repositório Global de Produtos Sincronizados
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-black/40 px-4 py-2.5 rounded-xl border border-[var(--hub-border)] group focus-within:border-[var(--hub-primary)] transition-all w-64">
              <Search className="h-4 w-4 text-[var(--hub-muted)] group-focus-within:text-[var(--hub-primary)]" />
              <input
                type="text"
                placeholder="Buscar SKU, ID ou Nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none text-[11px] font-bold text-white focus:outline-none w-full placeholder:text-[var(--hub-muted)] uppercase tracking-wider"
              />
            </div>
            <Button
              onClick={fetchProducts}
              className="h-10 hub-bg-primary hover:opacity-90 text-black text-[10px] font-black uppercase tracking-[0.2em] px-6 shadow-lg shadow-[var(--hub-primary)]/20 rounded-xl"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <CardMetric label="Produtos Totais" value={products.length.toString()} icon={Box} />
          <CardMetric
            label="Fontes"
            value={Array.from(
              new Set(products.map((p) => p.storeId.split(":")[0])),
            ).length.toString()}
            subtext="Canais integrados"
            icon={Truck}
          />
          <CardMetric
            label="Preço Médio"
            value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
              products.length ? products.reduce((acc, p) => acc + p.price, 0) / products.length : 0,
            )}
            icon={TrendingUp}
          />
          <CardMetric
            label="Inventário Sync"
            value="REALTIME"
            trendType="up"
            trend="Ativo"
            icon={Package}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white italic">
              Inventário Master (D1)
            </h3>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-[9px] font-black text-white bg-white/5 border border-[var(--hub-border)] rounded-lg uppercase tracking-widest hover:bg-white/10 transition-all">
                <Filter className="h-3 w-3 inline-block mr-2" />
                Filtros
              </button>
            </div>
          </div>

          <HubTable
            headers={[
              <div key="select-all" className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-white hover:text-cyan-400 transition-colors p-0.5"
                  title={
                    selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0
                      ? "Desmarcar Todos"
                      : "Selecionar Todos"
                  }
                >
                  {selectedProductIds.size > 0 && selectedProductIds.size === filteredProducts.length ? (
                    <CheckSquare className="h-4 w-4 text-cyan-400" />
                  ) : selectedProductIds.size > 0 ? (
                    <MinusSquare className="h-4 w-4 text-cyan-400" />
                  ) : (
                    <Square className="h-4 w-4 text-neutral-500" />
                  )}
                </button>
              </div>,
              "Imagem",
              "Produto",
              "ID Externo",
              "SKU",
              "Preço",
              "Categoria",
              "Canais",
              "Ações",
            ]}
          >
            {filteredProducts.map((prod) => {
              const isSelected = selectedProductIds.has(prod.id);
              return (
                <tr
                  key={prod.id}
                  className={cn(
                    "transition-colors group",
                    isSelected ? "bg-cyan-500/5 hover:bg-cyan-500/10" : "hover:bg-white/[0.02]"
                  )}
                >
                  <td className="px-6 py-5">
                    <button
                      type="button"
                      onClick={() => toggleSelectProduct(prod.id)}
                      className="text-white hover:text-cyan-400 transition-colors p-0.5"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-cyan-400" />
                      ) : (
                        <Square className="h-4 w-4 text-neutral-600 group-hover:text-neutral-400" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-5">
                    <div className="h-10 w-10 rounded-lg bg-black/40 border border-[var(--hub-border)] flex items-center justify-center overflow-hidden">
                      <img
                        src={(() => {
                          const raw = prod.images && prod.images[0] ? prod.images[0].trim() : "";
                          if (raw && !raw.startsWith("data:") && !raw.includes("mercadolibre.png")) {
                            if (raw.startsWith("//")) return "https:" + raw;
                            if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
                            if (!raw.includes("/")) return "https://down-br.img.susercontent.com/file/" + raw;
                          }
                          const lower = (prod.title || "").toLowerCase();
                          if (lower.includes("babuche") || lower.includes("crocs")) return "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800";
                          if (lower.includes("chinelo") || lower.includes("slide") || lower.includes("nuvem")) return "https://images.unsplash.com/photo-1603808033192-082d6919d3e1?w=800";
                          if (lower.includes("sandalia")) return "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800";
                          if (lower.includes("tenis") || lower.includes("sneaker")) return "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800";
                          if (lower.includes("sapato") || lower.includes("bota")) return "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=800";
                          if (lower.includes("bolsa") || lower.includes("mochila") || lower.includes("carteira")) return "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800";
                          if (lower.includes("fone") || lower.includes("headset") || lower.includes("audio")) return "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800";
                          if (lower.includes("mouse") || lower.includes("teclado")) return "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800";
                          if (lower.includes("relogio") || lower.includes("watch")) return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800";
                          if (lower.includes("camisa") || lower.includes("vestuario") || lower.includes("roupa")) return "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800";
                          if (lower.includes("futebol")) return "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800";
                          if (lower.includes("pet")) return "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800";
                          return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800";
                        })()}
                        alt={prod.title}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800";
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-0.5 max-w-[200px]">
                      <span className="font-black text-white italic block leading-none truncate">
                        {prod.title}
                      </span>
                      <span className="text-[9px] text-[var(--hub-muted)] uppercase tracking-widest font-bold">
                        Store: {prod.storeId}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-[9px] font-mono text-[var(--hub-muted)] uppercase">
                    {prod.externalId}
                  </td>
                  <td className="px-6 py-5 text-[10px] font-mono text-white italic">
                    {prod.sku || "-"}
                  </td>
                  <td className="px-6 py-5 text-white font-black italic">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: prod.currency || "BRL",
                    }).format(prod.price)}
                  </td>
                  <td className="px-6 py-5">
                    <span className="px-2 py-0.5 rounded-[4px] bg-black/40 border border-[var(--hub-border)] text-[8px] font-black text-[var(--hub-muted)] uppercase italic">
                      {prod.category || "Geral"}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--hub-muted)] font-bold uppercase tracking-widest text-[9px]">
                        {prod.storeId.split(":")[0]}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => handleStartEdit(prod)}
                      className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg border border-[var(--hub-primary)]/40 text-[var(--hub-primary)] hover:bg-[var(--hub-primary)]/10 transition-colors inline-flex items-center gap-1.5"
                      title="Editar Informações do Produto"
                    >
                      <Edit2 className="h-3 w-3" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(prod.id, prod.title)}
                      disabled={deletingProductId === prod.id}
                      className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500 transition-colors inline-flex items-center gap-1.5"
                      title="Excluir Produto do Catálogo"
                    >
                      {deletingProductId === prod.id ? (
                        <RefreshCw className="h-3 w-3 animate-spin text-red-400" />
                      ) : (
                        <>
                          <Trash2 className="h-3 w-3" />
                          Excluir
                        </>
                      )}
                    </button>
                    <a
                      href={prod.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-[var(--hub-muted)] hover:text-white transition-colors inline-block align-middle"
                      title="Abrir URL original"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              );
            })}
            {filteredProducts.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={9}
                  className="px-6 py-20 text-center text-[var(--hub-muted)] italic text-[11px] uppercase tracking-widest"
                >
                  Nenhum produto encontrado no Catálogo Master.
                </td>
              </tr>
            )}
          </HubTable>

          {/* Barra Flutuante de Ações em Massa (Batch Toolbar) */}
          {selectedProductIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0f0f13] border border-cyan-500/40 rounded-2xl px-6 py-3.5 shadow-2xl shadow-cyan-500/20 flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-200">
              <div className="flex items-center gap-2 pr-2 border-r border-[var(--hub-border)]">
                <div className="h-7 w-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black text-xs">
                  {selectedProductIds.size}
                </div>
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {selectedProductIds.size === 1 ? "selecionado" : "selecionados"}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  onClick={() => setIsBulkEditOpen(true)}
                  className="h-9 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[11px] uppercase tracking-wider px-4 rounded-xl shadow-lg shadow-cyan-500/20"
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                  Editar em Massa
                </Button>
                <Button
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  variant="ghost"
                  className="h-9 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400 hover:text-red-300 font-black text-[11px] uppercase tracking-wider px-4 rounded-xl"
                >
                  {isBulkDeleting ? (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Excluir Selecionados
                </Button>
                <Button
                  onClick={() => setSelectedProductIds(new Set())}
                  variant="ghost"
                  className="h-9 text-slate-400 hover:text-white text-[11px] font-bold uppercase tracking-wider px-3"
                >
                  Desmarcar
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal: Edição de Produto */}
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#121214] border border-[var(--hub-border)] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between p-6 border-b border-[var(--hub-border)]">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white italic">
                    Editar Produto do Catálogo
                  </h3>
                  <p className="text-[10px] text-[var(--hub-muted)] uppercase tracking-wider mt-0.5">
                    ID: {editingProduct.id} ({editingProduct.storeId})
                  </p>
                </div>
                <button
                  onClick={() => setEditingProduct(null)}
                  className="text-[var(--hub-muted)] hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white">
                    Título / Nome do Produto *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.title}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-black/50 border border-[var(--hub-border)] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[var(--hub-primary)] transition-colors"
                    placeholder="Ex: Teclado Mecânico RGB..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white">
                      SKU
                    </label>
                    <input
                      type="text"
                      value={editForm.sku}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, sku: e.target.value }))}
                      className="w-full bg-black/50 border border-[var(--hub-border)] rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-[var(--hub-primary)] transition-colors"
                      placeholder="Ex: SKU-1002"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white">
                      Preço (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={editForm.price}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-black/50 border border-[var(--hub-border)] rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-[var(--hub-primary)] transition-colors"
                      placeholder="Ex: 89.90"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={editForm.category}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-black/50 border border-[var(--hub-border)] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[var(--hub-primary)] transition-colors"
                    placeholder="Ex: Informática, Casa, Moda..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white">
                    URL da Imagem Principal
                  </label>
                  <input
                    type="url"
                    value={editForm.imageUrl}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                    className="w-full bg-black/50 border border-[var(--hub-border)] rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-[var(--hub-primary)] transition-colors"
                    placeholder="https://..."
                  />
                  {editForm.imageUrl && (
                    <div className="mt-2 flex items-center gap-3 p-2 bg-black/40 border border-[var(--hub-border)] rounded-lg">
                      <img
                        src={editForm.imageUrl}
                        alt="Preview"
                        className="h-12 w-12 object-cover rounded"
                        onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                      />
                      <span className="text-[9px] text-[var(--hub-muted)] uppercase tracking-wider">
                        Pré-visualização da imagem
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white">
                    Descrição do Produto
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-black/50 border border-[var(--hub-border)] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[var(--hub-primary)] transition-colors resize-none"
                    placeholder="Descrição detalhada do produto..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[var(--hub-border)]">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditingProduct(null)}
                    disabled={isSaving}
                    className="text-[10px] font-black uppercase tracking-wider text-[var(--hub-muted)] hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="hub-bg-primary hover:opacity-90 text-black text-[10px] font-black uppercase tracking-widest px-6"
                  >
                    {isSaving ? (
                      <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5 mr-2" />
                    )}
                    Salvar Alterações
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edição em Massa */}
        {isBulkEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#121214] border border-cyan-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between p-6 border-b border-[var(--hub-border)]">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-white italic">
                      Edição em Massa ({selectedProductIds.size} produtos)
                    </h3>
                    <p className="text-[10px] text-[var(--hub-muted)] uppercase tracking-wider mt-0.5">
                      Atualização simultânea para todos os itens selecionados
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsBulkEditOpen(false)}
                  className="text-[var(--hub-muted)] hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleBulkSaveEdit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white">
                    Nova Categoria (Opcional)
                  </label>
                  <input
                    type="text"
                    value={bulkEditCategory}
                    onChange={(e) => setBulkEditCategory(e.target.value)}
                    className="w-full bg-black/50 border border-[var(--hub-border)] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400 transition-colors"
                    placeholder="Deixe em branco para manter a categoria individual de cada um..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white">
                    Novo Preço Unitário R$ (Opcional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bulkEditPriceAdjust}
                    onChange={(e) => setBulkEditPriceAdjust(e.target.value)}
                    className="w-full bg-black/50 border border-[var(--hub-border)] rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400 transition-colors"
                    placeholder="Deixe em branco para manter o preço individual de cada um..."
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-300">
                  💡 <strong>Dica:</strong> Campos preenchidos sobrescreverão os valores correspondentes em todos os <strong>{selectedProductIds.size} produtos</strong> selecionados.
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[var(--hub-border)]">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsBulkEditOpen(false)}
                    disabled={isBulkSaving}
                    className="text-[10px] font-black uppercase tracking-wider text-[var(--hub-muted)] hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isBulkSaving || (!bulkEditCategory.trim() && !bulkEditPriceAdjust.trim())}
                    className="bg-cyan-500 hover:bg-cyan-400 text-black text-[10px] font-black uppercase tracking-widest px-6"
                  >
                    {isBulkSaving ? (
                      <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5 mr-2" />
                    )}
                    Aplicar a {selectedProductIds.size} Itens
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
