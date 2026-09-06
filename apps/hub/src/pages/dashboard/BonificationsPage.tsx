import * as React from "react";
import { Gift, Users, Plus, ArrowUpRight } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/button";

export default function BonificationsPage() {
  const bonuses = [
    { title: "Top Performance Mensal", target: "100 Vendas", reward: "R$ 5.000,00", recipients: 3 },
    { title: "Lançamento Titanium", target: "50 Vendas / 24h", reward: "Extra 5%", recipients: 12 },
    {
      title: "Fidelidade Semestral",
      target: "6 Meses Ativo",
      reward: "Platinum VIP",
      recipients: 24,
    },
  ];

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              Gamificação & Incentivos
            </h2>
            <p className="text-[var(--hub-muted)] text-[9px] font-bold uppercase tracking-[0.3em]">
              PUB ECOM Bonifications Engine
            </p>
          </div>
          <Button className="h-10 hub-bg-primary hover:opacity-90 text-black text-[10px] font-black uppercase tracking-[0.2em] px-6 shadow-lg shadow-[var(--hub-primary)]/20 rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Nova Regra
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {bonuses.map((b, i) => (
            <div
              key={i}
              className="hub-card hub-gradient-border p-10 text-center flex flex-col items-center group bg-black/20"
            >
              <div className="h-16 w-16 rounded-2xl bg-black/40 border border-[var(--hub-border)] flex items-center justify-center mb-6 group-hover:border-[var(--hub-primary)]/40 transition-all">
                <Gift className="h-8 w-8 text-[var(--hub-primary)] group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="text-xl font-black text-white tracking-tighter uppercase mb-2 italic leading-tight">
                {b.title}
              </h3>
              <p className="text-[9px] font-black text-[var(--hub-muted)] uppercase tracking-[0.2em] mb-6 italic opacity-60">
                {b.target}
              </p>

              <div className="w-full bg-black/40 rounded-xl p-6 mb-8 border border-[var(--hub-border)] border-dashed">
                <p className="text-[9px] font-black text-[var(--hub-muted)] uppercase tracking-widest mb-1 italic">
                  Recompensa
                </p>
                <p className="text-2xl font-black text-[var(--hub-primary)] tracking-tighter italic">
                  {b.reward}
                </p>
              </div>

              <div className="flex items-center gap-2 text-[9px] font-black text-[var(--hub-muted)] uppercase tracking-[0.2em]">
                <Users className="h-3 w-3" /> {b.recipients} Parceiros Qualificados
              </div>
            </div>
          ))}
        </div>

        <div className="hub-card hub-gradient-border bg-black/40 border-[var(--hub-primary)]/20 p-10 mt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 text-center md:text-left">
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-tight italic">
                Titanium Engine
              </h2>
              <p className="text-[var(--hub-muted)] text-sm font-bold max-w-xl leading-relaxed italic">
                Aumente o engajamento da sua rede criando desafios automáticos com recompensas em
                tempo real direto na Central Financeira.
              </p>
            </div>
            <Button className="h-12 rounded-xl hub-bg-primary text-black font-black text-[10px] uppercase tracking-[0.3em] px-10 shadow-2xl shadow-[var(--hub-primary)]/20 hover:scale-105 transition-all">
              Ver Configurações <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
