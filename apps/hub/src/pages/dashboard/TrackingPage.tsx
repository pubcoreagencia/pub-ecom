import * as React from "react";
import { useState, useEffect } from "react";
import {
  Zap,
  Target,
  MousePointer2,
  TrendingUp,
  Smartphone,
  CheckCircle2,
  Copy,
  Plus,
  ExternalLink,
  ShieldCheck,
  Activity,
  Layers,
  Sparkles,
  X,
  Play,
  Share2,
  BarChart3,
  Sliders,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { CardMetric } from "@/components/ui-b";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PixelConfig {
  metaPixelId: string;
  metaActive: boolean;
  tiktokPixelId: string;
  tiktokActive: boolean;
  googleTagId: string;
  googleActive: boolean;
  capiToken: string;
}

interface TrackingEvent {
  id: string;
  time: string;
  event: string;
  user: string;
  source: string;
  payload: string;
  status: "verified" | "pending";
}

export default function TrackingPage() {
  const [activeTab, setActiveTab] = useState<"pixels" | "utms">("pixels");
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Pixel Configuration State with localStorage persistence
  const [pixelConfig, setPixelConfig] = useState<PixelConfig>(() => {
    try {
      const saved = localStorage.getItem("pub_pixel_config");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      metaPixelId: "142859203928174",
      metaActive: true,
      tiktokPixelId: "C98F7GH283KD8",
      tiktokActive: true,
      googleTagId: "G-PUB990ECOM",
      googleActive: true,
      capiToken: "EAAGk40P...pubcore_capi_token",
    };
  });

  const [formConfig, setFormConfig] = useState<PixelConfig>(pixelConfig);

  // Live Event Stream
  const [events, setEvents] = useState<TrackingEvent[]>([
    {
      id: "evt-1",
      time: "Há 1 min",
      event: "Purchase (L4) - R$ 249,00",
      user: "Lucas Mendes (RJ)",
      source: "Meta CAPI • Facebook Ads",
      payload: '{"event_name":"Purchase","value":249.00,"currency":"BRL","content_name":"Cinto Lombar Powerlifting"}',
      status: "verified",
    },
    {
      id: "evt-2",
      time: "Há 3 min",
      event: "InitiateCheckout (L3)",
      user: "Camila Rodrigues (SP)",
      source: "TikTok Pixel • Influencer Link",
      payload: '{"event_name":"InitiateCheckout","value":189.90,"currency":"BRL","content_type":"product"}',
      status: "verified",
    },
    {
      id: "evt-3",
      time: "Há 6 min",
      event: "AddToCart (L2)",
      user: "Beatriz Silveira (PR)",
      source: "Google Ads • Search Brand",
      payload: '{"event_name":"AddToCart","value":329.90,"currency":"BRL","items":[{"item_id":"zentta-cama-01"}]}',
      status: "verified",
    },
    {
      id: "evt-4",
      time: "Há 10 min",
      event: "PageView (L1)",
      user: "Visitante #9021 (MG)",
      source: "Instagram Stories • Alex Rivera",
      payload: '{"event_name":"PageView","page_location":"https://pub-ecom.store/babuche"}',
      status: "verified",
    },
  ]);

  // UTM Builder State
  const [utmBaseUrl, setUtmBaseUrl] = useState("https://pub-ecom.store/produtos");
  const [utmSource, setUtmSource] = useState("instagram");
  const [utmMedium, setUtmMedium] = useState("stories_bio");
  const [utmCampaign, setUtmCampaign] = useState("black_promo_2026");
  const [utmTerm, setUtmTerm] = useState("babuche_ortopedico");
  const [utmContent, setUtmContent] = useState("video_review_influencer");

  const generatedUtmUrl = React.useMemo(() => {
    try {
      const url = new URL(utmBaseUrl);
      if (utmSource) url.searchParams.set("utm_source", utmSource);
      if (utmMedium) url.searchParams.set("utm_medium", utmMedium);
      if (utmCampaign) url.searchParams.set("utm_campaign", utmCampaign);
      if (utmTerm) url.searchParams.set("utm_term", utmTerm);
      if (utmContent) url.searchParams.set("utm_content", utmContent);
      return url.toString();
    } catch {
      return `${utmBaseUrl}?utm_source=${utmSource}&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}&utm_term=${utmTerm}&utm_content=${utmContent}`;
    }
  }, [utmBaseUrl, utmSource, utmMedium, utmCampaign, utmTerm, utmContent]);

  const handleCopyUtm = () => {
    navigator.clipboard.writeText(generatedUtmUrl);
    toast.success("Link UTM copiado para a área de transferência!");
  };

  const handleSavePixelConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setPixelConfig(formConfig);
    try {
      localStorage.setItem("pub_pixel_config", JSON.stringify(formConfig));
    } catch {}
    setIsConfigModalOpen(false);
    toast.success("Pixels e Webhooks configurados com sucesso!");
  };

  const handleTestPixelEvent = () => {
    toast.info("Enviando evento de teste para o Meta CAPI e TikTok Webhook...");
    setTimeout(() => {
      const newEvt: TrackingEvent = {
        id: "evt-" + Date.now(),
        time: "Agora",
        event: "TestEvent_Simulation (CAPI)",
        user: "CEO Matheus Paes (Live Session)",
        source: "Meta CAPI Test Pipeline",
        payload: JSON.stringify({
          event_name: "TestPurchase",
          test_event_code: "TEST" + Math.floor(Math.random() * 90000 + 10000),
          user_data: { client_ip_address: "189.45.12.98", em: "ceo@pubcore.com.br" },
          custom_data: { currency: "BRL", value: 99.90 },
        }),
        status: "verified",
      };
      setEvents((prev) => [newEvt, ...prev]);
      toast.success("Evento de teste disparado e verificado pelo Meta CAPI!");
    }, 900);
  };

  return (
    <Shell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[var(--hub-border)] pb-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              Tracking, Pixels & Atribuição UTM
            </h2>
            <p className="text-[var(--hub-muted)] text-[9px] font-bold uppercase tracking-[0.3em]">
              Atribuição Multitoque · Meta CAPI · TikTok Server Events · UTM Builder
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                setFormConfig(pixelConfig);
                setIsConfigModalOpen(true);
              }}
              className="h-10 hub-bg-primary hover:opacity-90 text-black text-[10px] font-black uppercase tracking-[0.2em] px-6 shadow-lg shadow-[var(--hub-primary)]/20 rounded-xl flex items-center gap-2"
            >
              <Zap className="h-4 w-4 fill-current" />
              Configurar Pixels
            </Button>
            <Button
              onClick={handleTestPixelEvent}
              variant="outline"
              className="h-10 border border-[var(--hub-border)] text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 rounded-xl hover:bg-white/5"
            >
              <Play className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
              Disparar Teste CAPI
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-[var(--hub-border)] pb-2">
          <button
            onClick={() => setActiveTab("pixels")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeTab === "pixels"
                ? "bg-[var(--hub-primary)] text-black shadow-lg shadow-[var(--hub-primary)]/20"
                : "text-[var(--hub-muted)] hover:text-white hover:bg-white/5"
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            1. Pixels & Webhooks CAPI ({pixelConfig.metaActive ? "Meta Ativo" : ""})
          </button>
          <button
            onClick={() => setActiveTab("utms")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeTab === "utms"
                ? "bg-[var(--hub-primary)] text-black shadow-lg shadow-[var(--hub-primary)]/20"
                : "text-[var(--hub-muted)] hover:text-white hover:bg-white/5"
            )}
          >
            <Target className="h-3.5 w-3.5" />
            2. Campanhas & UTM Link Builder
          </button>
        </div>

        {/* TAB 1: PIXELS & CAPI ENGINE */}
        {activeTab === "pixels" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Status Cards dos Pixels Conectados */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Meta Pixel & CAPI */}
              <div className="hub-card p-6 bg-black/40 border border-blue-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-white tracking-wider">Meta Pixel & CAPI</h4>
                      <p className="text-[9px] text-[var(--hub-muted)] font-mono">ID: {pixelConfig.metaPixelId || "Não configurado"}</p>
                    </div>
                  </div>
                  <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest", pixelConfig.metaActive ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-zinc-800 text-zinc-500")}>
                    {pixelConfig.metaActive ? "🟢 Conectado" : "Pausado"}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 space-y-1 bg-black/60 p-3 rounded-xl border border-white/5 font-mono">
                  <div className="flex justify-between"><span>Disparos Hoje:</span><span className="text-white font-bold">1.482 eventos</span></div>
                  <div className="flex justify-between"><span>Taxa de Match EMQ:</span><span className="text-emerald-400 font-bold">8.6 / 10 (Excelente)</span></div>
                </div>
              </div>

              {/* TikTok Events Pixel */}
              <div className="hub-card p-6 bg-black/40 border border-pink-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-pink-600/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-white tracking-wider">TikTok Pixel</h4>
                      <p className="text-[9px] text-[var(--hub-muted)] font-mono">ID: {pixelConfig.tiktokPixelId || "Não configurado"}</p>
                    </div>
                  </div>
                  <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest", pixelConfig.tiktokActive ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-zinc-800 text-zinc-500")}>
                    {pixelConfig.tiktokActive ? "🟢 Conectado" : "Pausado"}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 space-y-1 bg-black/60 p-3 rounded-xl border border-white/5 font-mono">
                  <div className="flex justify-between"><span>Disparos Hoje:</span><span className="text-white font-bold">894 eventos</span></div>
                  <div className="flex justify-between"><span>Status CAPI:</span><span className="text-pink-400 font-bold">Webhook 200 OK</span></div>
                </div>
              </div>

              {/* Google Analytics 4 / GTM */}
              <div className="hub-card p-6 bg-black/40 border border-amber-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-white tracking-wider">Google Tag Manager</h4>
                      <p className="text-[9px] text-[var(--hub-muted)] font-mono">ID: {pixelConfig.googleTagId || "Não configurado"}</p>
                    </div>
                  </div>
                  <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest", pixelConfig.googleActive ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-zinc-800 text-zinc-500")}>
                    {pixelConfig.googleActive ? "🟢 Conectado" : "Pausado"}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 space-y-1 bg-black/60 p-3 rounded-xl border border-white/5 font-mono">
                  <div className="flex justify-between"><span>Disparos Hoje:</span><span className="text-white font-bold">2.310 eventos</span></div>
                  <div className="flex justify-between"><span>Atribuição:</span><span className="text-amber-400 font-bold">Data-Driven Multi-touch</span></div>
                </div>
              </div>
            </div>

            {/* Live Stream de Eventos CAPI */}
            <div className="hub-card overflow-hidden bg-black/20 border border-[var(--hub-border)]">
              <div className="px-6 py-4 border-b border-[var(--hub-border)] flex items-center justify-between bg-black/40">
                <div className="flex items-center gap-2.5">
                  <Activity className="h-4 w-4 text-[var(--hub-primary)]" />
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">
                    Pipeline de Eventos em Tempo Real (CAPI & Server-Side)
                  </h3>
                </div>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Conexão Webhook Ativa
                </span>
              </div>

              <div className="divide-y divide-[var(--hub-border)]">
                {events.map((e) => (
                  <div key={e.id} className="p-5 hover:bg-white/[0.02] transition-colors space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase font-mono">
                          {e.event}
                        </span>
                        <span className="text-xs font-bold text-white">{e.user}</span>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] font-mono text-[var(--hub-muted)]">
                        <span className="text-zinc-300 font-bold">{e.source}</span>
                        <span>{e.time}</span>
                      </div>
                    </div>
                    <div className="bg-black/60 p-3 rounded-xl border border-white/5 text-[10px] font-mono text-zinc-400 overflow-x-auto">
                      <code>{e.payload}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CAMPANHAS & UTM TRACKING BUILDER */}
        {activeTab === "utms" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* UTM Builder Interativo */}
            <div className="hub-card p-6 bg-black/40 border border-[var(--hub-border)] space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-[var(--hub-primary)]" />
                    Gerador Universal de Links Rastreados (UTM Builder)
                  </h3>
                  <p className="text-[10px] text-[var(--hub-muted)] uppercase tracking-widest mt-1">
                    Insira os parâmetros de rastreio para atribuir cada clique e venda com precisão cirúrgica
                  </p>
                </div>
                <Button
                  onClick={handleCopyUtm}
                  className="hub-bg-primary text-black font-black uppercase text-[10px] tracking-wider px-4 h-9 rounded-xl flex items-center gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar Link Rastreado
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">URL Base da Loja / Produto</label>
                  <input
                    type="url"
                    value={utmBaseUrl}
                    onChange={(e) => setUtmBaseUrl(e.target.value)}
                    className="w-full bg-black/60 border border-[var(--hub-border)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--hub-primary)] font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Origem (utm_source) *</label>
                  <input
                    type="text"
                    placeholder="instagram, facebook, google, tiktok"
                    value={utmSource}
                    onChange={(e) => setUtmSource(e.target.value)}
                    className="w-full bg-black/60 border border-[var(--hub-border)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--hub-primary)] font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Mídia (utm_medium) *</label>
                  <input
                    type="text"
                    placeholder="stories, bio, reels, cpc, banner"
                    value={utmMedium}
                    onChange={(e) => setUtmMedium(e.target.value)}
                    className="w-full bg-black/60 border border-[var(--hub-border)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--hub-primary)] font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Campanha (utm_campaign) *</label>
                  <input
                    type="text"
                    placeholder="lancamento_inverno, black_friday"
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                    className="w-full bg-black/60 border border-[var(--hub-border)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--hub-primary)] font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Termo / Produto (utm_term)</label>
                  <input
                    type="text"
                    placeholder="babuche_slide, tenis_casual"
                    value={utmTerm}
                    onChange={(e) => setUtmTerm(e.target.value)}
                    className="w-full bg-black/60 border border-[var(--hub-border)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--hub-primary)] font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Conteúdo (utm_content)</label>
                  <input
                    type="text"
                    placeholder="criativo_01_video, carrossel_foto"
                    value={utmContent}
                    onChange={(e) => setUtmContent(e.target.value)}
                    className="w-full bg-black/60 border border-[var(--hub-border)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--hub-primary)] font-mono"
                  />
                </div>
              </div>

              {/* URL Gerada em destaque */}
              <div className="p-4 bg-black/70 rounded-xl border border-[var(--hub-primary)]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="overflow-x-auto w-full">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--hub-primary)] block mb-1">
                    🔗 Link com Parâmetros de Rastreio Incorporados:
                  </span>
                  <code className="text-xs font-mono text-white select-all break-all">
                    {generatedUtmUrl}
                  </code>
                </div>
                <Button
                  onClick={handleCopyUtm}
                  size="sm"
                  className="shrink-0 hub-bg-primary text-black font-black uppercase text-[9px] px-3 h-8 rounded-lg"
                >
                  <Copy className="h-3 w-3 mr-1" /> Copiar
                </Button>
              </div>
            </div>

            {/* Performance das Campanhas Ativas */}
            <div className="hub-card p-6 bg-black/20 border border-[var(--hub-border)] space-y-4">
              <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[var(--hub-primary)]" />
                Desempenho de Campanhas Atribuídas em Tempo Real
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--hub-border)] text-[9px] font-black text-[var(--hub-muted)] uppercase tracking-widest">
                      <th className="pb-3">Campanha</th>
                      <th className="pb-3">Canal</th>
                      <th className="pb-3">Cliques</th>
                      <th className="pb-3">Leads L1</th>
                      <th className="pb-3">Vendas L4</th>
                      <th className="pb-3">Taxa Conv.</th>
                      <th className="pb-3">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hub-border)] font-mono">
                    {[
                      { name: "black_promo_2026", channel: "Instagram Stories", clicks: 4280, leads: 840, sales: 86, conv: "2.01%", roas: "5.4x" },
                      { name: "meta_cpc_babuche", channel: "Facebook Feed", clicks: 3150, leads: 620, sales: 62, conv: "1.96%", roas: "4.8x" },
                      { name: "influencer_alex_rivera", channel: "TikTok Review", clicks: 5890, leads: 1210, sales: 114, conv: "1.93%", roas: "6.2x" },
                      { name: "google_search_brand", channel: "Google Ads", clicks: 2100, leads: 580, sales: 78, conv: "3.71%", roas: "7.1x" },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="py-3 text-white font-bold">{row.name}</td>
                        <td className="py-3 text-[var(--hub-muted)]">{row.channel}</td>
                        <td className="py-3 text-white">{row.clicks.toLocaleString()}</td>
                        <td className="py-3 text-blue-400">{row.leads}</td>
                        <td className="py-3 text-emerald-400 font-bold">{row.sales}</td>
                        <td className="py-3 text-amber-400">{row.conv}</td>
                        <td className="py-3 text-[var(--hub-primary)] font-black">{row.roas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CONFIGURAR PIXEL */}
        {isConfigModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
            <div className="bg-[#121214] border border-[var(--hub-border)] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-[var(--hub-border)] bg-black/40">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl hub-bg-primary text-black flex items-center justify-center font-black">
                    <Zap className="h-5 w-5 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white italic">
                      Configuração de Pixels & CAPI
                    </h3>
                    <p className="text-[10px] text-[var(--hub-muted)] uppercase tracking-widest">
                      Meta Pixel, TikTok Events API e Google Tag Manager
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsConfigModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSavePixelConfig} className="p-6 space-y-5">
                {/* Meta Pixel */}
                <div className="space-y-1.5 p-4 rounded-xl bg-black/40 border border-blue-500/20">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                      Meta Pixel ID (Facebook / Instagram)
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formConfig.metaActive}
                        onChange={(e) => setFormConfig((prev) => ({ ...prev, metaActive: e.target.checked }))}
                        className="rounded accent-[var(--hub-primary)]"
                      />
                      Ativo
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: 142859203928174"
                    value={formConfig.metaPixelId}
                    onChange={(e) => setFormConfig((prev) => ({ ...prev, metaPixelId: e.target.value }))}
                    className="w-full bg-black/60 border border-[var(--hub-border)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                {/* TikTok Pixel */}
                <div className="space-y-1.5 p-4 rounded-xl bg-black/40 border border-pink-500/20">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-pink-400">
                      TikTok Pixel ID
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formConfig.tiktokActive}
                        onChange={(e) => setFormConfig((prev) => ({ ...prev, tiktokActive: e.target.checked }))}
                        className="rounded accent-[var(--hub-primary)]"
                      />
                      Ativo
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: C98F7GH283KD8"
                    value={formConfig.tiktokPixelId}
                    onChange={(e) => setFormConfig((prev) => ({ ...prev, tiktokPixelId: e.target.value }))}
                    className="w-full bg-black/60 border border-[var(--hub-border)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500 font-mono"
                  />
                </div>

                {/* Google Tag Manager */}
                <div className="space-y-1.5 p-4 rounded-xl bg-black/40 border border-amber-500/20">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                      Google Tag / GA4 Measurement ID
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formConfig.googleActive}
                        onChange={(e) => setFormConfig((prev) => ({ ...prev, googleActive: e.target.checked }))}
                        className="rounded accent-[var(--hub-primary)]"
                      />
                      Ativo
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: G-PUB990ECOM ou GTM-XXXXXX"
                    value={formConfig.googleTagId}
                    onChange={(e) => setFormConfig((prev) => ({ ...prev, googleTagId: e.target.value }))}
                    className="w-full bg-black/60 border border-[var(--hub-border)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                {/* Server CAPI Token */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Token de Acesso da API de Conversões (CAPI Token)
                  </label>
                  <input
                    type="password"
                    placeholder="EAAGk40P..."
                    value={formConfig.capiToken}
                    onChange={(e) => setFormConfig((prev) => ({ ...prev, capiToken: e.target.value }))}
                    className="w-full bg-black/60 border border-[var(--hub-border)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--hub-primary)] font-mono"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[var(--hub-border)]">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsConfigModalOpen(false)}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="hub-bg-primary text-black font-black uppercase text-xs tracking-wider px-6 rounded-xl"
                  >
                    Salvar Configurações
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
