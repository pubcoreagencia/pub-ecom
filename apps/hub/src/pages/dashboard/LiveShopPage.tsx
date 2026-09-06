import * as React from "react";
import { useState, useEffect } from "react";
import { Shell } from "@/components/layout/Shell";
import { WorldMapLive, GeoVisitor } from "@/components/live/WorldMapLive";
import {
  Users,
  ShoppingCart,
  CheckCircle2,
  TrendingUp,
  Globe,
  Flame,
  ArrowRight,
  Send,
  Database,
  Search,
  Filter,
  Eye,
  Instagram,
  Youtube,
  ShieldCheck,
  Zap,
  Activity,
  Phone,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Layers,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Initial Mock Stream of Live Geo-tracked Visitors with Coordinates and Deep Qualifications
const INITIAL_VISITORS: GeoVisitor[] = [
  {
    id: "lead-001",
    name: "Camila Rodrigues",
    city: "São Paulo",
    state: "SP",
    country: "Brasil",
    lat: -23.5505,
    lng: -46.6333,
    ip: "189.120.45.xx",
    device: "mobile",
    page: "/store?category=Mulher%20%26%20Beleza",
    action: "cart",
    productName: "Kit Sérum Facial Rejuvenescedor Ácido Hialurônico",
    productPrice: 189.90,
    timeOnSite: "4m 32s",
    score: 88,
    gender: "Feminino",
    age: 29,
    socials: {
      instagramFollower: true,
      youtubeSubscriber: true,
      interactionCount: 14,
    },
  },
  {
    id: "lead-002",
    name: "Lucas Mendes",
    city: "Rio de Janeiro",
    state: "RJ",
    country: "Brasil",
    lat: -22.9068,
    lng: -43.1729,
    ip: "201.88.14.xx",
    device: "mobile",
    page: "/store?category=Fitness%20%26%20Academia",
    action: "checkout",
    productName: "Cinto de Carga Lombar Powerlifting Pro",
    productPrice: 249.00,
    timeOnSite: "7m 18s",
    score: 94,
    gender: "Masculino",
    age: 33,
    socials: {
      instagramFollower: true,
      youtubeSubscriber: false,
      interactionCount: 8,
    },
  },
  {
    id: "lead-003",
    name: "Beatriz Silveira",
    city: "Curitiba",
    state: "PR",
    country: "Brasil",
    lat: -25.4290,
    lng: -49.2671,
    ip: "177.18.92.xx",
    device: "desktop",
    page: "/store?category=Pet%20Shop",
    action: "purchased",
    productName: "Cama Ortopédica Pet Memory Foam Grande",
    productPrice: 329.90,
    timeOnSite: "11m 40s",
    score: 98,
    gender: "Feminino",
    age: 38,
    socials: {
      instagramFollower: true,
      youtubeSubscriber: true,
      interactionCount: 22,
    },
  },
  {
    id: "lead-004",
    name: "Rodrigo Costa",
    city: "Belo Horizonte",
    state: "MG",
    country: "Brasil",
    lat: -19.9167,
    lng: -43.9345,
    ip: "179.215.30.xx",
    device: "mobile",
    page: "/store?category=Futebol",
    action: "cart",
    productName: "Manto Retrô Edição Ouro 1982 Oficial",
    productPrice: 219.00,
    timeOnSite: "3m 12s",
    score: 82,
    gender: "Masculino",
    age: 27,
    socials: {
      instagramFollower: false,
      youtubeSubscriber: true,
      interactionCount: 5,
    },
  },
  {
    id: "lead-005",
    name: "Fernanda Albuquerque",
    city: "Brasília",
    state: "DF",
    country: "Brasil",
    lat: -15.7942,
    lng: -47.8822,
    ip: "187.100.22.xx",
    device: "desktop",
    page: "/store?category=Casa%20%26%20Decor",
    action: "viewing",
    productName: "Organizador Giratório Acrílico Duplo 360",
    productPrice: 89.90,
    timeOnSite: "2m 05s",
    score: 64,
    gender: "Feminino",
    age: 42,
    socials: {
      instagramFollower: true,
      youtubeSubscriber: false,
      interactionCount: 3,
    },
  },
  {
    id: "lead-006",
    name: "Gustavo Nogueira",
    city: "Porto Alegre",
    state: "RS",
    country: "Brasil",
    lat: -30.0346,
    lng: -51.2177,
    ip: "200.198.55.xx",
    device: "mobile",
    page: "/store?category=Gamer%20%26%20Setup",
    action: "checkout",
    productName: "Teclado Mecânico RGB Hot-Swap Switch Red",
    productPrice: 299.90,
    timeOnSite: "9m 45s",
    score: 91,
    gender: "Masculino",
    age: 23,
    socials: {
      instagramFollower: true,
      youtubeSubscriber: true,
      interactionCount: 19,
    },
  },
  {
    id: "lead-007",
    name: "Mariana Fontes",
    city: "Lisboa",
    state: "LX",
    country: "Portugal",
    lat: 38.7223,
    lng: -9.1393,
    ip: "85.240.11.xx",
    device: "desktop",
    page: "/store?category=Joias%20%26%20Luxo",
    action: "viewing",
    productName: "Colar Ponto de Luz Ouro 18k Zircônia",
    productPrice: 159.00,
    timeOnSite: "5m 20s",
    score: 74,
    gender: "Feminino",
    age: 35,
    socials: {
      instagramFollower: true,
      youtubeSubscriber: false,
      interactionCount: 7,
    },
  },
  {
    id: "lead-008",
    name: "Thiago Oliveira",
    city: "Miami",
    state: "FL",
    country: "Estados Unidos",
    lat: 25.7617,
    lng: -80.1918,
    ip: "104.28.19.xx",
    device: "mobile",
    page: "/store?category=Tecnologia",
    action: "cart",
    productName: "Smartwatch AMOLED GPS Tracker Esportivo",
    productPrice: 389.00,
    timeOnSite: "6m 15s",
    score: 85,
    gender: "Masculino",
    age: 31,
    socials: {
      instagramFollower: false,
      youtubeSubscriber: true,
      interactionCount: 6,
    },
  },
];

export default function LiveShopPage() {
  const [visitors, setVisitors] = useState<GeoVisitor[]>(INITIAL_VISITORS);
  const [selectedVisitor, setSelectedVisitor] = useState<GeoVisitor | null>(null);
  const [activeTab, setActiveTab] = useState<"map" | "journey" | "funnel_dbs">("map");
  const [activeDbLevel, setActiveDbLevel] = useState<1 | 2 | 3>(2);
  const [leadSearch, setLeadSearch] = useState("");

  // Live simulation ticker: updates visitors status smoothly
  useEffect(() => {
    const interval = setInterval(() => {
      setVisitors((prev) =>
        prev.map((v) => {
          if (Math.random() > 0.65) {
            const actions: GeoVisitor["action"][] = ["viewing", "cart", "checkout", "purchased"];
            const nextAction: GeoVisitor["action"] = actions[Math.floor(Math.random() * actions.length)] ?? "viewing";
            return {
              ...v,
              action: nextAction,
              score: Math.min(100, Math.max(30, v.score + (Math.random() > 0.5 ? 2 : -1))),
            };
          }
          return v;
        }),
      );
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const totalRevenue = visitors
    .filter((v) => v.action === "purchased")
    .reduce((acc, v) => acc + (v.productPrice || 149.9), 0);

  const handleSendWhatsAppOutbound = (visitor: GeoVisitor) => {
    const phone = "5511999999999";
    const msg = encodeURIComponent(
      `Olá ${visitor.name}! Vi que você demonstrou interesse no "${visitor.productName || "produto"}" na nossa loja. Temos um cupom exclusivo com Frete FULL Grátis para ${visitor.city} hoje! Gostaria de aproveitar?`,
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
    toast.success(`Disparo outbound iniciado para ${visitor.name} (${visitor.city})!`);
  };

  const filteredVisitors = visitors.filter(
    (v) =>
      v.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      v.city.toLowerCase().includes(leadSearch.toLowerCase()) ||
      v.state.toLowerCase().includes(leadSearch.toLowerCase()) ||
      (v.productName && v.productName.toLowerCase().includes(leadSearch.toLowerCase())),
  );

  return (
    <Shell>
      <div className="space-y-8 pb-16">
        {/* TOP BAR / LIVE STREAM STATUS */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--hub-border)] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                Live Shop • Centro de Comando Global
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider border border-red-500/30">
                🔴 24H NO AR
              </span>
            </div>
            <p className="text-[11px] text-[var(--hub-muted)] uppercase tracking-wider font-mono">
              Telemetria baseada em Latitude/Longitude e Funil de 3 Bancos de Dados
            </p>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-black/50 p-1.5 rounded-2xl border border-[var(--hub-border)]">
            <button
              onClick={() => setActiveTab("map")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                activeTab === "map"
                  ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white",
              )}
            >
              <Globe className="h-4 w-4" />
              Globo Terrestre 3D (Live Radar)
            </button>
            <button
              onClick={() => setActiveTab("journey")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                activeTab === "journey"
                  ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white",
              )}
            >
              <Activity className="h-4 w-4" />
              Esteira do Percurso
            </button>
            <button
              onClick={() => setActiveTab("funnel_dbs")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                activeTab === "funnel_dbs"
                  ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white",
              )}
            >
              <Database className="h-4 w-4" />
              Hierarquia dos 3 Bancos
            </button>
          </div>
        </div>

        {/* 4 TOP LIVE KPIS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="hub-card p-5 rounded-3xl border border-[var(--hub-border)] bg-black/40 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--hub-muted)]">
                Visitantes Ativos Agora
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white italic">1.482</span>
              <span className="text-xs font-bold text-emerald-400">+18% vs ontem</span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-1">Conexões WebSockets ativas</p>
          </div>

          <div className="hub-card p-5 rounded-3xl border border-[var(--hub-border)] bg-black/40 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--hub-muted)]">
                Carrinhos em Aberto
              </span>
              <ShoppingCart className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-cyan-400 italic">214</span>
              <span className="text-xs font-bold text-cyan-300 font-mono">R$ 48.920 em valor</span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-1">Gatilhos de recuperação ativos</p>
          </div>

          <div className="hub-card p-5 rounded-3xl border border-[var(--hub-border)] bg-black/40 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--hub-muted)]">
                Vendas Aprovadas Hoje
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400 italic">76</span>
              <span className="text-xs font-bold text-emerald-300 font-mono">Taxa 4.2%</span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-1">FULL: Despacho no mesmo dia</p>
          </div>

          <div className="hub-card p-5 rounded-3xl border border-[var(--hub-border)] bg-black/40 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--hub-muted)]">
                Faturamento Live
              </span>
              <TrendingUp className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-300 italic">
                R$ {(18450 + totalRevenue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-1">Ticket Médio: R$ 242,70</p>
          </div>
        </div>

        {/* TAB 1: RADAR GEOGRÁFICO LAT/LONG MAPA MUNDI */}
        {activeTab === "map" && (
          <div className="space-y-6">
            <WorldMapLive
              visitors={visitors}
              selectedVisitor={selectedVisitor}
              onSelectVisitor={setSelectedVisitor}
            />
          </div>
        )}

        {/* TAB 2: ESTEIRA DE ACOMPANHAMENTO DO PERCURSO DO CLIENTE DENTRO DO SITE */}
        {activeTab === "journey" && (
          <div className="space-y-6">
            {/* Horizontal Stepper Diagram */}
            <div className="hub-card p-6 rounded-3xl border border-[var(--hub-border)] bg-black/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-white uppercase italic">
                    Esteira Contínua do Percurso no Site
                  </h3>
                  <p className="text-[11px] text-[var(--hub-muted)] uppercase tracking-wider">
                    Monitoramento passo a passo de cada transição de tela
                  </p>
                </div>
                <span className="text-xs font-mono text-cyan-400 font-bold">Taxa de Avanço: 68.4%</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
                {[
                  { step: "1. Entrada", label: "Acessou Home", icon: Globe, count: "1.482", color: "border-purple-500 text-purple-400" },
                  { step: "2. Exploração", label: "Filtrou Categoria", icon: Eye, count: "894", color: "border-blue-500 text-blue-400" },
                  { step: "3. Produto", label: "Abriu Detalhe", icon: Sparkles, count: "542", color: "border-cyan-500 text-cyan-400" },
                  { step: "4. Carrinho", label: "Add ao Carrinho", icon: ShoppingCart, count: "214", color: "border-amber-500 text-amber-400" },
                  { step: "5. Logística", label: "Calculou CEP/FULL", icon: Flame, count: "148", color: "border-orange-500 text-orange-400" },
                  { step: "6. Conversão", label: "Compra Aprovada", icon: CheckCircle2, count: "76", color: "border-emerald-500 text-emerald-400" },
                ].map((st, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-4 rounded-2xl bg-[#0e121a] border flex flex-col justify-between space-y-2 relative group",
                      st.color,
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider opacity-80">{st.step}</span>
                      <st.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">{st.label}</p>
                      <p className="text-lg font-black italic mt-0.5">{st.count}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Journey Stream Feed */}
            <div className="hub-card p-6 rounded-3xl border border-[var(--hub-border)] bg-black/40 space-y-4">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Eventos de Percurso ao Vivo (Live Timeline)
              </h4>
              <div className="space-y-2.5">
                {visitors.map((v) => (
                  <div
                    key={v.id}
                    className="p-3.5 rounded-2xl bg-black/60 border border-[var(--hub-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-cyan-500/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-black text-cyan-400 text-xs">
                        {v.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white">{v.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-bold">
                            ({v.city} - {v.state})
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Score {v.score}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5 font-sans">
                          {v.action === "purchased" && "🎉 Comprou com Frete FULL: "}
                          {v.action === "checkout" && "💳 Preenchendo pagamento para: "}
                          {v.action === "cart" && "🛒 Adicionou ao carrinho: "}
                          {v.action === "viewing" && "👁️ Navegando na página de: "}
                          <strong className="text-amber-300 font-bold">{v.productName || v.page}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <span className="text-[10px] text-cyan-400 font-mono font-bold bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                        {v.timeOnSite}
                      </span>
                      <button
                        onClick={() => handleSendWhatsAppOutbound(v)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                      >
                        <MessageCircle className="h-3 w-3" />
                        WhatsApp
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ARQUITETURA DOS 3 BANCOS DE DADOS DE FUNIL */}
        {activeTab === "funnel_dbs" && (
          <div className="space-y-6">
            {/* 3-Tier Architecture Tabs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* BANCO 1 */}
              <div
                onClick={() => setActiveDbLevel(1)}
                className={cn(
                  "p-6 rounded-3xl border cursor-pointer transition-all relative overflow-hidden",
                  activeDbLevel === 1
                    ? "bg-purple-950/30 border-purple-500 shadow-xl shadow-purple-500/10"
                    : "bg-black/40 border-[var(--hub-border)] hover:border-purple-500/40",
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    NÍVEL 1 • BASE DO FUNIL
                  </span>
                  <Database className="h-5 w-5 text-purple-400" />
                </div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tight">
                  Banco 1: Leads Rastreados
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Ingestão bruta de Pixel: UTMs, Latitude/Longitude, IPs mascarados, páginas vistas e tempo de sessão.
                </p>
                <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400">Total Ingerido:</span>
                  <span className="font-black text-purple-400">184.200 leads</span>
                </div>
              </div>

              {/* BANCO 2 */}
              <div
                onClick={() => setActiveDbLevel(2)}
                className={cn(
                  "p-6 rounded-3xl border cursor-pointer transition-all relative overflow-hidden",
                  activeDbLevel === 2
                    ? "bg-cyan-950/30 border-cyan-500 shadow-xl shadow-cyan-500/10"
                    : "bg-black/40 border-[var(--hub-border)] hover:border-cyan-500/40",
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    NÍVEL 2 • QUALIFICAÇÃO
                  </span>
                  <Sparkles className="h-5 w-5 text-cyan-400" />
                </div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tight">
                  Banco 2: Lead Scoring Vault
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Qualificação profunda: Demografia (gênero, idade), redes conectadas (IG, YT), frequência de visualização e compras.
                </p>
                <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400">Qualificados:</span>
                  <span className="font-black text-cyan-400">38.450 leads (20.8%)</span>
                </div>
              </div>

              {/* BANCO 3 */}
              <div
                onClick={() => setActiveDbLevel(3)}
                className={cn(
                  "p-6 rounded-3xl border cursor-pointer transition-all relative overflow-hidden",
                  activeDbLevel === 3
                    ? "bg-emerald-950/30 border-emerald-500 shadow-xl shadow-emerald-500/10"
                    : "bg-black/40 border-[var(--hub-border)] hover:border-emerald-500/40",
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    NÍVEL 3 • TOPO & CONVERSÃO
                  </span>
                  <Zap className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tight">
                  Banco 3: Conversão Ativa & Passiva
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Ativa (WhatsApp, LinkedIn, Instagram Direct) e Passiva (Retargeting Pixel dinâmico, SEO, Inbound).
                </p>
                <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400">Convertidos:</span>
                  <span className="font-black text-emerald-400">9.820 vendas (25.5%)</span>
                </div>
              </div>
            </div>

            {/* Detailed View of the Active DB Level */}
            <div className="hub-card p-6 rounded-3xl border border-[var(--hub-border)] bg-black/40 space-y-6">
              {activeDbLevel === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Database className="h-6 w-6 text-purple-400" />
                    <div>
                      <h4 className="text-base font-black text-white uppercase italic">
                        Banco 1: Telemetria Bruta de Pixel & Rastreamento
                      </h4>
                      <p className="text-xs text-slate-400">
                        Camada de ingestão instantânea coletada em cada requisição de visitante
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                    <div className="p-4 rounded-2xl bg-black/50 border border-white/10">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Origem de Tráfego</span>
                      <p className="text-sm font-black text-white mt-1">Meta Ads (44%)</p>
                      <p className="text-[10px] text-slate-500">Google Ads (31%) • Orgânico (25%)</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-black/50 border border-white/10">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Dispositivos</span>
                      <p className="text-sm font-black text-white mt-1">Mobile 89.4%</p>
                      <p className="text-[10px] text-slate-500">Desktop 10.6%</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-black/50 border border-white/10">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Top Geolocalização</span>
                      <p className="text-sm font-black text-white mt-1">SP • RJ • PR • MG</p>
                      <p className="text-[10px] text-slate-500">Regiões com Frete FULL 24h</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-black/50 border border-white/10">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Tempo Médio na Loja</span>
                      <p className="text-sm font-black text-white mt-1">5m 48s</p>
                      <p className="text-[10px] text-slate-500">Páginas por Sessão: 4.2</p>
                    </div>
                  </div>
                </div>
              )}

              {activeDbLevel === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-6 w-6 text-cyan-400" />
                    <div>
                      <h4 className="text-base font-black text-white uppercase italic">
                        Banco 2: Plantel Rico de Qualificação & Lead Scoring
                      </h4>
                      <p className="text-xs text-slate-400">
                        Enriquecimento comportamental e social para priorização de conversão
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">1. Demografia & Geolocal</span>
                      <ul className="text-xs space-y-1 text-slate-300">
                        <li>• Gênero: 58% Feminino / 42% Masculino</li>
                        <li>• Faixa Etária: 24 a 45 anos (Pico em 32 anos)</li>
                        <li>• Coordenadas exatas para cálculo de Frete FULL</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">2. Social & Engajamento</span>
                      <ul className="text-xs space-y-1 text-slate-300">
                        <li>• 64% dos leads seguem a marca no Instagram</li>
                        <li>• 41% são inscritos no canal do YouTube</li>
                        <li>• Média de 8.5 interações com posts nos últimos 30 dias</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">3. Histórico de Compras</span>
                      <ul className="text-xs space-y-1 text-slate-300">
                        <li>• 28% são clientes recorrentes (LTV R$ 680+)</li>
                        <li>• 72% em primeira compra qualificada</li>
                        <li>• Intenção alta detectada por adição ao carrinho</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {activeDbLevel === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Zap className="h-6 w-6 text-emerald-400" />
                    <div>
                      <h4 className="text-base font-black text-white uppercase italic">
                        Banco 3: Motores de Conversão Ativa & Passiva
                      </h4>
                      <p className="text-xs text-slate-400">
                        Aceleração de fechamento para os leads que alcançaram a pontuação mínima
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-wider">
                        <MessageCircle className="h-4 w-4" />
                        Conversão Ativa (Outbound)
                      </div>
                      <p className="text-xs text-slate-300">
                        Prospecção comercial direta via WhatsApp, Instagram Direct e LinkedIn para leads com score &gt; 80.
                      </p>
                      <div className="text-[11px] font-mono text-emerald-300 bg-black/40 p-3 rounded-xl border border-emerald-500/20">
                        ⚡ Mensagem pré-formatada com Frete FULL Grátis e cupom de fechamento imediato.
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-3">
                      <div className="flex items-center gap-2 text-cyan-400 font-black text-xs uppercase tracking-wider">
                        <Flame className="h-4 w-4" />
                        Conversão Passiva (Inbound)
                      </div>
                      <p className="text-xs text-slate-300">
                        Retargeting dinâmico via Meta Pixel e Google Tag com catálogo espelhado, automações de e-mail e SEO.
                      </p>
                      <div className="text-[11px] font-mono text-cyan-300 bg-black/40 p-3 rounded-xl border border-cyan-500/20">
                        🎯 Anúncios dinâmicos com o produto exato abandonado no carrinho em até 15 minutos.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TABELA AO VIVO DOS LEADS QUALIFICADOS (PLANTEL RICO) */}
        <div className="hub-card p-6 rounded-3xl border border-[var(--hub-border)] bg-black/40 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-white uppercase italic">
                Plantel de Leads Qualificados em Tempo Real
              </h3>
              <p className="text-[11px] text-[var(--hub-muted)] uppercase tracking-wider">
                Leads transferidos do Banco 1 para o Banco 2 e prontos para o Banco 3
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-black/60 px-3.5 py-2 rounded-xl border border-white/10 focus-within:border-cyan-500 transition-all w-64">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar Lead ou Cidade..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  className="bg-transparent border-none text-xs text-white focus:outline-none w-full"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--hub-border)] text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  <th className="pb-3 pl-2">Lead / Gênero / Idade</th>
                  <th className="pb-3">Geolocal (Lat/Lng)</th>
                  <th className="pb-3">Score &amp; Social</th>
                  <th className="pb-3">Status de Percurso</th>
                  <th className="pb-3">Interesse</th>
                  <th className="pb-3 text-right pr-2">Ação Outbound</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredVisitors.map((v) => (
                  <tr key={v.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="py-3.5 pl-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-black text-cyan-400 text-xs">
                          {v.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-white">{v.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {v.gender} • {v.age} anos
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5">
                      <p className="text-white font-bold">{v.city} - {v.state}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {v.lat.toFixed(2)}°, {v.lng.toFixed(2)}°
                      </p>
                    </td>

                    <td className="py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-black font-mono",
                            v.score >= 85
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : v.score >= 70
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                              : "bg-purple-500/20 text-purple-300 border border-purple-500/30",
                          )}
                        >
                          {v.score} pts
                        </span>
                        <div className="flex items-center gap-1 text-slate-400">
                          {v.socials.instagramFollower && <Instagram className="h-3 w-3 text-pink-400" />}
                          {v.socials.youtubeSubscriber && <Youtube className="h-3 w-3 text-red-400" />}
                          <span className="text-[9px] font-mono">({v.socials.interactionCount}x)</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5">
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1",
                          v.action === "purchased" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                          v.action === "checkout" && "bg-amber-500/10 text-amber-300 border border-amber-500/20",
                          v.action === "cart" && "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20",
                          v.action === "viewing" && "bg-purple-500/10 text-purple-300 border border-purple-500/20",
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {v.action === "purchased" && "Compra Aprovada"}
                        {v.action === "checkout" && "No Checkout"}
                        {v.action === "cart" && "Com Carrinho"}
                        {v.action === "viewing" && "Visualizando"}
                      </span>
                    </td>

                    <td className="py-3.5">
                      <p className="text-white font-bold truncate max-w-[200px]">{v.productName || "Catálogo Geral"}</p>
                      {v.productPrice && (
                        <p className="text-[10px] text-amber-300 font-mono font-bold">
                          R$ {v.productPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </td>

                    <td className="py-3.5 text-right pr-2">
                      <button
                        onClick={() => handleSendWhatsAppOutbound(v)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] uppercase tracking-wider inline-flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all"
                      >
                        <MessageCircle className="h-3 w-3" />
                        Chamar WhatsApp
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
