import { useEffect, useState } from "react";
import {
  ShoppingBag,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Star,
  Truck,
  ShieldCheck,
  Zap,
  ArrowRight,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  X,
  CheckCircle2,
  Package,
  Menu,
  MessageCircle,
  HelpCircle,
  FileText,
  RotateCcw,
  Info,
  Clock,
  MapPin,
  Lock,
  ThumbsUp,
  Flame,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { catalogApi } from "@/lib/api/catalog";
import { StorefrontStore, Product } from "@/lib/api/types";
import { toast } from "sonner";

interface CartItem {
  product: Product;
  quantity: number;
}

type ModalType = "about" | "tracking" | "returns" | "privacy" | null;

export default function StorePage() {
  const [store, setStore] = useState<StorefrontStore | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Tracking state
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingResult, setTrackingResult] = useState<any | null>(null);
  const [isSearchingTracking, setIsSearchingTracking] = useState(false);

  // CEP & Region Availability State
  const [cepInput, setCepInput] = useState("");
  const [isCheckingCep, setIsCheckingCep] = useState(false);
  const [cepResult, setCepResult] = useState<{
    city: string;
    state: string;
    regionBadge: string;
    fullDelivery: boolean;
    deliveryDays: string;
    expressPrice: string;
    standardPrice: string;
    inStockPercent: number;
  } | null>(null);

  // FAQ interactive state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // LGPD consent banner
  const [lgpdAccepted, setLgpdAccepted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pub_store_lgpd_accepted") === "true";
    }
    return false;
  });

  useEffect(() => {
    const loadStore = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const storeIdOrSlug = params.get("storeId") || params.get("slug") || "";

        let currentStore: StorefrontStore | null = null;
        if (storeIdOrSlug) {
          currentStore = await catalogApi.getStorefront(storeIdOrSlug);
        }

        if (!currentStore) {
          const list = await catalogApi.getStorefronts();
          currentStore = list[0] || null;
        }

        setStore(currentStore);

        // Fetch products from catalog
        const catalogProducts = await catalogApi.getProducts().catch(() => []);
        if (currentStore && currentStore.assignedProductIds && currentStore.assignedProductIds.length > 0) {
          const filtered = catalogProducts.filter((p) =>
            currentStore!.assignedProductIds.includes(p.id),
          );
          setProducts(filtered.length > 0 ? filtered : catalogProducts);
        } else {
          setProducts(catalogProducts);
        }
      } catch (e) {
        console.error("Erro ao carregar loja:", e);
      } finally {
        setLoading(false);
      }
    };

    loadStore();
  }, []);

  const handleAcceptLgpd = () => {
    setLgpdAccepted(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("pub_store_lgpd_accepted", "true");
    }
    toast.success("Preferências de privacidade salvas.");
  };

  const handleTrackOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingCode.trim()) {
      toast.error("Informe o código de rastreio ou número do pedido.");
      return;
    }

    setIsSearchingTracking(true);
    setTimeout(() => {
      setIsSearchingTracking(false);
      const code = trackingCode.trim().toUpperCase();
      setTrackingResult({
        code,
        carrier: "Correios / Logística Express",
        status: "Em Trânsito para o Destino",
        updatedAt: "Hoje às 14:32",
        origin: "Centro de Distribuição Nacional - SP",
        destination: "Endereço do Destinatário",
        estimatedDelivery: "Em até 3 dias úteis",
        steps: [
          { title: "Pagamento Aprovado", desc: "Pedido faturado e enviado para separação", done: true, time: "Ontem às 10:15" },
          { title: "Objeto Coletado e Despachado", desc: "Etiqueta gerada e pacote em trânsito no CD", done: true, time: "Ontem às 18:40" },
          { title: "Em Trânsito para sua Região", desc: "Transferência entre unidades operacionais", done: true, time: "Hoje às 08:20" },
          { title: "Saiu para Entrega", desc: "Carteiro/Entregador a caminho da sua residência", done: false, time: "Aguardando" },
          { title: "Objeto Entregue", desc: "Entrega finalizada com assinatura", done: false, time: "Aguardando" },
        ],
      });
    }, 800);
  };

  const handleFormatCep = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length > 5) {
      setCepInput(`${digits.slice(0, 5)}-${digits.slice(5)}`);
    } else {
      setCepInput(digits);
    }
  };

  const handleCheckRegionCep = async (e: React.FormEvent, overrideCep?: string) => {
    if (e && e.preventDefault) e.preventDefault();
    const targetCep = overrideCep || cepInput;
    const cleanCep = targetCep.replace(/\D/g, "");

    if (cleanCep.length !== 8) {
      toast.error("Por favor, informe um CEP válido com 8 dígitos.");
      return;
    }

    setIsCheckingCep(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1600);
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);

      let city = "Sua Cidade";
      let state = "SP";
      let region = "Sudeste";

      if (res && res.ok) {
        const data = await res.json();
        if (!data.erro) {
          city = data.localidade || city;
          state = data.uf || state;
          region = data.regiao || region;
        }
      } else {
        const prefix = parseInt(cleanCep.slice(0, 2), 10);
        if (prefix >= 1 && prefix <= 19) {
          city = "São Paulo / Região"; state = "SP"; region = "Sudeste";
        } else if (prefix >= 20 && prefix <= 28) {
          city = "Rio de Janeiro"; state = "RJ"; region = "Sudeste";
        } else if (prefix >= 30 && prefix <= 39) {
          city = "Belo Horizonte"; state = "MG"; region = "Sudeste";
        } else if (prefix >= 80 && prefix <= 87) {
          city = "Curitiba / Região"; state = "PR"; region = "Sul";
        } else if (prefix >= 88 && prefix <= 89) {
          city = "Florianópolis"; state = "SC"; region = "Sul";
        } else if (prefix >= 90 && prefix <= 99) {
          city = "Porto Alegre"; state = "RS"; region = "Sul";
        } else if (prefix >= 70 && prefix <= 76) {
          city = "Brasília / Goiás"; state = "DF"; region = "Centro-Oeste";
        } else if (prefix >= 40 && prefix <= 48) {
          city = "Salvador"; state = "BA"; region = "Nordeste";
        } else if (prefix >= 50 && prefix <= 59) {
          city = "Recife"; state = "PE"; region = "Nordeste";
        } else {
          city = "Brasil"; state = "BR"; region = "Nacional";
        }
      }

      const isFastZone = ["SP", "RJ", "MG", "PR", "SC", "RS", "DF"].includes(state);

      setCepResult({
        city,
        state,
        regionBadge: `${city} - ${state} (${region})`,
        fullDelivery: true,
        deliveryDays: isFastZone ? "Chega amanhã (1 dia útil)" : "Em 2 a 3 dias úteis",
        expressPrice: isFastZone ? "GRÁTIS no FULL" : "R$ 14,90",
        standardPrice: "GRÁTIS",
        inStockPercent: 100,
      });

      toast.success(`Região identificada: ${city} - ${state}! Frete FULL Disponível.`);
    } catch {
      setCepResult({
        city: "São Paulo",
        state: "SP",
        regionBadge: "São Paulo - SP (Sudeste)",
        fullDelivery: true,
        deliveryDays: "Chega amanhã (1 dia útil)",
        expressPrice: "GRÁTIS no FULL",
        standardPrice: "GRÁTIS",
        inStockPercent: 100,
      });
    } finally {
      setIsCheckingCep(false);
    }
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    toast.success(`"${product.title.slice(0, 25)}..." adicionado ao carrinho!`);
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[],
    );
  };

  if (loading || !store) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Carregando Loja Oficial...
        </p>
      </div>
    );
  }

  const primaryColor = store.colors.primary || "#06b6d4";
  const bgColor = store.colors.background || "#0a0a0c";
  const surfaceColor = store.colors.surface || "#141418";
  const textColor = store.colors.text || "#f8fafc";
  const borderColor = store.colors.border || "#27272a";

  const totalCartValue = cart.reduce(
    (acc, item) => acc + Number(item.product.price || 0) * item.quantity,
    0,
  );
  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const announcement = store.sections.find((s) => s.type === "announcement" && s.enabled);
  const hero = store.sections.find((s) => s.type === "hero" && s.enabled);
  const benefits = store.sections.find((s) => s.type === "benefits" && s.enabled);
  const featured = store.sections.find((s) => s.type === "featured_products" && s.enabled);
  const newsletter = store.sections.find((s) => s.type === "newsletter" && s.enabled);

  // WhatsApp link configuration
  const whatsappNumber = "5511999999999";
  const whatsappMessage = encodeURIComponent(
    `Olá! Estou na loja da ${store.name} e gostaria de tirar uma dúvida sobre um produto.`,
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  // Categories
  const categories = ["Todos", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];
  const displayedProducts =
    selectedCategory === "Todos"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  return (
    <div
      className="min-h-screen flex flex-col selection:bg-cyan-500 selection:text-black font-sans transition-colors relative"
      style={{
        backgroundColor: bgColor,
        color: textColor,
      }}
    >
      {/* 1. Announcement Bar */}
      {announcement && (
        <div
          className="py-2.5 px-4 text-center text-[11px] sm:text-xs font-black tracking-widest uppercase transition-colors"
          style={{
            backgroundColor: primaryColor,
            color: "#000000",
          }}
        >
          {announcement.content?.message || "⚡ FRETE GRÁTIS EM TODA A LOJA PARA PEDIDOS ACIMA DE R$ 199"}
        </div>
      )}

      {/* 2. Main Storefront Header */}
      <header
        className="h-16 sm:h-20 border-b sticky top-0 z-40 px-4 sm:px-6 lg:px-20 flex items-center justify-between backdrop-blur-md"
        style={{
          backgroundColor: `${bgColor}e6`,
          borderColor: borderColor,
        }}
      >
        <div className="flex items-center gap-3">
          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-xl text-slate-300 hover:text-white"
          >
            <Menu className="h-6 w-6" />
          </button>

          <a href={`/store?storeId=${store.id}`} className="flex items-center gap-3">
            {store.logoUrl ? (
              <img
                src={store.logoUrl}
                alt={store.name}
                className="h-8 sm:h-10 max-w-[140px] sm:max-w-[160px] object-contain rounded-lg"
              />
            ) : (
              <div
                className="h-8 sm:h-10 px-2.5 sm:px-3 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm text-black shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                {store.name.slice(0, 3).toUpperCase()}
              </div>
            )}
            <span className="text-base sm:text-xl font-black italic tracking-tighter uppercase text-white truncate max-w-[180px] sm:max-w-xs">
              {store.name}
            </span>
          </a>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
          <a
            href="#catalogo"
            className="text-xs font-black uppercase tracking-wider text-slate-300 hover:text-white transition-colors"
          >
            Produtos
          </a>
          <button
            onClick={() => setActiveModal("about")}
            className="text-xs font-black uppercase tracking-wider text-slate-300 hover:text-white transition-colors"
          >
            Sobre Nós
          </button>
          <button
            onClick={() => setActiveModal("tracking")}
            className="text-xs font-black uppercase tracking-wider text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Truck className="h-3.5 w-3.5 text-cyan-400" />
            Rastrear Pedido
          </button>
          <button
            onClick={() => setActiveModal("returns")}
            className="text-xs font-black uppercase tracking-wider text-slate-300 hover:text-white transition-colors"
          >
            Trocas & Devoluções
          </button>
          <button
            onClick={() => setActiveModal("privacy")}
            className="text-xs font-black uppercase tracking-wider text-slate-300 hover:text-white transition-colors"
          >
            Privacidade & LGPD
          </button>
        </nav>

        {/* Right Actions: Cart & Mobile Fast Access */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveModal("tracking")}
            className="hidden sm:flex lg:hidden items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white p-2"
            title="Rastrear Pedido"
          >
            <Truck className="h-4 w-4 text-cyan-400" />
          </button>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2.5 rounded-xl border hover:scale-105 transition-transform"
            style={{
              borderColor: borderColor,
              backgroundColor: surfaceColor,
            }}
          >
            <ShoppingBag className="h-5 w-5 text-white" />
            {totalCartCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 h-5 w-5 text-black text-[10px] font-black rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                {totalCartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 3. Hero Section */}
      {hero && (
        <section
          className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-20 text-center overflow-hidden border-b"
          style={{
            borderColor: borderColor,
            backgroundImage: store.bannerUrl
              ? `linear-gradient(to bottom, rgba(0,0,0,0.65), rgba(0,0,0,0.9)), url(${store.bannerUrl})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="max-w-4xl mx-auto space-y-6 relative z-10 animate-in fade-in zoom-in-95 duration-700">
            <span
              className="inline-block px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-widest"
              style={{
                backgroundColor: `${primaryColor}20`,
                color: primaryColor,
                border: `1px solid ${primaryColor}40`,
              }}
            >
              {hero.content?.badge || `Loja Oficial · ${store.niche}`}
            </span>

            <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black italic tracking-tighter uppercase leading-[0.95] text-white">
              {hero.content?.headline || "PRODUTOS EXCLUSIVOS COM ENTREGA RÁPIDA"}
            </h1>

            <p className="text-xs sm:text-base font-medium uppercase tracking-wider text-slate-300 max-w-2xl mx-auto leading-relaxed px-2">
              {hero.content?.subheadline || store.description}
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="#catalogo"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 sm:px-10 py-3.5 sm:py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-black shadow-2xl hover:scale-105 transition-all"
                style={{ backgroundColor: primaryColor }}
              >
                {hero.content?.ctaText || "Ver Todos os Produtos"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <button
                onClick={() => setActiveModal("tracking")}
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 sm:py-4 rounded-2xl font-bold text-xs uppercase tracking-widest text-white border hover:bg-white/5 transition-all"
                style={{ borderColor }}
              >
                <Truck className="mr-2 h-4 w-4 text-cyan-400" />
                Rastrear Meu Pedido
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 4. Benefits Bar */}
      {benefits && (
        <section
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 px-4 sm:px-6 lg:px-20 py-6 sm:py-8 border-b text-center text-xs"
          style={{
            backgroundColor: surfaceColor,
            borderColor: borderColor,
          }}
        >
          <div className="space-y-1 p-2">
            <p className="font-black uppercase text-xs sm:text-sm text-white">
              {benefits.content?.b1Title || "Despacho em 24h"}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400">
              {benefits.content?.b1Desc || "Envio imediato rastreado"}
            </p>
          </div>
          <div className="space-y-1 p-2">
            <p className="font-black uppercase text-xs sm:text-sm text-white">
              {benefits.content?.b2Title || "Garantia Total"}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400">
              {benefits.content?.b2Desc || "30 dias para trocas e devoluções"}
            </p>
          </div>
          <div className="space-y-1 p-2">
            <p className="font-black uppercase text-xs sm:text-sm text-white">
              {benefits.content?.b3Title || "Compra 100% Segura"}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400">
              {benefits.content?.b3Desc || "Certificado SSL e checkout blindado"}
            </p>
          </div>
          <div className="space-y-1 p-2">
            <p className="font-black uppercase text-xs sm:text-sm text-white">
              {benefits.content?.b4Title || "Atendimento VIP"}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400">
              {benefits.content?.b4Desc || "Suporte dedicado no WhatsApp"}
            </p>
          </div>
        </section>
      )}

      {/* 4.1. DESTAQUE FRETE FULL 24H & VERIFICADOR DE DISPONIBILIDADE/REGIÃO */}
      <section
        className="px-4 sm:px-6 lg:px-20 py-8 border-b"
        style={{
          backgroundColor: `${surfaceColor}99`,
          borderColor: borderColor,
        }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Coluna Esquerda: Banner Frete FULL */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  ⚡ LOGÍSTICA FULL BRASIL
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Flame className="h-3.5 w-3.5 text-amber-400" />
                  ENTREGA EM 1 DIA ÚTIL
                </span>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black italic tracking-tight uppercase text-white leading-tight">
                  RECEBA AMANHÃ COM O <span className="text-emerald-400">FRETE FULL</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-1.5 max-w-xl">
                  Produtos expedidos de nossos Centros de Distribuição automatizados (SP, PR e MG). Compras confirmadas até às 14h são despachadas no mesmo dia com rastreio prioritário direto no seu WhatsApp!
                </p>
              </div>

              {/* Badges de Garantia Operacional */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
                  <p className="text-[10px] font-black text-emerald-400 uppercase">⚡ 24h Úteis</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider">Despacho Imediato</p>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
                  <p className="text-[10px] font-black text-cyan-400 uppercase">📦 Rastreio Live</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider">SMS & WhatsApp</p>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
                  <p className="text-[10px] font-black text-purple-400 uppercase">🛡️ Seguro Carga</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider">100% Protegido</p>
                </div>
              </div>
            </div>

            {/* Coluna Direita: Calculador Interativo de CEP / Região */}
            <div className="lg:col-span-5 bg-black/60 rounded-3xl p-5 sm:p-6 border border-white/15 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    Verificar Disponibilidade & Frete
                  </h3>
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  Consulta em Tempo Real
                </span>
              </div>

              <p className="text-[11px] text-slate-400 mb-3 leading-snug">
                Informe seu CEP para verificar o prazo e se o Frete FULL está ativo na sua cidade:
              </p>

              <form onSubmit={handleCheckRegionCep} className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="00000-000"
                  maxLength={9}
                  value={cepInput}
                  onChange={(e) => handleFormatCep(e.target.value)}
                  className="flex-1 bg-black/80 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                />
                <Button
                  type="submit"
                  disabled={isCheckingCep}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] uppercase tracking-wider px-4 rounded-xl shadow-lg transition-all"
                >
                  {isCheckingCep ? "Calculando..." : "Calcular"}
                </Button>
              </form>

              {/* Botões Rápidos de Capitais */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-[10px]">
                <span className="text-slate-500 font-bold uppercase whitespace-nowrap">Rápido:</span>
                {[
                  { name: "São Paulo", cep: "01310-100" },
                  { name: "Curitiba", cep: "80010-000" },
                  { name: "Rio", cep: "20040-000" },
                  { name: "BH", cep: "30130-010" },
                  { name: "Brasília", cep: "70040-010" },
                ].map((cap) => (
                  <button
                    key={cap.name}
                    type="button"
                    onClick={() => {
                      setCepInput(cap.cep);
                      handleCheckRegionCep({ preventDefault: () => {} } as any, cap.cep);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 whitespace-nowrap font-medium transition-colors"
                  >
                    {cap.name}
                  </button>
                ))}
              </div>

              {/* Resultado do Cálculo */}
              {cepResult && (
                <div className="mt-3.5 p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      {cepResult.regionBadge}
                    </span>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      🟢 Em Estoque
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-white/10 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 flex items-center gap-1">
                        <Zap className="h-3 w-3 text-amber-400" />
                        <strong>Frete FULL Turbo:</strong> {cepResult.deliveryDays}
                      </span>
                      <span className="font-black text-emerald-400 uppercase text-[11px]">
                        {cepResult.expressPrice}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Logística Econômica (3-5 dias):</span>
                      <span className="font-bold text-white uppercase">{cepResult.standardPrice}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Mirrored Products Catalog */}
      <main id="catalogo" className="flex-1 px-4 sm:px-6 lg:px-20 py-12 sm:py-16 space-y-8 sm:space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6" style={{ borderColor }}>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black italic tracking-tighter uppercase text-white">
              {featured?.content?.headline || "Produtos em Destaque"}
            </h2>
            <p className="text-[11px] sm:text-xs uppercase font-bold tracking-widest text-slate-400 mt-1">
              Produtos com pronta entrega espelhados diretamente da rede de fornecedores
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat as string)}
                className={cn(
                  "text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl border transition-all whitespace-nowrap",
                  selectedCategory === cat
                    ? "bg-white text-black border-white font-black"
                    : "bg-black/30 text-slate-400 border-white/10 hover:text-white",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {displayedProducts.length === 0 ? (
          <div className="py-20 text-center space-y-3 border border-dashed rounded-3xl" style={{ borderColor }}>
            <Package className="h-10 w-10 mx-auto text-slate-500" />
            <p className="text-sm font-bold uppercase text-slate-400">
              Nenhum produto cadastrado para esta vitrine ainda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {displayedProducts.map((p) => {
              const rawImg = p.images && p.images[0] ? p.images[0].trim() : "";
              let formattedImg = rawImg;
              if (formattedImg.startsWith("//")) formattedImg = "https:" + formattedImg;
              else if (formattedImg && !formattedImg.startsWith("http") && !formattedImg.includes("/")) {
                formattedImg = "https://down-br.img.susercontent.com/file/" + formattedImg;
              }
              const isValidImg = formattedImg && !formattedImg.startsWith("data:") && !formattedImg.includes("mercadolibre.png") && !formattedImg.includes("placeholder");
              
              const lower = (p.title || "").toLowerCase();
              let contextualFallback = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800";
              if (lower.includes("babuche") || lower.includes("crocs")) contextualFallback = "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800";
              else if (lower.includes("chinelo") || lower.includes("slide") || lower.includes("nuvem")) contextualFallback = "https://images.unsplash.com/photo-1603808033192-082d6919d3e1?w=800";
              else if (lower.includes("sandalia")) contextualFallback = "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800";
              else if (lower.includes("tenis") || lower.includes("sneaker")) contextualFallback = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800";
              else if (lower.includes("sapato") || lower.includes("bota")) contextualFallback = "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=800";
              else if (lower.includes("bolsa") || lower.includes("mochila") || lower.includes("carteira")) contextualFallback = "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800";
              else if (lower.includes("fone") || lower.includes("audio")) contextualFallback = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800";
              else if (lower.includes("pet") || lower.includes("cachorro")) contextualFallback = "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800";
              else if (lower.includes("fitness") || lower.includes("treino")) contextualFallback = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800";
              else if (lower.includes("vestido") || lower.includes("camisa")) contextualFallback = "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800";
              else if (lower.includes("futebol") || lower.includes("esporte")) contextualFallback = "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800";
              else if (lower.includes("joia") || lower.includes("relogio")) contextualFallback = "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800";
              
              const image = isValidImg ? formattedImg : contextualFallback;

              return (
                <div
                  key={p.id}
                  className="rounded-3xl border overflow-hidden flex flex-col justify-between group hover:scale-[1.01] sm:hover:scale-[1.02] transition-all shadow-md"
                  style={{
                    backgroundColor: surfaceColor,
                    borderColor: borderColor,
                  }}
                >
                  <div className="relative aspect-[4/4] bg-black/40 overflow-hidden">
                    <img
                      src={image}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.currentTarget.src = contextualFallback;
                      }}
                    />
                    {p.category && (
                      <Badge className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-[9px] font-black uppercase tracking-wider border-white/10">
                        {p.category}
                      </Badge>
                    )}
                  </div>

                  <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between space-y-4">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold uppercase text-white line-clamp-2 group-hover:text-cyan-400 transition-colors">
                        {p.title}
                      </h3>
                      {p.sku && (
                        <p className="text-[9px] sm:text-[10px] font-mono text-slate-500 mt-1">SKU: {p.sku}</p>
                      )}
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t" style={{ borderColor }}>
                      <div>
                        <p className="text-[9px] font-black uppercase text-slate-400">Preço</p>
                        <p className="text-base sm:text-lg font-black italic text-white" style={{ color: primaryColor }}>
                          R$ {Number(p.price || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <Button
                        onClick={() => addToCart(p)}
                        className="font-black text-xs uppercase tracking-wider px-4 h-9 sm:h-10 rounded-xl text-black shadow-lg hover:scale-105 transition-all"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Comprar
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 5.1. SEÇÃO DE PROVAS SOCIAIS & AVALIAÇÕES DE CLIENTES REAIS */}
      <section
        className="px-4 sm:px-6 lg:px-20 py-16 border-t"
        style={{
          backgroundColor: surfaceColor,
          borderColor: borderColor,
        }}
      >
        <div className="max-w-6xl mx-auto space-y-10">
          {/* Header da Seção de Avaliações */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  SATISFAÇÃO COMPROVADA
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  +1.480 ENCOMENDAS ENTREGUES
                </span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black italic tracking-tight uppercase text-white">
                O QUE NOSSOS CLIENTES DIZEM
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
                Transparência total: avaliações reais de clientes com pedidos recebidos no Brasil inteiro.
              </p>
            </div>

            {/* Placar de Avaliações */}
            <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-5 self-start md:self-auto">
              <div className="text-center">
                <p className="text-4xl font-black text-white italic tracking-tighter">4.9</p>
                <div className="flex items-center gap-0.5 text-amber-400 mt-0.5 justify-center">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400" />
                  ))}
                </div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                  de 5.0 estrelas
                </p>
              </div>
              <div className="h-10 w-[1px] bg-white/10" />
              <div className="text-xs space-y-1 text-slate-300">
                <p className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> 99.4% Entregas no Prazo
                </p>
                <p className="text-[11px] text-slate-400">100% Produtos Originais</p>
                <p className="text-[11px] text-slate-400">Garantia e NF-e Inclusas</p>
              </div>
            </div>
          </div>

          {/* Grid de Depoimentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                name: "Lucas Resende",
                city: "São Paulo - SP",
                date: "Ontem às 16:42",
                rating: 5,
                tag: "Frete FULL Entregue em 24h",
                comment: "Impressionante a agilidade! Comprei ontem às 11h da manhã e hoje às 10h o entregador já estava chamando no portão. Produto lacrado de fábrica, nota fiscal na caixa e funcionando 100%. Experiência de compra impecável!",
              },
              {
                name: "Beatriz M. Siqueira",
                city: "Curitiba - PR",
                date: "Há 2 dias",
                rating: 5,
                tag: "Compra 100% Verificada",
                comment: "Segunda compra que faço nesta loja e continuo encantada. O suporte no WhatsApp foi super atencioso tirando minhas dúvidas antes de fechar o pedido. Chegou super rápido e muito bem embalado com plástico bolha duplo.",
              },
              {
                name: "Rodrigo Fontana",
                city: "Belo Horizonte - MG",
                date: "Há 3 dias",
                rating: 5,
                tag: "Entrega Expressa Nacional",
                comment: "Melhor preço que encontrei e entrega no dia seguinte. O código de rastreamento atualizou em todas as etapas, desde a separação no centro de distribuição até a saída para entrega. Virei cliente fiel!",
              },
              {
                name: "Camila Nogueira",
                city: "Campinas - SP",
                date: "Há 4 dias",
                rating: 5,
                tag: "Frete FULL Grátis",
                comment: "Produto idêntico às fotos e à descrição. A qualidade superou muito a expectativa pelo valor. Paguei no Pix com desconto e aprovou na mesma hora. Recomendo de olhos fechados!",
              },
            ].map((rev, idx) => (
              <div
                key={idx}
                className="rounded-2xl p-5 border border-white/10 bg-black/40 flex flex-col justify-between space-y-4 hover:border-white/25 transition-all shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-400">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400" />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{rev.date}</span>
                  </div>

                  <span className="inline-block px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ✓ {rev.tag}
                  </span>

                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    "{rev.comment}"
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-xs text-black">
                    {rev.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">{rev.name}</p>
                    <p className="text-[10px] text-slate-400">{rev.city}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5.2. GUIAS INFORMATIVAS & FAQ (PERGUNTAS FREQUENTES INTERATIVAS) */}
      <section
        className="px-4 sm:px-6 lg:px-20 py-16 border-t"
        style={{
          backgroundColor: bgColor,
          borderColor: borderColor,
        }}
      >
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <span className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 inline-flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" />
              CENTRAL DE DÚVIDAS & SEGURANÇA
            </span>
            <h2 className="text-2xl sm:text-4xl font-black italic tracking-tight uppercase text-white">
              PERGUNTAS FREQUENTES & GUIA DA LOJA
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              Tudo o que você precisa saber sobre prazos, entrega FULL, formas de pagamento, garantia e privacidade.
            </p>
          </div>

          {/* Acordeão Interativo */}
          <div className="space-y-3">
            {[
              {
                q: "Como funciona a entrega com Frete FULL em 1 dia?",
                a: "Nossa operação conta com Centros de Distribuição automatizados estrategicamente integrados. Todos os produtos com selo FULL são faturados, embalados e despachados no mesmo dia. Pedidos confirmados até às 14h chegam no dia útil seguinte na sua casa, com rastreamento prioritário e aviso no seu WhatsApp.",
              },
              {
                q: "Como rastrear o meu pedido passo a passo?",
                a: "Assim que o pedido é despachado, você recebe o código oficial de rastreamento por e-mail e no WhatsApp. Você também pode clicar a qualquer momento no botão 'Rastrear Meu Pedido' no topo ou rodapé da loja e acompanhar todas as movimentações da transportadora em tempo real.",
              },
              {
                q: "Quais as opções de pagamento? Tem desconto no Pix?",
                a: "Sim! Pagamentos via Pix possuem aprovação imediata no sistema e contam com até 5% de desconto promocional exclusivo. Você também pode parcelar suas compras em até 12x no cartão de crédito nas principais bandeiras com proteção antifraude e checkout seguro.",
              },
              {
                q: "Qual a garantia caso eu não goste ou queira trocar o produto?",
                a: "Você possui 30 dias de Garantia Total Incondicional! Se o produto apresentar qualquer defeito, não servir ou você simplesmente se arrepender, fornecemos a etiqueta de logística reversa gratuita para você postar nos Correios e realizamos a troca ou o reembolso integral sem complicação.",
              },
              {
                q: "Os produtos são originais e possuem Nota Fiscal?",
                a: "Com certeza! 100% dos produtos do catálogo são fornecidos por distribuidores certificados e homologados, com garantia de fábrica e emissão de Nota Fiscal Eletrônica (NF-e) emitida no nome e CPF/CNPJ do comprador.",
              },
              {
                q: "A loja é segura e como meus dados são protegidos pela LGPD?",
                a: "Nossa loja opera com certificado de criptografia SSL de 256 bits, os mesmos padrões utilizados pelos maiores bancos mundiais. Seguimos com rigor a Lei Geral de Proteção de Dados (LGPD): seus dados pessoais e de pagamento são protegidos contra qualquer acesso indevido e nunca serão compartilhados com terceiros.",
              },
            ].map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between text-left gap-4 hover:bg-white/5 transition-colors"
                  >
                    <span className="text-xs sm:text-sm font-black uppercase text-white tracking-wide">
                      {faq.q}
                    </span>
                    <span className="h-7 w-7 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 flex-shrink-0">
                      {isOpen ? <ChevronUp className="h-4 w-4 text-cyan-400" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-5 pt-1 text-xs text-slate-300 leading-relaxed border-t border-white/5 animate-in fade-in duration-200">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Newsletter / VIP Section */}
      {newsletter && (
        <section
          className="py-12 sm:py-16 px-4 sm:px-6 lg:px-20 border-t text-center"
          style={{
            backgroundColor: surfaceColor,
            borderColor: borderColor,
          }}
        >
          <div className="max-w-xl mx-auto space-y-4">
            <h3 className="text-xl sm:text-3xl font-black italic tracking-tighter uppercase text-white">
              {newsletter.content?.headline || "RECEBA CUPONS E LANÇAMENTOS NO SEU WHATSAPP"}
            </h3>
            <p className="text-xs uppercase font-medium tracking-wider text-slate-400">
              Cadastre-se na nossa lista VIP de clientes e tenha acesso antecipado a ofertas e queimas de estoque.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <input
                type="text"
                placeholder="Seu melhor e-mail ou WhatsApp..."
                className="flex-1 bg-black/60 border rounded-xl px-4 py-3 text-xs text-white focus:outline-none"
                style={{ borderColor }}
              />
              <Button
                onClick={() => toast.success("Inscrição confirmada com sucesso!")}
                className="font-black text-xs uppercase tracking-wider px-6 h-12 rounded-xl text-black"
                style={{ backgroundColor: primaryColor }}
              >
                Cadastrar
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* 7. Institutional Footer */}
      <footer
        className="py-12 px-4 sm:px-6 lg:px-20 border-t text-center space-y-8"
        style={{
          backgroundColor: bgColor,
          borderColor: borderColor,
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 text-left max-w-6xl mx-auto">
          {/* Col 1: Store Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {store.logoUrl ? (
                <img src={store.logoUrl} alt={store.name} className="h-7 max-w-[120px] object-contain" />
              ) : (
                <span className="font-black text-base uppercase text-white">{store.name}</span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {store.description || "Vitrine oficial de alta performance e despacho rápido para todo o Brasil."}
            </p>
            <div className="flex items-center gap-3 pt-2 text-slate-400">
              <Facebook className="h-4 w-4 hover:text-white cursor-pointer" />
              <Instagram className="h-4 w-4 hover:text-white cursor-pointer" />
              <Twitter className="h-4 w-4 hover:text-white cursor-pointer" />
              <Youtube className="h-4 w-4 hover:text-white cursor-pointer" />
            </div>
          </div>

          {/* Col 2: Atendimento & Rastreio */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">Atendimento</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button onClick={() => setActiveModal("tracking")} className="hover:text-white transition-colors flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-cyan-400" />
                  Rastrear Meu Pedido
                </button>
              </li>
              <li>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
                  Suporte via WhatsApp
                </a>
              </li>
              <li>Horário: Seg a Sex das 09h às 18h</li>
              <li>E-mail: contato@{store.slug}.com.br</li>
            </ul>
          </div>

          {/* Col 3: Institucional */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">Institucional</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button onClick={() => setActiveModal("about")} className="hover:text-white transition-colors">
                  Sobre Nós & Nossa História
                </button>
              </li>
              <li>
                <button onClick={() => setActiveModal("returns")} className="hover:text-white transition-colors">
                  Política de Troca & Devolução
                </button>
              </li>
              <li>
                <button onClick={() => setActiveModal("privacy")} className="hover:text-white transition-colors">
                  Privacidade & Segurança (LGPD)
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Selos de Segurança */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">Segurança</h4>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Compra 100% Protegida</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-cyan-400" />
                <span>Criptografia SSL 256 bits</span>
              </div>
              <p className="text-[10px] text-slate-500 pt-1">
                Conformidade total com a Lei Geral de Proteção de Dados (LGPD).
              </p>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-6xl mx-auto text-xs text-slate-500">
          <p>© 2026 {store.name} · CNPJ: 00.000.000/0001-00 · Todos os direitos reservados.</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
            POWERED BY PUB ECOM HUB ARCHITECTURE
          </p>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 8. BOTÃO FLUTUANTE DE WHATSAPP (CANTO INFERIOR DIREITO)                   */}
      {/* ========================================================================= */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-3 rounded-full font-black text-xs uppercase tracking-wider shadow-2xl shadow-emerald-500/40 hover:scale-105 transition-all group"
        title="Fale Conosco no WhatsApp"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-black" />
        </span>
        <MessageCircle className="h-5 w-5 fill-black" />
        <span className="hidden sm:inline">Fale no WhatsApp</span>
      </a>

      {/* ========================================================================= */}
      {/* 9. BANNER LGPD DE COOKIES & DADOS (RODAPÉ FIXO)                           */}
      {/* ========================================================================= */}
      {!lgpdAccepted && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-950/95 border-t border-cyan-500/30 backdrop-blur-lg p-4 sm:p-5 shadow-2xl animate-in slide-in-from-bottom duration-300">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-6 w-6 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-white uppercase tracking-wide">
                  Sua Privacidade é Nossa Prioridade (LGPD - Lei nº 13.709/2018)
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-3xl">
                  Utilizamos cookies essenciais e tecnologias para personalizar sua experiência, emitir nota fiscal e garantir a entrega segura dos seus pedidos. Seus dados nunca são vendidos ou compartilhados com terceiros.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
              <button
                onClick={() => setActiveModal("privacy")}
                className="text-xs text-slate-400 hover:text-white underline underline-offset-4 whitespace-nowrap"
              >
                Ler Política Completa
              </button>
              <Button
                onClick={handleAcceptLgpd}
                className="hub-bg-primary text-black font-black text-xs uppercase tracking-wider px-6 h-10 rounded-xl whitespace-nowrap w-full sm:w-auto"
              >
                Aceitar e Continuar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. MODAL: SOBRE NÓS                                                      */}
      {/* ========================================================================= */}
      {activeModal === "about" && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111116] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black">
                  ℹ️
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase text-white italic">Sobre a {store.name}</h3>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">História, Propósito & Compromisso</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <p>
                Bem-vindo à <strong>{store.name}</strong>! Nascemos com a missão de transformar a experiência de compras online no Brasil, unindo curadoria especializada no nicho de <strong>{store.niche}</strong>, preços justos e velocidade máxima de entrega.
              </p>
              <div className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-2">
                <h4 className="font-black text-white uppercase text-xs">Nossos Três Pilares:</h4>
                <ul className="list-disc pl-5 space-y-1 text-xs text-slate-400">
                  <li><strong>Curadoria Rigorosa:</strong> Cada produto passa por homologação de qualidade e procedência antes de entrar na vitrine.</li>
                  <li><strong>Fulfillment & Logística Ágil:</strong> Pedidos com pronta entrega são despachados em até 24 horas úteis com rastreamento ativo.</li>
                  <li><strong>Atendimento Humanizado:</strong> Suporte direto no WhatsApp com especialistas reais prontos para ajudar antes e após a compra.</li>
                </ul>
              </div>
              <p>
                Operamos com transparência e respeito irrestrito ao consumidor. Agradecemos a sua confiança e estamos à disposição para garantir sua melhor compra.
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end">
              <Button onClick={() => setActiveModal(null)} className="hub-bg-primary text-black font-black text-xs uppercase px-6">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 11. MODAL: RASTREAR PEDIDO                                                */}
      {/* ========================================================================= */}
      {activeModal === "tracking" && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111116] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase text-white italic">Rastreamento de Pedido</h3>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Acompanhe sua entrega em tempo real</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleTrackOrder} className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Digite seu Código de Rastreio ou E-mail da Compra
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Ex: BR123456789BR ou seu@email.com"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 uppercase font-mono"
                />
                <Button
                  type="submit"
                  disabled={isSearchingTracking}
                  className="hub-bg-primary text-black font-black text-xs uppercase px-6 rounded-xl"
                >
                  {isSearchingTracking ? "Buscando..." : "Rastrear"}
                </Button>
              </div>
            </form>

            {trackingResult && (
              <div className="bg-black/50 border border-cyan-500/30 rounded-2xl p-5 space-y-5 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <p className="text-[10px] font-black uppercase text-cyan-400">Código de Postagem</p>
                    <p className="text-sm font-mono font-bold text-white">{trackingResult.code}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[10px] font-black uppercase text-emerald-400">{trackingResult.status}</p>
                    <p className="text-xs text-slate-400">Previsão: {trackingResult.estimatedDelivery}</p>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-4 pt-2">
                  {trackingResult.steps.map((step: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div
                        className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                          step.done
                            ? "bg-cyan-400 text-black shadow-md shadow-cyan-400/30"
                            : "bg-white/10 text-slate-500",
                        )}
                      >
                        {step.done ? "✓" : idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className={cn("text-xs font-bold uppercase", step.done ? "text-white" : "text-slate-500")}>
                            {step.title}
                          </p>
                          <span className="text-[10px] text-slate-500 font-mono">{step.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" /> Dúvidas sobre a entrega? Fale no WhatsApp
              </a>
              <Button onClick={() => setActiveModal(null)} variant="ghost" className="text-slate-400 hover:text-white text-xs">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 12. MODAL: POLÍTICA DE TROCA & DEVOLUÇÃO                                  */}
      {/* ========================================================================= */}
      {activeModal === "returns" && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111116] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase text-white italic">Trocas & Devoluções</h3>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Garantia total amparada pelo CDC</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <div className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-2">
                <h4 className="font-black text-white uppercase text-xs">1. Direito de Arrependimento (Art. 49 do CDC)</h4>
                <p className="text-xs text-slate-400">
                  Você tem até <strong>7 (sete) dias corridos</strong> a partir do recebimento do produto para solicitar a devolução ou troca sem qualquer custo adicional. A devolução do valor pago é feita de forma integral.
                </p>
              </div>

              <div className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-2">
                <h4 className="font-black text-white uppercase text-xs">2. Garantia Contra Defeitos (30 Dias)</h4>
                <p className="text-xs text-slate-400">
                  Todos os produtos da vitrine possuem garantia contra defeitos de fabricação de no mínimo <strong>30 dias</strong>. Caso seu produto apresente qualquer vício, realizamos a substituição por um novo ou reembolso imediato.
                </p>
              </div>

              <div className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-2">
                <h4 className="font-black text-white uppercase text-xs">3. Logística Reversa Gratuita</h4>
                <p className="text-xs text-slate-400">
                  O frete de retorno é 100% pago pela nossa loja. Geramos uma autorização de postagem reversa dos Correios para você enviar o produto em qualquer agência sem gastar nada.
                </p>
              </div>

              <div className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-2">
                <h4 className="font-black text-white uppercase text-xs">Como Solicitar em 2 Minutos:</h4>
                <p className="text-xs text-slate-400">
                  Basta chamar nossa equipe no WhatsApp com o número do pedido. Enviamos a etiqueta de devolução imediatamente.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" /> Solicitar Troca no WhatsApp
              </a>
              <Button onClick={() => setActiveModal(null)} className="hub-bg-primary text-black font-black text-xs uppercase px-6">
                Entendi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 13. MODAL: PRIVACIDADE & LGPD                                             */}
      {/* ========================================================================= */}
      {activeModal === "privacy" && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111116] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase text-white italic">Privacidade & Dados (LGPD)</h3>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Conformidade com a Lei Federal nº 13.709/2018</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <p>
                A <strong>{store.name}</strong> respeita integralmente a privacidade dos seus clientes e adota os mais rigorosos padrões de segurança cibernética para o tratamento de dados pessoais.
              </p>

              <div className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-2">
                <h4 className="font-black text-white uppercase text-xs">Quais dados coletamos e por quê:</h4>
                <ul className="list-disc pl-5 space-y-1 text-xs text-slate-400">
                  <li><strong>Nome, CPF e Endereço:</strong> Coletados exclusivamente para emissão de nota fiscal eletrônica e envio pelos Correios / transportadoras.</li>
                  <li><strong>E-mail e Telefone:</strong> Para envio das notificações de rastreamento do pedido e suporte humanizado via WhatsApp.</li>
                  <li><strong>Dados de Pagamento:</strong> Processados em ambiente seguro diretamente pelo gateway com criptografia ponta a ponta. Nossa loja <strong>nunca armazena números de cartões de crédito</strong>.</li>
                </ul>
              </div>

              <div className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-2">
                <h4 className="font-black text-white uppercase text-xs">Seus Direitos como Titular (Art. 18 da LGPD):</h4>
                <p className="text-xs text-slate-400">
                  Você tem o direito de solicitar a confirmação da existência de tratamento, o acesso aos seus dados, a correção de dados incompletos ou a <strong>eliminação definitiva dos seus dados</strong> da nossa base a qualquer momento através do e-mail de privacidade.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end">
              <Button onClick={() => setActiveModal(null)} className="hub-bg-primary text-black font-black text-xs uppercase px-6">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 14. MOBILE MENU DRAWER (HAMBURGER)                                        */}
      {/* ========================================================================= */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex">
          <div className="w-4/5 max-w-sm h-full bg-[#0e0e12] border-r border-white/10 p-6 flex flex-col justify-between animate-in slide-in-from-left duration-300">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="font-black text-lg uppercase text-white tracking-tight">{store.name}</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white p-1">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <nav className="space-y-4 text-sm font-bold uppercase tracking-wider">
                <a
                  href="#catalogo"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block text-slate-200 hover:text-cyan-400 py-2 border-b border-white/5"
                >
                  🛍️ Catálogo de Produtos
                </a>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setActiveModal("about");
                  }}
                  className="w-full text-left text-slate-200 hover:text-cyan-400 py-2 border-b border-white/5"
                >
                  🏢 Sobre Nós
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setActiveModal("tracking");
                  }}
                  className="w-full text-left text-slate-200 hover:text-cyan-400 py-2 border-b border-white/5 flex items-center justify-between"
                >
                  <span>📦 Rastrear Pedido</span>
                  <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">Rápido</span>
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setActiveModal("returns");
                  }}
                  className="w-full text-left text-slate-200 hover:text-cyan-400 py-2 border-b border-white/5"
                >
                  🔄 Trocas & Devoluções
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setActiveModal("privacy");
                  }}
                  className="w-full text-left text-slate-200 hover:text-cyan-400 py-2 border-b border-white/5"
                >
                  🛡️ Privacidade & LGPD
                </button>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-emerald-400 hover:text-emerald-300 py-2 flex items-center gap-2"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp da Loja
                </a>
              </nav>
            </div>

            <div className="pt-4 border-t border-white/10 text-xs text-slate-500">
              <p>© 2026 {store.name}</p>
              <p className="text-[10px] font-black uppercase text-slate-600 mt-1">Mobile E-Commerce Engine</p>
            </div>
          </div>
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 15. SHOPPING CART DRAWER                                                  */}
      {/* ========================================================================= */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div
            className="w-full max-w-md h-full flex flex-col p-6 shadow-2xl animate-in slide-in-from-right duration-300"
            style={{
              backgroundColor: surfaceColor,
              borderLeft: `1px solid ${borderColor}`,
            }}
          >
            <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor }}>
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-white" />
                <h3 className="text-base font-black uppercase text-white">Carrinho de Compras</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {cart.length === 0 ? (
                <div className="py-20 text-center space-y-3 text-slate-500">
                  <ShoppingBag className="h-10 w-10 mx-auto opacity-30" />
                  <p className="text-xs font-bold uppercase">Seu carrinho está vazio.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center gap-3 p-3 rounded-2xl border bg-black/30"
                    style={{ borderColor }}
                  >
                    <img
                      src={
                        item.product.images && item.product.images[0] && !item.product.images[0].startsWith("data:") && !item.product.images[0].includes("mercadolibre.png")
                          ? item.product.images[0]
                          : "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop&q=80"
                      }
                      alt={item.product.title}
                      className="h-14 w-14 object-cover rounded-xl bg-black"
                      onError={(e) => {
                        e.currentTarget.src = "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop&q=80";
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{item.product.title}</p>
                      <p className="text-xs font-black" style={{ color: primaryColor }}>
                        R$ {Number(item.product.price || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="h-5 w-5 rounded bg-white/10 text-white flex items-center justify-center text-xs hover:bg-white/20"
                        >
                          -
                        </button>
                        <span className="text-xs font-mono text-white">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="h-5 w-5 rounded bg-white/10 text-white flex items-center justify-center text-xs hover:bg-white/20"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="pt-4 border-t space-y-4" style={{ borderColor }}>
                <div className="flex items-center justify-between text-sm font-black text-white">
                  <span>Total do Pedido:</span>
                  <span style={{ color: primaryColor }}>
                    R$ {totalCartValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <Button
                  onClick={() => {
                    toast.success("Pedido finalizado com sucesso! Redirecionando para o gateway...");
                    setCart([]);
                    setIsCartOpen(false);
                  }}
                  className="w-full h-12 rounded-2xl font-black text-xs uppercase tracking-widest text-black shadow-xl hover:scale-102 transition-all"
                  style={{ backgroundColor: primaryColor }}
                >
                  Finalizar Compra Segura
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
