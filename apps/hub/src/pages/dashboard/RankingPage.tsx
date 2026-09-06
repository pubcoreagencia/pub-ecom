import * as React from "react";
import {
  Trophy,
  TrendingUp,
  ArrowUp,
  Target,
  Crown,
  ChevronRight,
  Medal,
  Users,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { CardMetric } from "@/components/ui-b";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function RankingPage() {
  const ranks = [
    {
      pos: 1,
      name: "Loja Titanium Tech",
      metric: "R$ 450.200",
      type: "Revenue",
      trend: "+12%",
      color: "text-yellow-500",
      icon: Crown,
    },
    {
      pos: 2,
      name: "Alex Rivera (Inf)",
      metric: "R$ 380.450",
      type: "Sales",
      trend: "+8%",
      color: "text-slate-400",
      icon: Trophy,
    },
    {
      pos: 3,
      name: "Sarah Chen (Inf)",
      metric: "R$ 310.120",
      type: "Sales",
      trend: "+15%",
      color: "text-orange-600",
      icon: Medal,
    },
    {
      pos: 4,
      name: "Minimalist Home",
      metric: "R$ 295.000",
      type: "Revenue",
      trend: "+5%",
      color: "text-slate-300",
      icon: Trophy,
    },
  ];

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              Ranking Global
            </h2>
            <p className="text-[var(--hub-muted)] text-[9px] font-bold uppercase tracking-[0.3em]">
              Top Performers PUB ECOM Engine
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-10 rounded-xl border-[var(--hub-border)] bg-white/5 text-white font-black text-[9px] uppercase tracking-[0.2em] px-6 hover:bg-white/10 transition-all"
            >
              Filtro Semanal
            </Button>
            <Button className="h-10 hub-bg-primary hover:opacity-90 text-black text-[10px] font-black uppercase tracking-[0.2em] px-6 shadow-lg shadow-[var(--hub-primary)]/20 rounded-xl">
              Exportar Ranking
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {ranks.slice(0, 3).map((r, i) => (
            <div
              key={i}
              className={cn(
                "hub-card hub-gradient-border p-8 text-center flex flex-col items-center group transition-all duration-500",
                i === 0
                  ? "bg-black/40 border-[var(--hub-primary)]/40 scale-105 z-10"
                  : "bg-black/20",
              )}
            >
              <div
                className={cn(
                  "h-16 w-16 rounded-2xl flex items-center justify-center mb-6 shadow-2xl transition-transform group-hover:rotate-6",
                  i === 0
                    ? "hub-bg-primary text-black"
                    : "bg-black/40 border border-[var(--hub-border)] " + r.color,
                )}
              >
                {React.createElement(r.icon, { className: "h-8 w-8" })}
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--hub-muted)] mb-3 italic">
                Posição #0{r.pos}
              </span>
              <h3 className="text-xl font-black text-white tracking-tighter uppercase mb-2 italic">
                {r.name}
              </h3>
              <p
                className={cn(
                  "text-3xl font-black tracking-tighter italic mb-4",
                  i === 0 ? "text-[var(--hub-primary)]" : "text-white",
                )}
              >
                {r.metric}
              </p>
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-red-500">
                <ArrowUp className="h-3 w-3" />
                <span>{r.trend} vs semana anterior</span>
              </div>
            </div>
          ))}
        </div>

        <div className="hub-card hub-gradient-border overflow-hidden bg-black/20 mt-8">
          <div className="px-10 py-6 border-b border-[var(--hub-border)] bg-black/40">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white italic">
              Lista Completa de Líderes
            </h3>
          </div>
          <div className="divide-y divide-[var(--hub-border)]">
            {ranks.map((r, i) => (
              <div
                key={i}
                className="px-10 py-6 flex items-center justify-between group hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-8">
                  <span className="text-4xl font-black italic text-[var(--hub-muted)] opacity-20 group-hover:opacity-100 group-hover:text-[var(--hub-primary)] transition-all leading-none w-12">
                    #{r.pos}
                  </span>
                  <div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tighter leading-tight italic">
                      {r.name}
                    </h4>
                    <p className="text-[9px] font-bold text-[var(--hub-muted)] uppercase tracking-[0.2em] mt-1 italic">
                      {r.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-12 text-right">
                  <div>
                    <p className="text-xl font-black text-white tracking-tighter italic">
                      {r.metric}
                    </p>
                    <div className="flex items-center justify-end gap-1 text-red-500 text-[9px] font-black">
                      <ArrowUp className="h-3 w-3" /> {r.trend}
                    </div>
                  </div>
                  <ChevronRight className="h-6 w-6 text-[var(--hub-border)] group-hover:text-white transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
