import * as React from "react";
import { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { HubTable, CardMetric } from "@/components/ui-b";
import {
  Database,
  Users,
  Search,
  Filter,
  Download,
  Share2,
  Sparkles,
  Layers,
  ArrowRight,
  TrendingUp,
  Instagram,
  Youtube,
  Phone,
  MessageCircle,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface QualifiedLead {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  gender: "Feminino" | "Masculino" | "Outro";
  age: number;
  dbTier: 1 | 2 | 3;
  score: number;
  originNetwork: "Instagram Ads" | "TikTok Ads" | "YouTube" | "Google Search";
  postImpressions: number;
  lastAction: "Visualizou Post" | "Entrou na Vitrine" | "Adicionou Carrinho" | "Comprou";
  favoriteNiche: string;
}

const INITIAL_LEADS: QualifiedLead[] = [
  { id: "LEAD-701", name: "Camila Rodrigues", phone: "(11) 98721-4432", email: "camila.r@gmail.com", city: "São Paulo", state: "SP", gender: "Feminino", age: 29, dbTier: 2, score: 88, originNetwork: "Instagram Ads", postImpressions: 14, lastAction: "Adicionou Carrinho", favoriteNiche: "Mulher & Beleza" },
  { id: "LEAD-702", name: "Lucas Mendes", phone: "(21) 99182-5541", email: "lucas.mendes@uol.com.br", city: "Rio de Janeiro", state: "RJ", gender: "Masculino", age: 33, dbTier: 3, score: 94, originNetwork: "TikTok Ads", postImpressions: 8, lastAction: "Comprou", favoriteNiche: "Fitness & Academia" },
  { id: "LEAD-703", name: "Beatriz Silveira", phone: "(41) 99872-3319", email: "bia.silveira@hotmail.com", city: "Curitiba", state: "PR", gender: "Feminino", age: 38, dbTier: 3, score: 98, originNetwork: "Instagram Ads", postImpressions: 21, lastAction: "Comprou", favoriteNiche: "Pet Shop & Cuidados" },
  { id: "LEAD-704", name: "Gabriel Sampaio", phone: "(31) 98823-1120", email: "gabriel.s@gmail.com", city: "Belo Horizonte", state: "MG", gender: "Masculino", age: 24, dbTier: 1, score: 62, originNetwork: "YouTube", postImpressions: 5, lastAction: "Visualizou Post", favoriteNiche: "Gamer & Setup" },
  { id: "LEAD-705", name: "Juliana Duarte", phone: "(71) 99234-8871", email: "ju.duarte@gmail.com", city: "Salvador", state: "BA", gender: "Feminino", age: 31, dbTier: 2, score: 85, originNetwork: "Instagram Ads", postImpressions: 11, lastAction: "Entrou na Vitrine", favoriteNiche: "Vestuário & Streetwear" },
  { id: "LEAD-706", name: "Rodrigo Farias", phone: "(51) 98712-3390", email: "rfarias@terra.com.br", city: "Porto Alegre", state: "RS", gender: "Masculino", age: 41, dbTier: 1, score: 58, originNetwork: "Google Search", postImpressions: 3, lastAction: "Visualizou Post", favoriteNiche: "Automotivo & Ferramentas" },
  { id: "LEAD-707", name: "Mariana Costa", phone: "(85) 99451-2210", email: "mari.costa@yahoo.com.br", city: "Fortaleza", state: "CE", gender: "Feminino", age: 27, dbTier: 2, score: 91, originNetwork: "TikTok Ads", postImpressions: 16, lastAction: "Adicionou Carrinho", favoriteNiche: "Joias & Luxo" },
];

export default function AudiencePage() {
  const [leads, setLeads] = useState<QualifiedLead[]>(INITIAL_LEADS);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState<QualifiedLead | null>(null);

  const filteredLeads = leads.filter((lead) => {
    if (selectedTier && lead.dbTier !== selectedTier) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        lead.name.toLowerCase().includes(term) ||
        lead.city.toLowerCase().includes(term) ||
        lead.favoriteNiche.toLowerCase().includes(term) ||
        lead.originNetwork.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const exportLeadsToCsv = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Nome,Telefone,Email,Cidade,UF,Genero,Idade,DB_Tier,Lead_Score,Origem,Impressoes,Ultima_Acao,Nicho"]
        .concat(
          filteredLeads.map(
            (l) =>
              `"${l.name}","${l.phone}","${l.email}","${l.city}","${l.state}","${l.gender}",${l.age},DB-${l.dbTier},${l.score},"${l.originNetwork}",${l.postImpressions},"${l.lastAction}","${l.favoriteNiche}"`
          )
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leads-qualificados-db${selectedTier || "all"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${filteredLeads.length} leads exportados com sucesso!`);
  };

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              Motor de Audiência &amp; Funil 3-Tier DB
            </h2>
            <p className="text-[var(--hub-muted)] text-[9px] font-bold uppercase tracking-[0.3em]">
              Banco 1 (Pixel Leads) ➔ Banco 2 (Lead Scoring Qualificado) ➔ Banco 3 (Conversão)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={exportLeadsToCsv}
              className="h-10 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 rounded-xl flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar CSV / Meta Ads
            </Button>
            <Button
              onClick={() => {
                toast.success("Audiência sincronizada com Meta Custom Audiences & TikTok Pixel!");
              }}
              className="h-10 hub-bg-primary hover:opacity-90 text-black text-[10px] font-black uppercase tracking-[0.2em] px-6 shadow-lg shadow-[var(--hub-primary)]/20 rounded-xl flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Sincronizar Pixel D1
            </Button>
          </div>
        </div>

        {/* 3 BANCOS DE DADOS DO FUNIL (HIERARQUIA DA BASE AO TOPO) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* BANCO 1: BASE DO FUNIL */}
          <div
            onClick={() => setSelectedTier(selectedTier === 1 ? null : 1)}
            className={`p-6 rounded-3xl border transition-all cursor-pointer ${
              selectedTier === 1
                ? "bg-purple-950/40 border-purple-400 ring-2 ring-purple-400/40"
                : "bg-black/40 border-purple-500/30 hover:border-purple-400/60"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                BASE DO FUNIL • BANCO 1
              </span>
              <Database className="h-4 w-4 text-purple-400" />
            </div>
            <h3 className="text-xl font-black text-white italic">Pixel Leads Rastreados</h3>
            <p className="text-[11px] text-slate-300 mt-1">
              Visitantes rastreados por pixel com IP, UTMs, geolocalização e histórico de visualização de posts.
            </p>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-2xl font-black text-purple-400 font-mono">48.290</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Leads Captados</span>
            </div>
          </div>

          {/* BANCO 2: MEIO DO FUNIL */}
          <div
            onClick={() => setSelectedTier(selectedTier === 2 ? null : 2)}
            className={`p-6 rounded-3xl border transition-all cursor-pointer ${
              selectedTier === 2
                ? "bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/40"
                : "bg-black/40 border-amber-500/30 hover:border-amber-400/60"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                MEIO DO FUNIL • BANCO 2
              </span>
              <Sparkles className="h-4 w-4 text-amber-400" />
            </div>
            <h3 className="text-xl font-black text-white italic">Lead Scoring Qualificado</h3>
            <p className="text-[11px] text-slate-300 mt-1">
              Qualificação por gênero, faixa etária, engajamento em posts (3x a 20x), ticket médio provável e nicho.
            </p>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-2xl font-black text-amber-400 font-mono">14.120</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Leads Score &gt; 80</span>
            </div>
          </div>

          {/* BANCO 3: TOPO DO FUNIL (CONVERSÃO) */}
          <div
            onClick={() => setSelectedTier(selectedTier === 3 ? null : 3)}
            className={`p-6 rounded-3xl border transition-all cursor-pointer ${
              selectedTier === 3
                ? "bg-emerald-950/40 border-emerald-400 ring-2 ring-emerald-400/40"
                : "bg-black/40 border-emerald-500/30 hover:border-emerald-400/60"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                TOPO DO FUNIL • BANCO 3
              </span>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <h3 className="text-xl font-black text-white italic">Conversões &amp; Recorrência</h3>
            <p className="text-[11px] text-slate-300 mt-1">
              Checkout aprovado, clientes compradores ativos, dados de entrega e prontos para recompra/cross-sell.
            </p>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-2xl font-black text-emerald-400 font-mono">3.480</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Clientes Ativos</span>
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-black/40 px-4 py-2.5 rounded-xl border border-[var(--hub-border)] w-full sm:w-80">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, cidade, rede, nicho..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none text-xs text-white focus:outline-none w-full placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Filtrar por Banco:</span>
            <button
              onClick={() => setSelectedTier(null)}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                selectedTier === null ? "bg-white text-black border-white" : "bg-black/30 text-slate-400 border-white/10"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setSelectedTier(1)}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                selectedTier === 1 ? "bg-purple-500 text-white border-purple-500" : "bg-black/30 text-slate-400 border-white/10"
              }`}
            >
              Banco 1
            </button>
            <button
              onClick={() => setSelectedTier(2)}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                selectedTier === 2 ? "bg-amber-500 text-black border-amber-500" : "bg-black/30 text-slate-400 border-white/10"
              }`}
            >
              Banco 2
            </button>
            <button
              onClick={() => setSelectedTier(3)}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                selectedTier === 3 ? "bg-emerald-500 text-black border-emerald-500" : "bg-black/30 text-slate-400 border-white/10"
              }`}
            >
              Banco 3
            </button>
          </div>
        </div>

        {/* Tabela de Leads Qualificados */}
        <HubTable
          headers={[
            "Lead / Contato",
            "Perfil Demográfico",
            "Banco DB",
            "Origem / Ads",
            "Visualizações Post",
            "Lead Score",
            "Nicho Favorito",
            "Ação",
          ]}
        >
          {filteredLeads.map((lead) => (
            <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors">
              <td className="px-6 py-4">
                <div className="space-y-0.5">
                  <span className="font-bold text-white text-xs block">{lead.name}</span>
                  <span className="font-mono text-[10px] text-slate-400">{lead.phone}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="space-y-0.5">
                  <span className="text-xs text-slate-200 block">
                    {lead.gender}, {lead.age} anos
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    {lead.city} - {lead.state}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                <span
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                    lead.dbTier === 1
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                      : lead.dbTier === 2
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  }`}
                >
                  Banco {lead.dbTier}
                </span>
              </td>
              <td className="px-6 py-4 text-xs text-slate-300">{lead.originNetwork}</td>
              <td className="px-6 py-4 font-mono font-bold text-xs text-white">
                {lead.postImpressions}x visualizações
              </td>
              <td className="px-6 py-4">
                <span className="font-mono font-black text-xs text-emerald-400">
                  {lead.score}/100
                </span>
              </td>
              <td className="px-6 py-4 text-xs font-bold text-cyan-300">{lead.favoriteNiche}</td>
              <td className="px-6 py-4">
                <a
                  href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Olá ' + lead.name + '! Temos uma oferta exclusiva da ' + lead.favoriteNiche + ' para você hoje.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Chamar
                </a>
              </td>
            </tr>
          ))}
        </HubTable>
      </div>
    </Shell>
  );
}
