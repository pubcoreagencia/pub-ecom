import { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { Shell } from "@/components/layout/Shell";
import {
  ArrowLeft,
  Save,
  ExternalLink,
  Eye,
  Smartphone,
  Monitor,
  Palette,
  Layout,
  Type,
  Package,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Check,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Image as ImageIcon,
  Layers,
  Store as StoreIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { catalogApi } from "@/lib/api/catalog";
import {
  StorefrontStore,
  StoreNiche,
  StoreSection,
  StoreSectionType,
  Product,
} from "@/lib/api/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NICHE_PRESETS: Record<
  string,
  { name: string; niche: StoreNiche; primary: string; secondary: string; bg: string; surface: string; text: string }
> = {
  cyber: {
    name: "Cyber Neon Tech",
    niche: "Eletrônicos & Tech",
    primary: "#06b6d4",
    secondary: "#3b82f6",
    bg: "#0a0a0c",
    surface: "#141418",
    text: "#f8fafc",
  },
  luxury: {
    name: "Gold & Editorial Luxury",
    niche: "Moda & Acessórios",
    primary: "#eab308",
    secondary: "#d97706",
    bg: "#0c0a09",
    surface: "#1c1917",
    text: "#fafaf9",
  },
  minimal: {
    name: "Minimalist Streetwear",
    niche: "Moda & Acessórios",
    primary: "#ffffff",
    secondary: "#a1a1aa",
    bg: "#09090b",
    surface: "#18181b",
    text: "#ffffff",
  },
  emerald: {
    name: "Cozy Home & Plants",
    niche: "Casa & Decoração",
    primary: "#10b981",
    secondary: "#059669",
    bg: "#06130d",
    surface: "#0e2017",
    text: "#f0fdf4",
  },
  glam: {
    name: "Glow & Beauty Care",
    niche: "Beleza & Cosméticos",
    primary: "#ec4899",
    secondary: "#a855f7",
    bg: "#140c14",
    surface: "#211221",
    text: "#fdf2f8",
  },
  fire: {
    name: "Athletic Fire Sport",
    niche: "Esportes & Fitness",
    primary: "#f97316",
    secondary: "#e11d48",
    bg: "#140c0c",
    surface: "#241212",
    text: "#fff7ed",
  },
};

export default function StoreDetailPage() {
  const params = useParams({ strict: false }) as { storeId?: string };
  const storeId = params.storeId || "";

  const [store, setStore] = useState<StorefrontStore | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"identity" | "palette" | "sections" | "products">(
    "sections",
  );
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [productSearch, setProductSearch] = useState("");
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>("sec-hero");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [storeData, productsData] = await Promise.all([
          catalogApi.getStorefront(storeId),
          catalogApi.getProducts().catch(() => []),
        ]);

        if (storeData) {
          setStore(storeData);
        } else {
          // If not found, create a fallback or default
          const fallback = await catalogApi.createStorefront({
            id: storeId,
            name: "Minha Loja Vitrine",
            slug: storeId,
          });
          setStore(fallback);
        }
        setAllProducts(productsData);
      } catch (err: any) {
        toast.error("Erro ao carregar loja.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [storeId]);

  const handleSave = async () => {
    if (!store) return;
    setSaving(true);
    try {
      await catalogApi.updateStorefront(store.id, store);
      toast.success("Vitrine e tema salvos com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar vitrine.");
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (presetKey: string) => {
    if (!store) return;
    const p = NICHE_PRESETS[presetKey];
    if (!p) return;
    setStore({
      ...store,
      niche: p.niche,
      colors: {
        ...store.colors,
        primary: p.primary,
        secondary: p.secondary,
        background: p.bg,
        surface: p.surface,
        text: p.text,
      },
    });
    toast.success(`Preset visual "${p.name}" aplicado!`);
  };

  // Sections management
  const moveSection = (index: number, direction: "up" | "down") => {
    if (!store) return;
    const newSections = [...store.sections];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const moved = newSections[index];
    if (!moved) return;
    newSections.splice(index, 1);
    newSections.splice(targetIndex, 0, moved);
    setStore({ ...store, sections: newSections });
  };

  const toggleSection = (id: string) => {
    if (!store) return;
    setStore({
      ...store,
      sections: store.sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    });
  };

  const updateSectionContent = (id: string, key: string, value: any) => {
    if (!store) return;
    setStore({
      ...store,
      sections: store.sections.map((s) =>
        s.id === id ? { ...s, content: { ...s.content, [key]: value } } : s,
      ),
    });
  };

  // Product mirroring
  const toggleAssignedProduct = (productId: string) => {
    if (!store) return;
    const current = store.assignedProductIds || [];
    const updated = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    setStore({ ...store, assignedProductIds: updated });
  };

  const toggleSelectAllProducts = () => {
    if (!store) return;
    if (store.assignedProductIds.length === allProducts.length) {
      setStore({ ...store, assignedProductIds: [] });
    } else {
      setStore({ ...store, assignedProductIds: allProducts.map((p) => p.id) });
    }
  };

  if (loading || !store) {
    return (
      <Shell>
        <div className="h-96 flex flex-col items-center justify-center gap-3 text-[var(--hub-muted)]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--hub-primary)]" />
          <p className="text-xs uppercase font-bold tracking-widest">Carregando construtor de personalização...</p>
        </div>
      </Shell>
    );
  }

  const liveUrl = `/store?storeId=${store.id}`;
  const displayedProducts =
    store.assignedProductIds && store.assignedProductIds.length > 0
      ? allProducts.filter((p) => store.assignedProductIds.includes(p.id))
      : allProducts.slice(0, 8);

  const filteredCatalogProducts = allProducts.filter((p) =>
    (p.title || "").toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.category || "").toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <Shell>
      <div className="space-y-6">
        {/* Top App Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-black/40 p-4 rounded-2xl border border-[var(--hub-border)]">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard/stores"
              className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-[var(--hub-border)] flex items-center justify-center text-slate-300 hover:text-white transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black text-white italic tracking-tight uppercase">
                  {store.name}
                </h1>
                <span
                  onClick={() =>
                    setStore({
                      ...store,
                      status: store.status === "published" ? "draft" : "published",
                    })
                  }
                  className={cn(
                    "cursor-pointer text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition-all",
                    store.status === "published"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                      : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      store.status === "published" ? "bg-emerald-400" : "bg-yellow-400",
                    )}
                  />
                  {store.status === "published" ? "Publicada (Online)" : "Rascunho (Privada)"}
                </span>
              </div>
              <p className="text-[11px] text-[var(--hub-muted)] font-mono">
                Vitrine: /store/{store.slug}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Viewport controls for preview */}
            <div className="hidden sm:flex items-center bg-black/60 p-1 rounded-xl border border-[var(--hub-border)]">
              <button
                onClick={() => setPreviewDevice("desktop")}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  previewDevice === "desktop"
                    ? "bg-white/10 text-cyan-400 shadow-sm"
                    : "text-slate-400 hover:text-white",
                )}
                title="Visualização Desktop"
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPreviewDevice("mobile")}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  previewDevice === "mobile"
                    ? "bg-white/10 text-cyan-400 shadow-sm"
                    : "text-slate-400 hover:text-white",
                )}
                title="Visualização Mobile"
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>

            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-[var(--hub-border)] text-white text-xs font-bold uppercase tracking-wider transition-all"
            >
              <ExternalLink className="h-4 w-4 text-cyan-400" />
              Ver ao Vivo
            </a>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="hub-bg-primary text-black font-black text-xs uppercase tracking-widest px-6 h-10 rounded-xl shadow-lg shadow-[var(--hub-primary)]/20 hover:scale-105 transition-all"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>

        {/* Builder Workspace: Split Screen */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[820px]">
          {/* Left Panel: Shopify Customizer Controls */}
          <div className="lg:col-span-5 bg-black/40 border border-[var(--hub-border)] rounded-3xl p-6 flex flex-col space-y-6">
            {/* Customizer Tabs */}
            <div className="grid grid-cols-4 gap-1 bg-black/60 p-1.5 rounded-2xl border border-[var(--hub-border)]">
              <button
                onClick={() => setActiveTab("sections")}
                className={cn(
                  "py-2 px-1 text-center rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1",
                  activeTab === "sections"
                    ? "bg-[var(--hub-primary)] text-black shadow-md"
                    : "text-[var(--hub-muted)] hover:text-white",
                )}
              >
                <Layout className="h-4 w-4" />
                Seções
              </button>
              <button
                onClick={() => setActiveTab("palette")}
                className={cn(
                  "py-2 px-1 text-center rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1",
                  activeTab === "palette"
                    ? "bg-[var(--hub-primary)] text-black shadow-md"
                    : "text-[var(--hub-muted)] hover:text-white",
                )}
              >
                <Palette className="h-4 w-4" />
                Cores
              </button>
              <button
                onClick={() => setActiveTab("identity")}
                className={cn(
                  "py-2 px-1 text-center rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1",
                  activeTab === "identity"
                    ? "bg-[var(--hub-primary)] text-black shadow-md"
                    : "text-[var(--hub-muted)] hover:text-white",
                )}
              >
                <StoreIcon className="h-4 w-4" />
                Marca
              </button>
              <button
                onClick={() => setActiveTab("products")}
                className={cn(
                  "py-2 px-1 text-center rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1",
                  activeTab === "products"
                    ? "bg-[var(--hub-primary)] text-black shadow-md"
                    : "text-[var(--hub-muted)] hover:text-white",
                )}
              >
                <Package className="h-4 w-4" />
                Espelhar
              </button>
            </div>

            {/* TAB 1: SECTIONS BUILDER (Shopify Style) */}
            {activeTab === "sections" && (
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                    Estrutura da Vitrine (Clica e Arrasta)
                  </span>
                  <span className="text-[10px] text-[var(--hub-muted)] uppercase">
                    {store.sections.length} blocos
                  </span>
                </div>

                <div className="space-y-3">
                  {store.sections.map((section, idx) => {
                    const isExpanded = expandedSectionId === section.id;
                    return (
                      <div
                        key={section.id}
                        className={cn(
                          "bg-black/50 border rounded-2xl p-4 transition-all",
                          section.enabled
                            ? "border-[var(--hub-border)] hover:border-cyan-500/40"
                            : "border-red-900/30 opacity-60",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {/* Move buttons */}
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => moveSection(idx, "up")}
                                disabled={idx === 0}
                                className="text-slate-500 hover:text-cyan-400 disabled:opacity-20 transition-colors"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => moveSection(idx, "down")}
                                disabled={idx === store.sections.length - 1}
                                className="text-slate-500 hover:text-cyan-400 disabled:opacity-20 transition-colors"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div>
                              <p className="text-xs font-black text-white uppercase tracking-tight">
                                {section.title}
                              </p>
                              <p className="text-[9px] text-[var(--hub-muted)] uppercase font-mono">
                                Tipo: {section.type}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleSection(section.id)}
                              className={cn(
                                "text-[10px] font-black uppercase px-2 py-1 rounded-md transition-all",
                                section.enabled
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                  : "bg-red-500/10 text-red-400 border border-red-500/30",
                              )}
                            >
                              {section.enabled ? "Ativo" : "Oculto"}
                            </button>
                            <button
                              onClick={() =>
                                setExpandedSectionId(isExpanded ? null : section.id)
                              }
                              className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white"
                            >
                              <Sliders className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Section Content Editor */}
                        {isExpanded && (
                          <div className="mt-4 pt-3 border-t border-[var(--hub-border)] space-y-3 animate-in fade-in duration-200">
                            {section.type === "announcement" && (
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-300 uppercase">
                                  Texto do Anúncio Topo
                                </label>
                                <input
                                  type="text"
                                  value={section.content?.message || ""}
                                  onChange={(e) =>
                                    updateSectionContent(section.id, "message", e.target.value)
                                  }
                                  className="w-full bg-black/70 border border-[var(--hub-border)] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                                />
                              </div>
                            )}

                            {section.type === "hero" && (
                              <div className="space-y-3">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-300 uppercase">
                                    Título Principal (Headline)
                                  </label>
                                  <input
                                    type="text"
                                    value={section.content?.headline || ""}
                                    onChange={(e) =>
                                      updateSectionContent(section.id, "headline", e.target.value)
                                    }
                                    className="w-full bg-black/70 border border-[var(--hub-border)] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-300 uppercase">
                                    Subtítulo
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={section.content?.subheadline || ""}
                                    onChange={(e) =>
                                      updateSectionContent(section.id, "subheadline", e.target.value)
                                    }
                                    className="w-full bg-black/70 border border-[var(--hub-border)] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 resize-none"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-300 uppercase">
                                      Texto do Botão (CTA)
                                    </label>
                                    <input
                                      type="text"
                                      value={section.content?.ctaText || ""}
                                      onChange={(e) =>
                                        updateSectionContent(section.id, "ctaText", e.target.value)
                                      }
                                      className="w-full bg-black/70 border border-[var(--hub-border)] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-300 uppercase">
                                      Tag / Badge Superior
                                    </label>
                                    <input
                                      type="text"
                                      value={section.content?.badge || ""}
                                      onChange={(e) =>
                                        updateSectionContent(section.id, "badge", e.target.value)
                                      }
                                      className="w-full bg-black/70 border border-[var(--hub-border)] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {section.type === "benefits" && (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-300 uppercase">Vantagem 1</label>
                                  <input
                                    type="text"
                                    value={section.content?.b1Title || ""}
                                    onChange={(e) => updateSectionContent(section.id, "b1Title", e.target.value)}
                                    className="w-full bg-black/70 border border-[var(--hub-border)] rounded-lg px-2.5 py-1 text-xs text-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-300 uppercase">Vantagem 2</label>
                                  <input
                                    type="text"
                                    value={section.content?.b2Title || ""}
                                    onChange={(e) => updateSectionContent(section.id, "b2Title", e.target.value)}
                                    className="w-full bg-black/70 border border-[var(--hub-border)] rounded-lg px-2.5 py-1 text-xs text-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-300 uppercase">Vantagem 3</label>
                                  <input
                                    type="text"
                                    value={section.content?.b3Title || ""}
                                    onChange={(e) => updateSectionContent(section.id, "b3Title", e.target.value)}
                                    className="w-full bg-black/70 border border-[var(--hub-border)] rounded-lg px-2.5 py-1 text-xs text-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-300 uppercase">Vantagem 4</label>
                                  <input
                                    type="text"
                                    value={section.content?.b4Title || ""}
                                    onChange={(e) => updateSectionContent(section.id, "b4Title", e.target.value)}
                                    className="w-full bg-black/70 border border-[var(--hub-border)] rounded-lg px-2.5 py-1 text-xs text-white"
                                  />
                                </div>
                              </div>
                            )}

                            {section.type === "featured_products" && (
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-300 uppercase">
                                  Título da Vitrine
                                </label>
                                <input
                                  type="text"
                                  value={section.content?.headline || "Destaques Exclusivos"}
                                  onChange={(e) =>
                                    updateSectionContent(section.id, "headline", e.target.value)
                                  }
                                  className="w-full bg-black/70 border border-[var(--hub-border)] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                                />
                              </div>
                            )}

                            {section.type === "newsletter" && (
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-300 uppercase">
                                  Chamada de Captura
                                </label>
                                <input
                                  type="text"
                                  value={section.content?.headline || ""}
                                  onChange={(e) =>
                                    updateSectionContent(section.id, "headline", e.target.value)
                                  }
                                  className="w-full bg-black/70 border border-[var(--hub-border)] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: PALETTE BUILDER (Procedural) */}
            {activeTab === "palette" && (
              <div className="space-y-6 flex-1 overflow-y-auto pr-1">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-300 block mb-2">
                    Presets Visuais por Nicho (1-Clique)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(NICHE_PRESETS).map(([key, p]) => (
                      <button
                        key={key}
                        onClick={() => applyPreset(key)}
                        className="bg-black/50 border border-[var(--hub-border)] hover:border-cyan-500/50 p-3 rounded-xl text-left transition-all group"
                      >
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.primary }} />
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.secondary }} />
                          <div className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: p.bg }} />
                        </div>
                        <p className="text-[11px] font-black text-white group-hover:text-cyan-400 transition-colors truncate">
                          {p.name}
                        </p>
                        <p className="text-[9px] text-[var(--hub-muted)] uppercase truncate">
                          {p.niche}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-[var(--hub-border)]">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-300 block">
                    Ajuste Fino da Paleta Procedural
                  </span>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-300 uppercase">Cor Primária (CTA)</label>
                      <div className="flex items-center gap-2 bg-black/60 p-2 rounded-xl border border-[var(--hub-border)]">
                        <input
                          type="color"
                          value={store.colors.primary}
                          onChange={(e) =>
                            setStore({ ...store, colors: { ...store.colors, primary: e.target.value } })
                          }
                          className="h-7 w-7 rounded-lg border-0 bg-transparent cursor-pointer"
                        />
                        <span className="text-xs font-mono text-slate-300 uppercase">{store.colors.primary}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-300 uppercase">Cor Secundária</label>
                      <div className="flex items-center gap-2 bg-black/60 p-2 rounded-xl border border-[var(--hub-border)]">
                        <input
                          type="color"
                          value={store.colors.secondary}
                          onChange={(e) =>
                            setStore({ ...store, colors: { ...store.colors, secondary: e.target.value } })
                          }
                          className="h-7 w-7 rounded-lg border-0 bg-transparent cursor-pointer"
                        />
                        <span className="text-xs font-mono text-slate-300 uppercase">{store.colors.secondary}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-300 uppercase">Cor de Fundo (Canvas)</label>
                      <div className="flex items-center gap-2 bg-black/60 p-2 rounded-xl border border-[var(--hub-border)]">
                        <input
                          type="color"
                          value={store.colors.background}
                          onChange={(e) =>
                            setStore({ ...store, colors: { ...store.colors, background: e.target.value } })
                          }
                          className="h-7 w-7 rounded-lg border-0 bg-transparent cursor-pointer"
                        />
                        <span className="text-xs font-mono text-slate-300 uppercase">{store.colors.background}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-300 uppercase">Superfície / Cards</label>
                      <div className="flex items-center gap-2 bg-black/60 p-2 rounded-xl border border-[var(--hub-border)]">
                        <input
                          type="color"
                          value={store.colors.surface}
                          onChange={(e) =>
                            setStore({ ...store, colors: { ...store.colors, surface: e.target.value } })
                          }
                          className="h-7 w-7 rounded-lg border-0 bg-transparent cursor-pointer"
                        />
                        <span className="text-xs font-mono text-slate-300 uppercase">{store.colors.surface}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: BRAND IDENTITY */}
            {activeTab === "identity" && (
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Nome da Vitrine
                  </label>
                  <input
                    type="text"
                    value={store.name}
                    onChange={(e) => setStore({ ...store, name: e.target.value })}
                    className="w-full bg-black/60 border border-[var(--hub-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    URL da Logomarca (PNG transparente recomendado)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={store.logoUrl || ""}
                      onChange={(e) => setStore({ ...store, logoUrl: e.target.value })}
                      className="flex-1 bg-black/60 border border-[var(--hub-border)] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  {store.logoUrl && (
                    <div className="p-3 bg-black/40 rounded-xl border border-[var(--hub-border)] flex items-center gap-3">
                      <img
                        src={store.logoUrl}
                        alt="Logo preview"
                        className="h-10 w-10 object-contain rounded-lg bg-white/5 p-1 border border-white/10"
                      />
                      <span className="text-xs text-slate-400">Prévia do logotipo</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    URL da Imagem do Banner Hero
                  </label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={store.bannerUrl || ""}
                    onChange={(e) => setStore({ ...store, bannerUrl: e.target.value })}
                    className="w-full bg-black/60 border border-[var(--hub-border)] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Descrição / Slogan
                  </label>
                  <textarea
                    rows={3}
                    value={store.description || ""}
                    onChange={(e) => setStore({ ...store, description: e.target.value })}
                    className="w-full bg-black/60 border border-[var(--hub-border)] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 resize-none"
                  />
                </div>
              </div>
            )}

            {/* TAB 4: MIRRORED PRODUCTS */}
            {activeTab === "products" && (
              <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300 block">
                      Espelhar Produtos dos Fornecedores
                    </span>
                    <span className="text-[10px] text-[var(--hub-muted)]">
                      {store.assignedProductIds.length} produtos selecionados para esta vitrine
                    </span>
                  </div>
                  <button
                    onClick={toggleSelectAllProducts}
                    className="text-[10px] font-black uppercase text-cyan-400 hover:underline"
                  >
                    {store.assignedProductIds.length === allProducts.length
                      ? "Desmarcar Todos"
                      : "Selecionar Todos"}
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Filtrar produtos por título ou categoria..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full bg-black/60 border border-[var(--hub-border)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {filteredCatalogProducts.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[var(--hub-muted)]">
                      Nenhum produto encontrado. Importe produtos na aba Fornecedores.
                    </div>
                  ) : (
                    filteredCatalogProducts.map((p) => {
                      const isSelected = store.assignedProductIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleAssignedProduct(p.id)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                            isSelected
                              ? "bg-cyan-500/10 border-cyan-500/40 text-white"
                              : "bg-black/30 border-[var(--hub-border)] text-slate-400 hover:border-white/20",
                          )}
                        >
                          <div
                            className={cn(
                              "h-5 w-5 rounded-md flex items-center justify-center border transition-all",
                              isSelected
                                ? "bg-cyan-400 border-cyan-400 text-black font-black"
                                : "border-slate-600 bg-black/40",
                            )}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </div>

                          {p.images && p.images[0] ? (
                            <img
                              src={p.images[0]}
                              alt={p.title}
                              className="h-10 w-10 object-cover rounded-lg bg-black border border-[var(--hub-border)]"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center">
                              <Package className="h-5 w-5 text-slate-500" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{p.title}</p>
                            <p className="text-[10px] text-[var(--hub-muted)]">
                              R$ {Number(p.price || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Interactive Live Preview */}
          <div className="lg:col-span-7 bg-black/60 border border-[var(--hub-border)] rounded-3xl overflow-hidden flex flex-col">
            {/* Preview Browser Header */}
            <div className="h-12 bg-black/80 border-b border-[var(--hub-border)] px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/80 inline-block" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
              </div>
              <div className="bg-black/90 px-4 py-1 rounded-lg border border-[var(--hub-border)] text-[11px] font-mono text-slate-400 flex items-center gap-2">
                <span className="text-emerald-400 font-bold">https://pub-ecom.store</span>
                <span>/store/{store.slug}</span>
              </div>
              <div className="text-[10px] uppercase font-black text-cyan-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                Live Preview
              </div>
            </div>

            {/* Render Container */}
            <div className="flex-1 overflow-y-auto flex items-start justify-center p-4 bg-neutral-950/80">
              <div
                className={cn(
                  "transition-all duration-300 shadow-2xl rounded-2xl overflow-hidden border border-white/10",
                  previewDevice === "mobile" ? "w-[390px] min-h-[750px]" : "w-full min-h-[750px]",
                )}
                style={{
                  backgroundColor: store.colors.background,
                  color: store.colors.text,
                }}
              >
                {/* 1. Announcement Bar */}
                {store.sections.find((s) => s.type === "announcement")?.enabled && (
                  <div
                    className="py-2.5 px-4 text-center text-xs font-black tracking-widest uppercase transition-colors"
                    style={{
                      backgroundColor: store.colors.primary,
                      color: "#000000",
                    }}
                  >
                    {store.sections.find((s) => s.type === "announcement")?.content?.message ||
                      "⚡ FRETE GRÁTIS EM TODA A LOJA"}
                  </div>
                )}

                {/* 2. Header */}
                <header
                  className="px-6 py-4 border-b flex items-center justify-between backdrop-blur-md sticky top-0 z-30"
                  style={{
                    backgroundColor: `${store.colors.background}cc`,
                    borderColor: store.colors.border,
                  }}
                >
                  <div className="flex items-center gap-3">
                    {store.logoUrl ? (
                      <img src={store.logoUrl} alt={store.name} className="h-8 max-w-[120px] object-contain" />
                    ) : (
                      <div
                        className="h-8 px-2.5 rounded-lg font-black text-xs flex items-center justify-center text-black"
                        style={{ backgroundColor: store.colors.primary }}
                      >
                        {store.name.slice(0, 3).toUpperCase()}
                      </div>
                    )}
                    <span className="font-black text-sm tracking-tight uppercase">{store.name}</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="opacity-70 hover:opacity-100 cursor-pointer">Catálogo</span>
                    <span className="opacity-70 hover:opacity-100 cursor-pointer">Ofertas</span>
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-black text-xs font-black shadow-md"
                      style={{ backgroundColor: store.colors.primary }}
                    >
                      🛒
                    </div>
                  </div>
                </header>

                {/* 3. Hero Banner */}
                {store.sections.find((s) => s.type === "hero")?.enabled && (
                  <div
                    className="relative py-20 px-8 text-center overflow-hidden border-b"
                    style={{
                      borderColor: store.colors.border,
                      backgroundImage: store.bannerUrl
                        ? `linear-gradient(to bottom, rgba(0,0,0,0.65), rgba(0,0,0,0.85)), url(${store.bannerUrl})`
                        : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <div className="max-w-xl mx-auto space-y-4 relative z-10">
                      <span
                        className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                        style={{
                          backgroundColor: `${store.colors.primary}20`,
                          color: store.colors.primary,
                          border: `1px solid ${store.colors.primary}40`,
                        }}
                      >
                        {store.sections.find((s) => s.type === "hero")?.content?.badge || "Destaque Oficial"}
                      </span>

                      <h2 className="text-3xl sm:text-4xl font-black italic tracking-tight uppercase leading-none">
                        {store.sections.find((s) => s.type === "hero")?.content?.headline ||
                          "O MELHOR DO MERCADO NA SUA CASA"}
                      </h2>

                      <p className="text-xs uppercase tracking-wider opacity-70 leading-relaxed">
                        {store.sections.find((s) => s.type === "hero")?.content?.subheadline ||
                          store.description}
                      </p>

                      <div className="pt-2">
                        <button
                          className="px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-black shadow-xl hover:scale-105 transition-all"
                          style={{ backgroundColor: store.colors.primary }}
                        >
                          {store.sections.find((s) => s.type === "hero")?.content?.ctaText || "Comprar Agora"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Benefits Section */}
                {store.sections.find((s) => s.type === "benefits")?.enabled && (
                  <div
                    className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 border-b text-center text-xs"
                    style={{
                      backgroundColor: store.colors.surface,
                      borderColor: store.colors.border,
                    }}
                  >
                    <div>
                      <p className="font-black uppercase text-[11px]">
                        {store.sections.find((s) => s.type === "benefits")?.content?.b1Title || "Envio Imediato"}
                      </p>
                      <p className="text-[10px] opacity-60">Para todo o Brasil</p>
                    </div>
                    <div>
                      <p className="font-black uppercase text-[11px]">
                        {store.sections.find((s) => s.type === "benefits")?.content?.b2Title || "Garantia Total"}
                      </p>
                      <p className="text-[10px] opacity-60">30 dias sem custo</p>
                    </div>
                    <div>
                      <p className="font-black uppercase text-[11px]">
                        {store.sections.find((s) => s.type === "benefits")?.content?.b3Title || "Compra Segura"}
                      </p>
                      <p className="text-[10px] opacity-60">Criptografia SSL</p>
                    </div>
                    <div>
                      <p className="font-black uppercase text-[11px]">
                        {store.sections.find((s) => s.type === "benefits")?.content?.b4Title || "Suporte 24h"}
                      </p>
                      <p className="text-[10px] opacity-60">Via WhatsApp</p>
                    </div>
                  </div>
                )}

                {/* 5. Featured Products Grid */}
                {store.sections.find((s) => s.type === "featured_products")?.enabled && (
                  <div className="p-8 space-y-6">
                    <div className="text-center space-y-1">
                      <h3 className="text-2xl font-black italic tracking-tight uppercase">
                        {store.sections.find((s) => s.type === "featured_products")?.content?.headline ||
                          "Vitrine Selecionada"}
                      </h3>
                      <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">
                        Espelhado diretamente da rede de fornecedores
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {displayedProducts.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-2xl border p-4 flex flex-col justify-between group transition-all"
                          style={{
                            backgroundColor: store.colors.surface,
                            borderColor: store.colors.border,
                          }}
                        >
                          <div className="aspect-square rounded-xl overflow-hidden bg-black/40 mb-3 relative">
                            {p.images && p.images[0] ? (
                              <img
                                src={p.images[0]}
                                alt={p.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-8 w-8 opacity-40" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase truncate mb-1">{p.title}</p>
                            <p
                              className="text-sm font-black italic"
                              style={{ color: store.colors.primary }}
                            >
                              R$ {Number(p.price || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Footer */}
                <footer
                  className="p-6 border-t text-center text-[10px] space-y-3"
                  style={{
                    backgroundColor: store.colors.surface,
                    borderColor: store.colors.border,
                  }}
                >
                  <div className="flex flex-wrap items-center justify-center gap-4 text-slate-400 font-bold uppercase">
                    <span>Sobre Nós</span>
                    <span>•</span>
                    <span>Rastrear Pedido</span>
                    <span>•</span>
                    <span>Trocas & Devoluções</span>
                    <span>•</span>
                    <span>Privacidade LGPD</span>
                  </div>
                  <p className="opacity-60 uppercase font-bold tracking-widest">
                    © 2026 {store.name} · Powered by PUB ECOM Hub
                  </p>
                </footer>

                {/* Floating WhatsApp Preview */}
                <div className="sticky bottom-4 right-4 flex justify-end px-4 pb-2 pointer-events-none">
                  <div className="bg-emerald-500 text-black px-3 py-2 rounded-full font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-xl">
                    <span className="h-2 w-2 rounded-full bg-black animate-pulse" />
                    <span>WhatsApp</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
