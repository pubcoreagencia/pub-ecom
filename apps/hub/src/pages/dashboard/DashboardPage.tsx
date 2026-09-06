import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Shell } from "@/components/layout/Shell";
import { CardMetric } from "@/components/ui-b";
import { WorldMapLive, GeoVisitor } from "@/components/live/WorldMapLive";
import { cn } from "@/lib/utils";
import {
  Package,
  Store as StoreIcon,
  Activity,
  Zap,
  RefreshCw,
  Search,
  Box,
  Globe,
  ShoppingCart,
  Users,
  CheckCircle2,
  TrendingUp,
  Database,
  ShieldCheck,
  Smartphone,
  Laptop,
  Flame,
  ArrowRight,
  Eye,
  Instagram,
  Youtube,
  Layers,
  Sparkles,
} from "lucide-react";
import { catalogApi } from "@/lib/api/catalog";
import { CatalogStats } from "@/lib/api/types";
import { toast } from "sonner";

// Live Telemetry Stream of Geo-tracked Visitors
const LIVE_VISITORS_FEED: GeoVisitor[] = [
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
    name: "Rafael Nogueira",
    city: "Belo Horizonte",
    state: "MG",
    country: "Brasil",
    lat: -19.9167,
    lng: -43.9345,
    ip: "186.215.30.xx",
    device: "mobile",
    page: "/store?category=Vestu%C3%A1rio%20%26%20Moda",
    action: "viewing",
    productName: "Babuche Confort Ultra Soft Antiderrapante",
    productPrice: 79.90,
    timeOnSite: "1m 15s",
    score: 62,
    gender: "Masculino",
    age: 26,
    socials: {
      instagramFollower: false,
      youtubeSubscriber: false,
      interactionCount: 3,
    },
  },
  {
    id: "lead-005",
    name: "Mariana Costa",
    city: "Porto Alegre",
    state: "RS",
    country: "Brasil",
    lat: -30.0346,
    lng: -51.2177,
    ip: "179.106.77.xx",
    device: "mobile",
    page: "/store?category=Mulher%20%26%20Beleza",
    action: "cart",
    productName: "Relógio Smartwatch Fitness Amoled Rosa",
    productPrice: 219.00,
    timeOnSite: "5m 45s",
    score: 85,
    gender: "Feminino",
    age: 31,
    socials: {
      instagramFollower: true,
      youtubeSubscriber: false,
      interactionCount: 9,
    },
  },
  {
    id: "lead-006",
    name: "Thiago Albuquerque",
    city: "Lisboa",
    state: "PT",
    country: "Portugal",
    lat: 38.7223,
    lng: -9.1393,
    ip: "194.65.112.xx",
    device: "desktop",
    page: "/store?category=Audio%20%26%20Studio",
    action: "viewing",
    productName: "Microfone Condensador Podcast XLR/USB Pro",
    productPrice: 489.00,
    timeOnSite: "3m 10s",
    score: 74,
    gender: "Masculino",
    age: 35,
    socials: {
      instagramFollower: true,
      youtubeSubscriber: true,
      interactionCount: 16,
    },
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [visitors, setVisitors] = useState<GeoVisitor[]>(LIVE_VISITORS_FEED);
  const [selectedVisitor, setSelectedVisitor] = useState<GeoVisitor | null>(LIVE_VISITORS_FEED[0] ?? null);
  const [activeDbTab, setActiveDbTab] = useState<"db1" | "db2" | "db3">("db1");

  const fetchStats = () => {
    setLoading(true);
    catalogApi
      .getStats()
      .then(setStats)
      .catch((e) => {
        console.error(e);
        if (e.status === 401 || e.isAuthError) {
          toast.error(
            e.message || "Usuário não autenticado. Faça login no Supabase para acessar o catálogo.",
          );
        } else {
          toast.error(e.message || "Falha ao conectar com o backend real");
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Telemetry Calculations
  const activeVisitorsCount = visitors.length;
  const activeCartsCount = visitors.filter((v) => v.action === "cart").length;
  const checkoutsCount = visitors.filter((v) => v.action === "checkout" || v.action === "purchased").length;
  const purchasesCount = visitors.filter((v) => v.action === "purchased").length;
  const conversionRate = ((purchasesCount / activeVisitorsCount) * 100).toFixed(1);

  return (
    <Shell>
      <div className="space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--hub-border)] pb-6">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-white italic flex items-center gap-2.5">
              <span>Painel Executivo & Live Telemetry Hub</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_#22c55e]" />
            </h1>
            <p className="text-[var(--hub-muted)] text-[10px] font-bold uppercase tracking-[0.3em] mt-1">
              PUB ECOM Holding Master · Visão Global Georreferenciada · Funil Multi-DB
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/ingestion"
              className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-[0.2em] px-5 py-2.5 rounded-xl shadow-lg shadow-red-600/20 flex items-center gap-2 transition-transform hover:scale-105"
            >
              <Search className="w-4 h-4" />
              Importar Produto
            </Link>
            <Link
              to="/dashboard/products"
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-[11px] font-black uppercase tracking-[0.2em] px-5 py-2.5 rounded-xl flex items-center gap-2 transition-colors"
            >
              <Box className="w-4 h-4" />
              Catálogo Master
            </Link>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="text-[10px] font-black text-[var(--hub-primary)] uppercase tracking-widest hover:underline italic flex items-center gap-2 ml-2"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Atualizar
            </button>
          </div>
        </div>

        {/* 1. SEÇÃO DE TELEMETRIA AO VIVO & KPIs GLOBAIS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <CardMetric
            label="Produtos no Catálogo"
            value={stats?.stats.products.toString() || "0"}
            subtext="Banco D1 Real"
            icon={Package}
          />
          <CardMetric
            label="Fornecedores Conectados"
            value={stats?.stats.stores.toString() || "0"}
            subtext={`${stats?.stats.activeStores || 0} Ativos`}
            icon={StoreIcon}
          />
          <div className="hub-card p-4 bg-emerald-950/20 border border-emerald-500/30 space-y-1">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-[9px] font-black uppercase tracking-widest">Visitantes Ao Vivo</span>
              <Users className="h-3.5 w-3.5" />
            </div>
            <p className="text-xl font-black text-white italic flex items-center gap-1.5">
              <span>{activeVisitorsCount}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </p>
            <span className="text-[9px] font-mono text-emerald-400/80">Geo-rastreados por IP</span>
          </div>

          <div className="hub-card p-4 bg-sky-950/20 border border-sky-500/30 space-y-1">
            <div className="flex items-center justify-between text-sky-400">
              <span className="text-[9px] font-black uppercase tracking-widest">Carrinhos Ativos</span>
              <ShoppingCart className="h-3.5 w-3.5" />
            </div>
            <p className="text-xl font-black text-white italic">{activeCartsCount}</p>
            <span className="text-[9px] font-mono text-sky-400/80">Intenção de Compra L2</span>
          </div>

          <div className="hub-card p-4 bg-amber-950/20 border border-amber-500/30 space-y-1">
            <div className="flex items-center justify-between text-amber-400">
              <span className="text-[9px] font-black uppercase tracking-widest">Checkouts L3</span>
              <Activity className="h-3.5 w-3.5" />
            </div>
            <p className="text-xl font-black text-white italic">{checkoutsCount}</p>
            <span className="text-[9px] font-mono text-amber-400/80">Em Digitação de Dados</span>
          </div>

          <div className="hub-card p-4 bg-[var(--hub-primary)]/10 border border-[var(--hub-primary)]/30 space-y-1">
            <div className="flex items-center justify-between text-[var(--hub-primary)]">
              <span className="text-[9px] font-black uppercase tracking-widest">Taxa de Conversão</span>
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
            <p className="text-xl font-black text-white italic">{conversionRate}%</p>
            <span className="text-[9px] font-mono text-[var(--hub-primary)]">Sessões Convertidas</span>
          </div>
        </div>

        {/* 2. O MAPA MUNDI EM TEMPO REAL COM LAT/LNG E AVATARES HABBO */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white italic flex items-center gap-2">
                <Globe className="h-4 w-4 text-[var(--hub-primary)]" />
                Live Shop Georreferenciada · Mapa Mundi com Latitude & Longitude
              </h3>
              <p className="text-[10px] text-[var(--hub-muted)] uppercase tracking-widest mt-0.5">
                Rastreamento por IP e Geolocation API com Avatares Isométricos Estilo Habbo Hotel
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1 text-purple-400"><span className="h-2 w-2 rounded-full bg-purple-500 inline-block" /> Navegando</span>
              <span className="flex items-center gap-1 text-sky-400"><span className="h-2 w-2 rounded-full bg-sky-500 inline-block" /> Carrinho</span>
              <span className="flex items-center gap-1 text-amber-400"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Checkout</span>
              <span className="flex items-center gap-1 text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Compra Realizada</span>
            </div>
          </div>

          <div className="hub-card p-6 bg-black/40 border border-[var(--hub-border)]">
            <WorldMapLive
              visitors={visitors}
              selectedVisitor={selectedVisitor}
              onSelectVisitor={(v) => setSelectedVisitor(v)}
            />
          </div>
        </div>

        {/* 3. ESTEIRA DO FUNIL DE 3 BANCOS DE DADOS (3-Tier Multi-DB Pipeline) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--hub-border)] pb-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white italic flex items-center gap-2">
                <Database className="h-4 w-4 text-[var(--hub-primary)]" />
                Esteira de Funil de Dados · Da Base ao Topo da Conversão
              </h3>
              <p className="text-[10px] text-[var(--hub-muted)] uppercase tracking-widest mt-0.5">
                Arquitetura de Dados em Camadas: Pixel Ingestion → Lead Scoring IA → Conversão Final
              </p>
            </div>

            {/* Sub-Tabs do Banco de Dados */}
            <div className="flex items-center gap-2">
              {[
                { id: "db1", label: "Banco 1: Leads Rastreados (Pixel)" },
                { id: "db2", label: "Banco 2: Lead Scoring & Qualificação" },
                { id: "db3", label: "Banco 3: Conversões & Compras" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDbTab(tab.id as any)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                    activeDbTab === tab.id
                      ? "bg-[var(--hub-primary)] text-black font-bold"
                      : "text-[var(--hub-muted)] hover:text-white bg-black/40 border border-[var(--hub-border)]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* CONTEÚDO DA ESTEIRA: BANCO 1 */}
          {activeDbTab === "db1" && (
            <div className="hub-card p-6 bg-black/30 border border-blue-500/20 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-blue-400 tracking-widest">
                    Banco de Dados 1 · Entrada Primária de Telemetria (Pixel Stream)
                  </h4>
                  <p className="text-[10px] text-zinc-400">
                    Captura instantânea de IP, coordenadas geográficas, dispositivo e UTM de origem via Pixel CAPI
                  </p>
                </div>
                <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/30">
                  {visitors.length} Registros no Buffer D1
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--hub-border)] text-[9px] font-black text-[var(--hub-muted)] uppercase tracking-widest">
                      <th className="pb-3">Lead ID</th>
                      <th className="pb-3">Localização (Lat, Lng)</th>
                      <th className="pb-3">IP Anonimizado</th>
                      <th className="pb-3">Dispositivo</th>
                      <th className="pb-3">Página Inicial</th>
                      <th className="pb-3">Tempo no Site</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hub-border)] font-mono text-[11px]">
                    {visitors.map((v) => (
                      <tr key={v.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 text-white font-bold">{v.id}</td>
                        <td className="py-3 text-zinc-300">
                          {v.city}, {v.state} ({v.lat.toFixed(2)}, {v.lng.toFixed(2)})
                        </td>
                        <td className="py-3 text-[var(--hub-muted)]">{v.ip}</td>
                        <td className="py-3 text-zinc-300 uppercase">{v.device}</td>
                        <td className="py-3 text-sky-400 truncate max-w-[200px]">{v.page}</td>
                        <td className="py-3 text-zinc-400">{v.timeOnSite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CONTEÚDO DA ESTEIRA: BANCO 2 */}
          {activeDbTab === "db2" && (
            <div className="hub-card p-6 bg-black/30 border border-purple-500/20 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-purple-400 tracking-widest">
                    Banco de Dados 2 · Lead Scoring & Perfil Demográfico Comportamental
                  </h4>
                  <p className="text-[10px] text-zinc-400">
                    Qualificação preditiva por Inteligência Artificial: idade, gênero, interações e afinidade social
                  </p>
                </div>
                <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/30">
                  IA Score Engine Ativo
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--hub-border)] text-[9px] font-black text-[var(--hub-muted)] uppercase tracking-widest">
                      <th className="pb-3">Nome do Lead</th>
                      <th className="pb-3">Gênero / Idade</th>
                      <th className="pb-3">Instagram / YouTube</th>
                      <th className="pb-3">Interações em Posts</th>
                      <th className="pb-3">Lead Score (0-100)</th>
                      <th className="pb-3">Grau de Afinidade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hub-border)] font-mono text-[11px]">
                    {visitors.map((v) => (
                      <tr key={v.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 text-white font-bold">{v.name}</td>
                        <td className="py-3 text-zinc-300">{v.gender} • {v.age} anos</td>
                        <td className="py-3 text-zinc-400">
                          {v.socials.instagramFollower ? "📸 Seguidor Insta" : "Não segue"} •{" "}
                          {v.socials.youtubeSubscriber ? "▶️ Inscrito YT" : "Não inscrito"}
                        </td>
                        <td className="py-3 text-sky-400 font-bold">{v.socials.interactionCount} visualizações</td>
                        <td className="py-3">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full font-black text-[10px]",
                              v.score >= 90
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                : v.score >= 75
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                : "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                            )}
                          >
                            {v.score} pts
                          </span>
                        </td>
                        <td className="py-3 text-zinc-300 font-bold">
                          {v.score >= 90 ? "🔥 Altíssima Propensão" : v.score >= 75 ? "⚡ Qualificado" : "Observação"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CONTEÚDO DA ESTEIRA: BANCO 3 */}
          {activeDbTab === "db3" && (
            <div className="hub-card p-6 bg-black/30 border border-emerald-500/20 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-emerald-400 tracking-widest">
                    Banco de Dados 3 · Topo do Funil: Conversões, Carrinhos & Checkout
                  </h4>
                  <p className="text-[10px] text-zinc-400">
                    Acompanhamento direto dos produtos adicionados, valores transacionados e finalização de compra
                  </p>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  {checkoutsCount} Oportunidades Quentes
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--hub-border)] text-[9px] font-black text-[var(--hub-muted)] uppercase tracking-widest">
                      <th className="pb-3">Cliente</th>
                      <th className="pb-3">Produto no Radar</th>
                      <th className="pb-3">Valor</th>
                      <th className="pb-3">Status da Esteira</th>
                      <th className="pb-3">Ação Comercial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hub-border)] font-mono text-[11px]">
                    {visitors
                      .filter((v) => v.productName)
                      .map((v) => (
                        <tr key={v.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 text-white font-bold">{v.name} ({v.city})</td>
                          <td className="py-3 text-zinc-200">{v.productName}</td>
                          <td className="py-3 text-emerald-400 font-bold">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v.productPrice || 0)}
                          </td>
                          <td className="py-3">
                            <span
                              className={cn(
                                "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider",
                                v.action === "purchased"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                  : v.action === "checkout"
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                  : "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                              )}
                            >
                              {v.action === "purchased" ? "✅ Compra Finalizada" : v.action === "checkout" ? "⏳ Checkout em Aberto" : "🛒 Carrinho Adicionado"}
                            </span>
                          </td>
                          <td className="py-3">
                            {v.action !== "purchased" ? (
                              <button
                                onClick={() => toast.success(`Notificação de recuperação de carrinho disparada para ${v.name}!`)}
                                className="px-2.5 py-1 rounded-lg bg-[var(--hub-primary)]/20 text-[var(--hub-primary)] border border-[var(--hub-primary)]/40 hover:bg-[var(--hub-primary)] hover:text-black transition-all text-[9px] font-black uppercase tracking-wider"
                              >
                                Recuperar Carrinho
                              </button>
                            ) : (
                              <span className="text-zinc-500 text-[10px]">Pedido Faturado</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
