import * as React from "react";
import { Shell } from "@/components/layout/Shell";
import { CardMetric } from "@/components/ui-b";
import { Users, MousePointer2, BarChart2, Megaphone, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function MarketingPage() {
  return (
    <Shell>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CardMetric
            label="Alcance Total"
            value="2.4M"
            trend="+8% vs ontem"
            trendType="up"
            icon={Users}
          />
          <CardMetric
            label="CTR Médio"
            value="3.24%"
            trend="Estável"
            trendType="neutral"
            icon={MousePointer2}
          />
          <CardMetric
            label="ROAS Geral"
            value="4.8x"
            trend="+0.5x"
            trendType="up"
            icon={BarChart2}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="hub-card hub-gradient-border p-6 space-y-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
              Integrações de Ads
            </h3>
            <div className="space-y-4">
              {[
                { name: "Meta Ads", status: "Conectado", color: "bg-blue-600", icon: Megaphone },
                { name: "Google Ads", status: "Conectado", color: "bg-orange-500", icon: Target },
                { name: "TikTok Ads", status: "Pendente", color: "bg-slate-600", icon: BarChart2 },
              ].map((ad) => (
                <div
                  key={ad.name}
                  className="flex items-center justify-between p-4 bg-black/20 border border-[var(--hub-border)] rounded-xl group hover:border-[var(--hub-primary)]/40 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded-lg", ad.color)}>
                      {React.createElement(ad.icon, { className: "h-4 w-4 text-white" })}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase">{ad.name}</p>
                      <p className="text-[9px] text-[var(--hub-muted)] uppercase tracking-widest">
                        {ad.status}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[9px] font-black uppercase tracking-[0.2em] border-[var(--hub-border)] text-white hover:bg-white/5 px-4 rounded-lg"
                  >
                    Configurar
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="hub-card hub-gradient-border p-6 space-y-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
              Audiências Ativas
            </h3>
            <div className="space-y-4">
              {[
                { name: "L1 - Visualizou Página", size: "184k", status: "Sincronizado" },
                { name: "L2 - Carrinho Aberto", size: "33k", status: "Sincronizado" },
                { name: "L4 - Compradores 30d", size: "7k", status: "Sincronizado" },
              ].map((aud) => (
                <div
                  key={aud.name}
                  className="p-4 bg-black/20 border border-[var(--hub-border)] rounded-xl flex items-center justify-between group hover:border-[var(--hub-primary)]/40 transition-all"
                >
                  <div>
                    <p className="text-xs font-bold text-white uppercase">{aud.name}</p>
                    <p className="text-[9px] text-[var(--hub-muted)] uppercase tracking-widest">
                      {aud.size} pessoas
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--hub-primary)] animate-pulse shadow-[0_0_8px_var(--hub-primary)]" />
                    <span className="text-[9px] font-bold text-[var(--hub-primary)] uppercase tracking-widest">
                      {aud.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
