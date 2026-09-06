import * as React from "react";
import { Shell } from "@/components/layout/Shell";
import { HubTable, CardMetric } from "@/components/ui-b";
import { Button } from "@/components/ui/button";
import { Plus, Search, Settings } from "lucide-react";

export default function AffiliatesPage() {
  const affiliates = [
    {
      name: "Lucas Mendes",
      sales: "R$ 12.450",
      commission: "10%",
      totalEarned: "R$ 1.245",
      leads: 452,
      status: "Active",
    },
    {
      name: "Maria Clara",
      sales: "R$ 8.920",
      commission: "12%",
      totalEarned: "R$ 1.070",
      leads: 310,
      status: "Active",
    },
  ];

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              Rede de Afiliados
            </h2>
            <p className="text-[var(--hub-muted)] text-[9px] font-bold uppercase tracking-[0.3em]">
              Gestão de Performance & Comissionamento
            </p>
          </div>
          <Button className="h-10 hub-bg-primary hover:opacity-90 text-black text-[10px] font-black uppercase tracking-[0.2em] px-6 shadow-lg shadow-[var(--hub-primary)]/20 rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Recrutar Afiliado
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CardMetric label="Volume de Vendas" value="R$ 45.280" />
          <CardMetric label="Comissões Pagas" value="R$ 4.528" />
          <CardMetric label="Taxa Conversão" value="4.8%" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white italic">
              Performers Ativos
            </h3>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-lg border border-[var(--hub-border)] group focus-within:border-[var(--hub-primary)] transition-all w-64">
                <Search className="h-3 w-3 text-[var(--hub-muted)] group-focus-within:text-[var(--hub-primary)]" />
                <input
                  type="text"
                  placeholder="Buscar afiliado..."
                  className="bg-transparent border-none text-[10px] font-bold text-white focus:outline-none w-full placeholder:text-[var(--hub-muted)] uppercase tracking-wider"
                />
              </div>
            </div>
          </div>

          <HubTable
            headers={[
              "Afiliado",
              "Vendas Atribuídas",
              "Comissão",
              "Ganhos Totais",
              "Leads",
              "Ações",
            ]}
          >
            {affiliates.map((a, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-6 py-5 text-xs font-black text-white uppercase tracking-tighter italic">
                  {a.name}
                </td>
                <td className="px-6 py-5 text-right text-xs font-bold text-[var(--hub-muted)] italic">
                  {a.sales}
                </td>
                <td className="px-6 py-5 text-center">
                  <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-black/40 border border-[var(--hub-border)] text-white">
                    {a.commission}
                  </span>
                </td>
                <td className="px-6 py-5 text-right text-xs font-black text-[var(--hub-primary)] italic">
                  {a.totalEarned}
                </td>
                <td className="px-6 py-5 text-center text-xs font-bold text-[var(--hub-muted)] opacity-40">
                  {a.leads}
                </td>
                <td className="px-6 py-5 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg hover:bg-white/5 border border-[var(--hub-border)] opacity-40 group-hover:opacity-100 transition-all"
                  >
                    <Settings className="h-3 w-3 text-white" />
                  </Button>
                </td>
              </tr>
            ))}
          </HubTable>
        </div>
      </div>
    </Shell>
  );
}
