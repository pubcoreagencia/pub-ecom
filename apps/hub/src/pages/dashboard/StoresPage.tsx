import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Link } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Store as StoreIcon,
  Layers,
  Sparkles,
  ExternalLink,
  Sliders,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Eye,
  CheckCircle2,
  Clock,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { catalogApi } from "@/lib/api/catalog";
import { StorefrontStore, StoreNiche, StoreColors } from "@/lib/api/types";
import { STORE_TEMPLATES, StoreTemplateDef } from "@/lib/templates/storeTemplates";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NICHES: StoreNiche[] = [
  "Mulher & Beleza",
  "Pet Shop & Cuidados",
  "Fitness & Academia",
  "Saúde & Bem-Estar",
  "Criança & Bebê",
  "Vestuário & Streetwear",
  "Futebol & Artigos Esportivos",
  "Tecnologia & Gadgets",
  "Casa & Decoração",
  "Joias & Luxo",
  "Gamer & Setup",
  "Automotivo & Ferramentas",
  "Eletrônicos & Tech",
  "Moda & Acessórios",
  "Beleza & Cosméticos",
  "Esportes & Fitness",
  "Geral & Variedades",
];

const NICHE_PALETTES: Record<StoreNiche, { primary: string; secondary: string; bg: string }> = {
  "Mulher & Beleza": { primary: "#f43f5e", secondary: "#fb7185", bg: "#0f0b0d" },
  "Pet Shop & Cuidados": { primary: "#f59e0b", secondary: "#10b981", bg: "#0d0e11" },
  "Fitness & Academia": { primary: "#ef4444", secondary: "#f97316", bg: "#08080a" },
  "Saúde & Bem-Estar": { primary: "#10b981", secondary: "#06b6d4", bg: "#080f0c" },
  "Criança & Bebê": { primary: "#06b6d4", secondary: "#f472b6", bg: "#0c0f14" },
  "Vestuário & Streetwear": { primary: "#a855f7", secondary: "#e2e8f0", bg: "#09090b" },
  "Futebol & Artigos Esportivos": { primary: "#22c55e", secondary: "#eab308", bg: "#0a0f0d" },
  "Tecnologia & Gadgets": { primary: "#38bdf8", secondary: "#6366f1", bg: "#060913" },
  "Casa & Decoração": { primary: "#14b8a6", secondary: "#f59e0b", bg: "#0c0d10" },
  "Joias & Luxo": { primary: "#eab308", secondary: "#ca8a04", bg: "#090806" },
  "Gamer & Setup": { primary: "#8b5cf6", secondary: "#06b6d4", bg: "#090712" },
  "Automotivo & Ferramentas": { primary: "#ea580c", secondary: "#64748b", bg: "#0b0c0e" },
  "Eletrônicos & Tech": { primary: "#06b6d4", secondary: "#3b82f6", bg: "#0a0a0c" },
  "Moda & Acessórios": { primary: "#eab308", secondary: "#d97706", bg: "#0c0a09" },
  "Beleza & Cosméticos": { primary: "#ec4899", secondary: "#a855f7", bg: "#140c14" },
  "Esportes & Fitness": { primary: "#f97316", secondary: "#e11d48", bg: "#140c0c" },
  "Geral & Variedades": { primary: "#38bdf8", secondary: "#6366f1", bg: "#09090b" },
};

export default function StoresPage() {
  const [storefronts, setStorefronts] = useState<StorefrontStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNiche, setSelectedNiche] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"stores" | "templates">("stores");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [storeNiche, setStoreNiche] = useState<StoreNiche>("Eletrônicos & Tech");
  const [storeDesc, setStoreDesc] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<StoreTemplateDef | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchStorefronts = async () => {
    try {
      const data = await catalogApi.getStorefronts();
      setStorefronts(data);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Falha ao carregar lojas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStorefronts();
  }, []);

  const handleNameChange = (val: string) => {
    setStoreName(val);
    setStoreSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-"),
    );
  };

  const handleCreateStorefront = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      toast.error("Informe o nome da loja.");
      return;
    }

    setIsSubmitting(true);
    try {
      const palette: StoreColors = selectedTemplate?.colors || {
        primary: NICHE_PALETTES[storeNiche].primary,
        secondary: NICHE_PALETTES[storeNiche].secondary,
        background: NICHE_PALETTES[storeNiche].bg,
        surface: "#18181b",
        text: "#fafafa",
        textMuted: "#a1a1aa",
        border: "#27272a",
      };
      const newStore = await catalogApi.createStorefront({
        name: storeName.trim(),
        slug: storeSlug.trim() || storeName.trim().toLowerCase().replace(/[^a-z0-9]/g, "-"),
        niche: storeNiche,
        description: storeDesc.trim() || `Loja oficial de ${storeNiche}.`,
        colors: palette,
        ...(selectedTemplate?.id ? { templateId: selectedTemplate.id } : {}),
        ...(selectedTemplate?.previewImage ? { bannerUrl: selectedTemplate.previewImage } : {}),
        ...(selectedTemplate?.defaultSections ? { sections: selectedTemplate.defaultSections } : {}),
      });

      toast.success(`Loja "${newStore.name}" criada com sucesso!`);
      setIsModalOpen(false);
      setStoreName("");
      setStoreSlug("");
      setStoreDesc("");
      setSelectedTemplate(null);
      await fetchStorefronts();
      setActiveTab("stores");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar loja.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseTemplate = async (template: StoreTemplateDef) => {
    setIsSubmitting(true);
    try {
      const generatedSlug = `${template.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString().slice(-4)}`;
      const newStore = await catalogApi.createStorefront({
        name: template.name,
        slug: generatedSlug,
        niche: template.niche,
        description: template.subheadline,
        templateId: template.id,
        bannerUrl: template.previewImage,
        colors: template.colors,
        sections: template.defaultSections,
      });

      toast.success(`Loja "${newStore.name}" criada a partir do template ${template.niche}!`);
      await fetchStorefronts();
      setActiveTab("stores");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar loja a partir do template.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomizeTemplate = (template: StoreTemplateDef) => {
    setStoreName(template.name);
    setStoreSlug(template.name.toLowerCase().replace(/[^a-z0-9]/g, "-"));
    setStoreNiche(template.niche);
    setStoreDesc(template.subheadline);
    setSelectedTemplate(template);
    setIsModalOpen(true);
  };

  const handleDeleteStorefront = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir a loja "${name}"?`)) return;
    try {
      await catalogApi.deleteStorefront(id);
      toast.success("Loja excluída.");
      await fetchStorefronts();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir loja.");
    }
  };

  const filteredStorefronts = storefronts.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.niche.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesNiche = selectedNiche === "all" || s.niche === selectedNiche;
    return matchesSearch && matchesNiche;
  });

  const filteredTemplates = STORE_TEMPLATES.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.niche.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.headline.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesNiche = selectedNiche === "all" || t.niche === selectedNiche;
    return matchesSearch && matchesNiche;
  });

  const totalRevenue = storefronts.reduce((acc, s) => acc + (s.metrics?.revenue || 0), 0);
  const totalOrders = storefronts.reduce((acc, s) => acc + (s.metrics?.orders || 0), 0);
  const totalVisits = storefronts.reduce((acc, s) => acc + (s.metrics?.visits || 0), 0);
  const publishedCount = storefronts.filter((s) => s.status === "published").length;

  return (
    <Shell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--hub-border)] pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <StoreIcon className="h-5 w-5 text-black font-black" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">
                  Lojas dos Clientes
                </h1>
                <p className="text-[12px] font-bold text-[var(--hub-muted)] uppercase tracking-widest mt-0.5">
                  Lojas personalizadas com design procedural, paleta adaptativa e espelhamento de produtos
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                setSelectedTemplate(null);
                setStoreName("");
                setStoreSlug("");
                setStoreDesc("");
                setIsModalOpen(true);
              }}
              className="hub-bg-primary text-black font-black text-[11px] uppercase tracking-widest px-6 h-11 rounded-xl shadow-lg shadow-[var(--hub-primary)]/20 hover:scale-105 transition-all"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Nova Loja
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-black/40 border border-[var(--hub-border)] rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab("stores")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeTab === "stores"
                ? "bg-white text-black shadow-lg shadow-white/10"
                : "text-[var(--hub-muted)] hover:text-white hover:bg-white/5",
            )}
          >
            <StoreIcon className="h-4 w-4" />
            Minhas Lojas ({storefronts.length})
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeTab === "templates"
                ? "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/25"
                : "text-[var(--hub-muted)] hover:text-white hover:bg-white/5",
            )}
          >
            <Sparkles className="h-4 w-4" />
            Galeria de Templates ({STORE_TEMPLATES.length} Nichos)
          </button>
        </div>

        {/* Template Gallery Banner (When on Templates Tab) */}
        {activeTab === "templates" && (
          <div className="hub-card p-6 rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-black to-cyan-950/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                12 Nichos de Alta Conversão
              </span>
              <h2 className="text-xl font-black text-white italic tracking-tight uppercase mt-2">
                Templates Procedurais Prontos Para Escala
              </h2>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Cada template foi desenhado com arquitetura de alta conversão: barra de anúncio de frete grátis, banner hero persuasivo, grade de benefícios homologada e paleta cromática exclusiva de cada mercado.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono font-bold text-cyan-400 bg-black/60 px-3.5 py-2 rounded-xl border border-cyan-500/30">
                ⚡ 1 Clique para Instalar
              </span>
            </div>
          </div>
        )}

        {/* Metrics Cards (Only on Stores Tab) */}
        {activeTab === "stores" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="hub-card p-5 rounded-2xl border border-[var(--hub-border)] bg-black/40 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-[var(--hub-muted)] uppercase tracking-widest">
                  Lojas Ativas
                </p>
                <p className="text-3xl font-black text-white italic tracking-tight mt-1">
                  {publishedCount} <span className="text-xs text-[var(--hub-muted)] font-normal">/ {storefronts.length}</span>
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <StoreIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="hub-card p-5 rounded-2xl border border-[var(--hub-border)] bg-black/40 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-[var(--hub-muted)] uppercase tracking-widest">
                  Faturamento das Lojas
                </p>
                <p className="text-3xl font-black text-emerald-400 italic tracking-tight mt-1">
                  R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <DollarSign className="h-6 w-6" />
              </div>
            </div>

            <div className="hub-card p-5 rounded-2xl border border-[var(--hub-border)] bg-black/40 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-[var(--hub-muted)] uppercase tracking-widest">
                  Pedidos Totais
                </p>
                <p className="text-3xl font-black text-blue-400 italic tracking-tight mt-1">
                  {totalOrders}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <ShoppingBag className="h-6 w-6" />
              </div>
            </div>

            <div className="hub-card p-5 rounded-2xl border border-[var(--hub-border)] bg-black/40 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-[var(--hub-muted)] uppercase tracking-widest">
                  Tráfego Total (Visitas)
                </p>
                <p className="text-3xl font-black text-purple-400 italic tracking-tight mt-1">
                  {totalVisits.toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Eye className="h-6 w-6" />
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-black/30 p-4 rounded-2xl border border-[var(--hub-border)]">
          <div className="flex items-center gap-3 w-full md:w-96 bg-black/50 px-4 py-2.5 rounded-xl border border-[var(--hub-border)] focus-within:border-[var(--hub-primary)] transition-colors">
            <Search className="h-4 w-4 text-[var(--hub-muted)]" />
            <input
              type="text"
              placeholder="Buscar loja por nome, slug ou nicho..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none text-[13px] font-medium text-white focus:outline-none w-full placeholder:text-[var(--hub-muted)]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto no-scrollbar pb-2 md:pb-0">
            <button
              onClick={() => setSelectedNiche("all")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                selectedNiche === "all"
                  ? "bg-white text-black font-black"
                  : "bg-black/40 text-[var(--hub-muted)] hover:text-white border border-[var(--hub-border)]",
              )}
            >
              Todos os Nichos
            </button>
            {NICHES.map((niche) => (
              <button
                key={niche}
                onClick={() => setSelectedNiche(niche)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                  selectedNiche === niche
                    ? "bg-[var(--hub-primary)] text-black font-black"
                    : "bg-black/40 text-[var(--hub-muted)] hover:text-white border border-[var(--hub-border)]",
                )}
              >
                {niche}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area: Stores vs Templates */}
        {activeTab === "stores" ? (
          loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-[var(--hub-muted)]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--hub-primary)]" />
              <p className="text-[12px] uppercase font-bold tracking-widest">Carregando lojas...</p>
            </div>
          ) : filteredStorefronts.length === 0 ? (
            <div className="p-16 border border-dashed border-[var(--hub-border)] rounded-3xl text-center space-y-4 bg-black/20">
              <StoreIcon className="h-12 w-12 text-[var(--hub-muted)] mx-auto opacity-50" />
              <div>
                <h3 className="text-lg font-black text-white uppercase italic">Nenhuma loja encontrada</h3>
                <p className="text-xs text-[var(--hub-muted)] uppercase tracking-wider mt-1">
                  Crie sua primeira loja personalizada ou escolha um template da galeria.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button
                  onClick={() => setIsModalOpen(true)}
                  className="hub-bg-primary text-black font-black text-[11px] uppercase tracking-widest px-6 h-10 rounded-xl"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Loja Agora
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("templates")}
                  className="border-white/10 hover:border-white/30 text-white font-bold text-[11px] uppercase tracking-widest px-6 h-10 rounded-xl"
                >
                  <Sparkles className="h-4 w-4 mr-2 text-cyan-400" />
                  Ver Templates
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredStorefronts.map((store) => {
                const liveUrl = `/store?storeId=${store.id}`;
              return (
                <div
                  key={store.id}
                  className="hub-card rounded-3xl border border-[var(--hub-border)] bg-black/40 p-6 flex flex-col justify-between hover:border-[var(--hub-primary)]/50 transition-all group relative overflow-hidden"
                >
                  {/* Subtle procedural background glow */}
                  <div
                    className="absolute -right-16 -top-16 w-36 h-36 rounded-full blur-3xl opacity-20 pointer-events-none"
                    style={{ backgroundColor: store.colors.primary }}
                  />

                  <div>
                    {/* Top row: Status & Niche */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
                        {store.niche}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5",
                          store.status === "published"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            store.status === "published" ? "bg-emerald-400" : "bg-yellow-400",
                          )}
                        />
                        {store.status === "published" ? "Publicada" : "Rascunho"}
                      </span>
                    </div>

                    {/* Logo & Store Name */}
                    <div className="flex items-center gap-4 mb-4">
                      {store.logoUrl ? (
                        <img
                          src={store.logoUrl}
                          alt={store.name}
                          className="h-14 w-14 rounded-2xl object-cover border border-[var(--hub-border)] bg-white/5"
                        />
                      ) : (
                        <div
                          className="h-14 w-14 rounded-2xl flex items-center justify-center font-black text-xl text-black"
                          style={{ backgroundColor: store.colors.primary }}
                        >
                          {store.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-black text-white italic tracking-tight truncate group-hover:text-[var(--hub-primary)] transition-colors">
                          {store.name}
                        </h3>
                        <p className="text-[11px] text-[var(--hub-muted)] font-mono truncate">
                          /{store.slug}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                      {store.description || "Vitrine personalizada de alta conversão."}
                    </p>

                    {/* Procedural Color Swatches */}
                    <div className="bg-black/30 p-3 rounded-xl border border-[var(--hub-border)] mb-4">
                      <div className="flex items-center justify-between text-[10px] font-bold text-[var(--hub-muted)] uppercase tracking-wider mb-2">
                        <span>Paleta Procedural</span>
                        <span className="font-mono">{store.colors.primary}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-5 w-5 rounded-md shadow-inner border border-white/20"
                          style={{ backgroundColor: store.colors.primary }}
                          title={`Primária: ${store.colors.primary}`}
                        />
                        <div
                          className="h-5 w-5 rounded-md shadow-inner border border-white/20"
                          style={{ backgroundColor: store.colors.secondary }}
                          title={`Secundária: ${store.colors.secondary}`}
                        />
                        <div
                          className="h-5 w-5 rounded-md shadow-inner border border-white/20"
                          style={{ backgroundColor: store.colors.background }}
                          title={`Fundo: ${store.colors.background}`}
                        />
                        <div
                          className="h-5 w-5 rounded-md shadow-inner border border-white/20"
                          style={{ backgroundColor: store.colors.surface }}
                          title={`Superfície: ${store.colors.surface}`}
                        />
                        <div
                          className="h-5 w-5 rounded-md shadow-inner border border-white/20"
                          style={{ backgroundColor: store.colors.text }}
                          title={`Texto: ${store.colors.text}`}
                        />
                        <span className="text-[10px] text-[var(--hub-muted)] ml-auto font-mono">
                          {store.sections.filter((s) => s.enabled).length} seções ativas
                        </span>
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-[var(--hub-border)]/50 text-center mb-5">
                      <div>
                        <p className="text-[9px] font-black text-[var(--hub-muted)] uppercase tracking-wider">
                          Receita
                        </p>
                        <p className="text-xs font-black text-emerald-400 mt-0.5">
                          R$ {(store.metrics?.revenue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-[var(--hub-muted)] uppercase tracking-wider">
                          Pedidos
                        </p>
                        <p className="text-xs font-black text-white mt-0.5">
                          {store.metrics?.orders || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-[var(--hub-muted)] uppercase tracking-wider">
                          Produtos
                        </p>
                        <p className="text-xs font-black text-cyan-400 mt-0.5">
                          {store.assignedProductIds?.length > 0 ? store.assignedProductIds.length : "Todos (Master)"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      to="/dashboard/stores/$storeId"
                      params={{ storeId: store.id }}
                      className="flex-1 inline-flex items-center justify-center h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-[var(--hub-border)] hover:border-cyan-500/50 text-white font-black text-[11px] uppercase tracking-wider transition-all"
                    >
                      <Sliders className="h-3.5 w-3.5 mr-2 text-cyan-400" />
                      Personalizar
                    </Link>

                    <a
                      href={liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-10 px-3.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold text-[11px] uppercase tracking-wider transition-all"
                      title="Abrir Loja ao Vivo"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteStorefront(store.id, store.name)}
                      className="h-10 w-10 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
                      title="Excluir Loja"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            </div>
          )
        ) : (
          /* Galeria de 12 Templates Grid */
          filteredTemplates.length === 0 ? (
            <div className="p-16 border border-dashed border-[var(--hub-border)] rounded-3xl text-center space-y-3 bg-black/20">
              <Sparkles className="h-10 w-10 text-[var(--hub-muted)] mx-auto opacity-40" />
              <h3 className="text-base font-black text-white uppercase italic">Nenhum template encontrado para este filtro</h3>
              <p className="text-xs text-slate-400">Tente buscar por outro termo ou selecionar "Todos os Nichos".</p>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedNiche("all");
                  setSearchTerm("");
                }}
                className="text-xs font-bold uppercase mt-2 border-white/10"
              >
                Limpar Filtros
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredTemplates.map((template) => {
                return (
                  <div
                    key={template.id}
                    className="hub-card rounded-3xl border border-[var(--hub-border)] bg-black/40 overflow-hidden flex flex-col justify-between hover:border-cyan-500/50 transition-all group relative shadow-lg"
                  >
                    {/* Procedural Top Glow */}
                    <div
                      className="absolute -right-16 -top-16 w-44 h-44 rounded-full blur-3xl opacity-20 pointer-events-none"
                      style={{ backgroundColor: template.colors.primary }}
                    />

                    <div>
                      {/* Banner Preview */}
                      <div className="relative aspect-video w-full overflow-hidden bg-black/60 border-b border-[var(--hub-border)]">
                        <img
                          src={template.previewImage}
                          alt={template.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                        <div className="absolute top-3 left-3 flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white">
                            {template.niche}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-cyan-500/20 backdrop-blur-md border border-cyan-500/30 text-cyan-300 font-mono">
                            {template.badge}
                          </span>
                        </div>
                        <div className="absolute bottom-3 left-3 right-3">
                          <h4 className="text-xl font-black text-white italic tracking-tight drop-shadow-md">
                            {template.name}
                          </h4>
                        </div>
                      </div>

                      {/* Info body */}
                      <div className="p-5 space-y-4">
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-wider">
                            {template.headline}
                          </p>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                            {template.subheadline}
                          </p>
                        </div>

                        {/* Announcement Bar Preview */}
                        <div className="bg-black/60 border border-white/10 rounded-xl p-2.5 flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full shrink-0 animate-pulse"
                            style={{ backgroundColor: template.colors.primary }}
                          />
                          <p className="text-[10px] text-slate-300 font-medium truncate">
                            {template.announcement}
                          </p>
                        </div>

                        {/* 4 Benefits Badges */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white/5 border border-white/5 rounded-lg p-2 text-[10px]">
                            <p className="font-bold text-slate-200 truncate">✓ {template.benefits.b1Title}</p>
                            <p className="text-slate-400 truncate text-[9px]">{template.benefits.b1Desc}</p>
                          </div>
                          <div className="bg-white/5 border border-white/5 rounded-lg p-2 text-[10px]">
                            <p className="font-bold text-slate-200 truncate">✓ {template.benefits.b2Title}</p>
                            <p className="text-slate-400 truncate text-[9px]">{template.benefits.b2Desc}</p>
                          </div>
                          <div className="bg-white/5 border border-white/5 rounded-lg p-2 text-[10px]">
                            <p className="font-bold text-slate-200 truncate">✓ {template.benefits.b3Title}</p>
                            <p className="text-slate-400 truncate text-[9px]">{template.benefits.b3Desc}</p>
                          </div>
                          <div className="bg-white/5 border border-white/5 rounded-lg p-2 text-[10px]">
                            <p className="font-bold text-slate-200 truncate">✓ {template.benefits.b4Title}</p>
                            <p className="text-slate-400 truncate text-[9px]">{template.benefits.b4Desc}</p>
                          </div>
                        </div>

                        {/* Procedural Colors */}
                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-white/5">
                          <span className="uppercase font-bold tracking-wider">Paleta do Nicho:</span>
                          <div className="flex items-center gap-1.5">
                            <div
                              className="h-4 w-4 rounded-full border border-white/30"
                              style={{ backgroundColor: template.colors.primary }}
                              title={`Primária: ${template.colors.primary}`}
                            />
                            <div
                              className="h-4 w-4 rounded-full border border-white/30"
                              style={{ backgroundColor: template.colors.secondary }}
                              title={`Secundária: ${template.colors.secondary}`}
                            />
                            <div
                              className="h-4 w-4 rounded-full border border-white/30"
                              style={{ backgroundColor: template.colors.background }}
                              title={`Fundo: ${template.colors.background}`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-5 pt-0 flex items-center gap-2">
                      <Button
                        onClick={() => handleUseTemplate(template)}
                        disabled={isSubmitting}
                        className="flex-1 hub-bg-primary text-black font-black text-[11px] uppercase tracking-wider h-10 rounded-xl hover:scale-102 transition-all shadow-md"
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        Usar Este Template
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleCustomizeTemplate(template)}
                        className="border-white/10 hover:border-white/30 text-white font-bold text-[11px] uppercase tracking-wider h-10 rounded-xl px-3.5"
                        title="Personalizar Nome e Detalhes"
                      >
                        <Sliders className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Modal: Nova Loja */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0f0f13] border border-[var(--hub-border)] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-[var(--hub-border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase italic">Criar Nova Loja</h3>
                    <p className="text-[11px] text-[var(--hub-muted)] uppercase tracking-wider">
                      Geração procedural de tema e vitrine baseada no nicho
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateStorefront} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                {/* Seleção de Template Visual */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-cyan-400" />
                      Escolher Template Pré-Configurado
                    </label>
                    {selectedTemplate && (
                      <button
                        type="button"
                        onClick={() => setSelectedTemplate(null)}
                        className="text-[10px] text-red-400 hover:underline uppercase font-bold tracking-wider"
                      >
                        Limpar Template
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--hub-muted)]">
                    Selecione um template pronto com vitrine temática e paleta de cores ou crie a partir do zero:
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedTemplate(null)}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between",
                        !selectedTemplate
                          ? "bg-cyan-500/10 border-cyan-400 ring-1 ring-cyan-400/50"
                          : "bg-black/40 border-[var(--hub-border)] hover:border-white/30"
                      )}
                    >
                      <div className="h-12 w-full rounded-lg bg-neutral-900 border border-dashed border-neutral-700 flex items-center justify-center text-[10px] text-neutral-400 font-bold uppercase">
                        Em Branco
                      </div>
                      <div className="mt-2">
                        <div className="text-[11px] font-bold text-white leading-tight">Do Zero</div>
                        <div className="text-[9px] text-[var(--hub-muted)]">Configuração procedural</div>
                      </div>
                    </button>

                    {STORE_TEMPLATES.map((tpl) => {
                      const isSelected = selectedTemplate?.id === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => {
                            setSelectedTemplate(tpl);
                            if (!storeName || STORE_TEMPLATES.some((t) => t.name === storeName)) {
                              setStoreName(tpl.name);
                              setStoreSlug(
                                tpl.name
                                  .toLowerCase()
                                  .replace(/[^a-z0-9]/g, "-")
                                  .replace(/-+/g, "-")
                              );
                            }
                            setStoreNiche(tpl.niche);
                            setStoreDesc(tpl.subheadline);
                          }}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between group",
                            isSelected
                              ? "bg-cyan-500/10 border-cyan-400 ring-2 ring-cyan-400/50"
                              : "bg-black/40 border-[var(--hub-border)] hover:border-white/30"
                          )}
                        >
                          <div className="h-12 w-full rounded-lg overflow-hidden relative">
                            <img
                              src={tpl.previewImage}
                              alt={tpl.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div
                              className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full border border-white/40 shadow"
                              style={{ backgroundColor: tpl.colors.primary }}
                            />
                          </div>
                          <div className="mt-2">
                            <div className="text-[11px] font-bold text-white leading-tight truncate">
                              {tpl.name}
                            </div>
                            <div className="text-[9px] text-cyan-400 font-bold truncate">
                              {tpl.niche}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Nome da Loja *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Urban Streetwear, Tech Nova, Casa Bella"
                    value={storeName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full bg-black/50 border border-[var(--hub-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--hub-primary)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Slug da URL
                  </label>
                  <div className="flex items-center bg-black/50 border border-[var(--hub-border)] rounded-xl px-3 text-sm text-slate-400">
                    <span className="text-slate-500 text-xs mr-1">/store/</span>
                    <input
                      type="text"
                      placeholder="urban-streetwear"
                      value={storeSlug}
                      onChange={(e) => setStoreSlug(e.target.value)}
                      className="w-full bg-transparent border-none py-2.5 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Nicho de Atuação (Gera a paleta visual ideal)
                  </label>
                  <select
                    value={storeNiche}
                    onChange={(e) => setStoreNiche(e.target.value as StoreNiche)}
                    className="w-full bg-black/50 border border-[var(--hub-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--hub-primary)]"
                  >
                    {NICHES.map((niche) => (
                      <option key={niche} value={niche} className="bg-neutral-900 text-white">
                        {niche}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2 pt-1 text-xs text-[var(--hub-muted)]">
                    <span>Cores sugeridas para {storeNiche}:</span>
                    <div
                      className="h-4 w-4 rounded-full border border-white/20"
                      style={{ backgroundColor: selectedTemplate?.colors.primary || NICHE_PALETTES[storeNiche].primary }}
                    />
                    <div
                      className="h-4 w-4 rounded-full border border-white/20"
                      style={{ backgroundColor: selectedTemplate?.colors.secondary || NICHE_PALETTES[storeNiche].secondary }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Slogan ou Descrição
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Breve descrição dos diferenciais e proposta da loja..."
                    value={storeDesc}
                    onChange={(e) => setStoreDesc(e.target.value)}
                    className="w-full bg-black/50 border border-[var(--hub-border)] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[var(--hub-primary)] resize-none"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--hub-border)]">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsModalOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="hub-bg-primary text-black font-black text-xs uppercase tracking-wider px-6 h-10 rounded-xl"
                  >
                    {isSubmitting ? "Criando..." : "Criar e Abrir Construtor"}
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
