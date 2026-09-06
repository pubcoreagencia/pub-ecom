import * as React from "react";
import { Shell } from "@/components/layout/Shell";
import { HubTable, CardMetric } from "@/components/ui-b";
import { Button } from "@/components/ui/button";
import { Zap, Globe, BarChart3, ShieldCheck, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SEOPage() {
  const keywords = [
    { term: "Titanium Headphones", position: 1, volume: "12.5K", trend: "+2" },
    { term: "Minimalist Smart Home", position: 3, volume: "8.2K", trend: "+5" },
    { term: "Nordic Office Chair", position: 2, volume: "15.1K", trend: "-1" },
  ];

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              SEO & Orgânico
            </h2>
            <p className="text-[var(--hub-muted)] text-[9px] font-bold uppercase tracking-[0.3em]">
              PUB ECOM Visibility Engine
            </p>
          </div>
          <Button className="h-10 hub-bg-primary hover:opacity-90 text-black text-[10px] font-black uppercase tracking-[0.2em] px-8 shadow-lg shadow-[var(--hub-primary)]/20 rounded-xl">
            <Zap className="ml-2 h-4 w-4 fill-current" />
            Gerar Sitemap
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="hub-card hub-gradient-border p-10 flex flex-col items-center justify-center text-center bg-black/40 border-[var(--hub-primary)]/20">
            <div className="h-24 w-24 rounded-full border-8 border-[var(--hub-primary)]/20 border-t-[var(--hub-primary)] flex items-center justify-center mb-6 shadow-2xl shadow-[var(--hub-primary)]/20">
              <span className="text-4xl font-black italic text-white">92</span>
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2 italic">
              Visibility Score
            </h3>
            <p className="text-[9px] font-bold text-[var(--hub-muted)] uppercase tracking-[0.2em] opacity-60">
              Alta Performance Orgânica
            </p>
          </div>

          <div className="lg:col-span-2 hub-card hub-gradient-border overflow-hidden bg-black/20">
            <div className="px-8 py-6 border-b border-[var(--hub-border)] flex flex-row items-center justify-between bg-black/40">
              <h3 className="text-[11px] font-black tracking-[0.3em] text-white uppercase italic">
                Top Keywords Orgânicas
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--hub-primary)] hover:bg-[var(--hub-primary)]/10"
              >
                Ver Tudo
              </Button>
            </div>
            <HubTable headers={["Palavra-Chave", "Posição", "Volume", "Trend"]}>
              {keywords.map((k, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-8 py-5 text-xs font-black text-white uppercase tracking-tighter italic">
                    {k.term}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white font-black text-[10px]">
                      #{k.position}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right text-xs font-bold text-[var(--hub-muted)] italic">
                    {k.volume}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span
                      className={cn(
                        "text-[9px] font-black uppercase tracking-widest",
                        k.trend.startsWith("+") ? "text-red-500" : "text-rose-500",
                      )}
                    >
                      {k.trend}
                    </span>
                  </td>
                </tr>
              ))}
            </HubTable>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Páginas Indexadas", value: "452", icon: Globe },
            { label: "Backlinks Ativos", value: "1.2K", icon: Target },
            { label: "Domain Authority", value: "64", icon: ShieldCheck },
            { label: "Tráfego Orgânico", value: "45K", icon: BarChart3 },
          ].map((m, i) => (
            <CardMetric key={i} label={m.label} value={m.value} icon={m.icon} />
          ))}
        </div>
      </div>
    </Shell>
  );
}
