import * as React from "react";
import { Shell } from "@/components/layout/Shell";
import { HubTable, CardMetric } from "@/components/ui-b";
import { Users, TrendingUp, Award, CircleDollarSign, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InfluencersPage() {
  return (
    <Shell>
      <div className="space-y-8">
        <div className="hub-card hub-gradient-border p-10 bg-gradient-to-br from-[var(--hub-primary)]/10 via-transparent to-transparent">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="h-20 w-20 hub-bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-[var(--hub-primary)]/20 rotate-3 group-hover:rotate-0 transition-transform">
                <Users className="h-10 w-10 text-black" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">
                  Programa de Influencers
                </h2>
                <p className="text-[var(--hub-muted)] text-[11px] font-bold uppercase tracking-[0.2em] max-w-lg leading-relaxed">
                  Estratégia de crescimento acelerado. Repasse de{" "}
                  <span className="text-[var(--hub-primary)] font-black">50% do lucro líquido</span>{" "}
                  das vendas atribuídas via Tracking ID.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <p className="text-[9px] font-black text-[var(--hub-muted)] uppercase tracking-widest">
                  Total Repassado
                </p>
                <p className="text-xl font-black text-white italic">R$ 268.400,00</p>
              </div>
              <button className="hub-bg-primary text-black px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] shadow-lg shadow-[var(--hub-primary)]/20 hover:scale-105 transition-all">
                Recrutar Novo
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <CardMetric
            label="Influencers Ativos"
            value="124"
            trend="+12"
            trendType="up"
            icon={Users}
          />
          <CardMetric
            label="Vendas Atribuídas"
            value="4.120"
            trend="+42%"
            trendType="up"
            icon={TrendingUp}
          />
          <CardMetric
            label="ROI Programa"
            value="8.4x"
            trend="Excelente"
            trendType="up"
            icon={Award}
          />
          <CardMetric
            label="Pendente Repasse"
            value="R$ 42.100"
            subtext="Próximo ciclo 05/06"
            icon={CircleDollarSign}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">
              Performance de Parceiros
            </h3>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-[9px] font-black text-white bg-white/5 border border-[var(--hub-border)] rounded-lg uppercase tracking-widest">
                Filtros
              </button>
              <button className="px-4 py-2 text-[9px] font-black text-white bg-white/5 border border-[var(--hub-border)] rounded-lg uppercase tracking-widest">
                Exportar
              </button>
            </div>
          </div>
          <HubTable
            headers={[
              "Rank",
              "Influencer",
              "Canal Principal",
              "Vendas",
              "Lucro Gerado",
              "Repasse (50%)",
              "Status",
            ]}
          >
            {[
              {
                rank: "#01",
                nome: "@carlos_tech",
                canal: "YouTube",
                vendas: "482",
                lucro: "R$ 124.000",
                repasse: "R$ 62.000",
                status: "Top Performer",
              },
              {
                rank: "#02",
                nome: "@amanda_fit",
                canal: "Instagram",
                vendas: "320",
                lucro: "R$ 82.000",
                repasse: "R$ 41.000",
                status: "Ativo",
              },
              {
                rank: "#03",
                nome: "@julia_vlog",
                canal: "TikTok",
                vendas: "156",
                lucro: "R$ 38.000",
                repasse: "R$ 19.000",
                status: "Ativo",
              },
              {
                rank: "#04",
                nome: "@pedro_games",
                canal: "Twitch",
                vendas: "89",
                lucro: "R$ 22.000",
                repasse: "R$ 11.000",
                status: "Ativo",
              },
            ].map((inf) => (
              <tr key={inf.rank} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-6 py-5 font-black text-[var(--hub-muted)] group-hover:text-white">
                  {inf.rank}
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-black/40 border border-[var(--hub-border)] overflow-hidden">
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${inf.nome}`}
                        alt=""
                      />
                    </div>
                    <span className="font-black text-white italic">{inf.nome}</span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-2">
                    <Share2 className="h-3 w-3 text-[var(--hub-muted)]" />
                    <span className="text-[var(--hub-muted)] font-bold uppercase tracking-widest text-[9px]">
                      {inf.canal}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-5 text-white font-black">{inf.vendas}</td>
                <td className="px-6 py-5 text-[var(--hub-muted)] font-bold italic">{inf.lucro}</td>
                <td className="px-6 py-5">
                  <span className="font-black text-[var(--hub-primary)] italic">{inf.repasse}</span>
                </td>
                <td className="px-6 py-5">
                  <span
                    className={cn(
                      "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                      inf.status === "Top Performer"
                        ? "bg-[var(--hub-primary)]/10 text-[var(--hub-primary)] border border-[var(--hub-primary)]/20"
                        : "bg-white/5 text-white border border-white/10",
                    )}
                  >
                    {inf.status}
                  </span>
                </td>
              </tr>
            ))}
          </HubTable>
        </div>
      </div>
    </Shell>
  );
}
