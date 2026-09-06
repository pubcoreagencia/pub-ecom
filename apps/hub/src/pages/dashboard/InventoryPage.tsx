import * as React from "react";
import { Shell } from "@/components/layout/Shell";
import { CardMetric, HubTable } from "@/components/ui-b";
import { Box, Search, AlertCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InventoryPage() {
  const stock = [
    {
      name: "Fone Titanium X1",
      sku: "TIT-X1-BLK",
      stock: 154,
      status: "Normal",
      color: "text-[var(--hub-primary)]",
    },
    {
      name: "Cadeira Ergo Nordic",
      sku: "NRD-CH-GRY",
      stock: 12,
      status: "Baixo",
      color: "text-orange-500",
    },
    {
      name: "Teclado Minimalist",
      sku: "MIN-KB-WHT",
      stock: 0,
      status: "Esgotado",
      color: "text-red-500",
    },
  ];

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-black tracking-tighter text-white">Estoque Global</h1>
            <p className="text-[var(--hub-muted)] font-black uppercase tracking-widest text-[10px]">
              Monitoramento e Reposição em Tempo Real
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-[10px] font-black uppercase tracking-widest px-6 py-3 border border-[var(--hub-border)] rounded-xl text-white hover:bg-white/5 transition-all">
              Sincronizar Fornecedores
            </button>
            <button className="text-[10px] font-black uppercase tracking-widest px-8 py-3 bg-[var(--hub-primary)] text-black rounded-xl shadow-lg shadow-[var(--hub-primary)]/20 hover:opacity-90">
              Nova Entrada
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CardMetric label="Itens Totais" value="8.420" icon={Box} />
          <CardMetric
            label="Estoque Baixo"
            value="24"
            icon={AlertCircle}
            trend="Reposição Necessária"
            trendType="down"
          />
          <CardMetric
            label="Giro de Estoque"
            value="4.2x"
            icon={TrendingUp}
            trend="+0.8 vs mês"
            trendType="up"
          />
        </div>

        <div className="hub-card hub-gradient-border overflow-hidden">
          <div className="p-6 border-b border-[var(--hub-border)] flex items-center gap-4">
            <Search className="h-4 w-4 text-[var(--hub-muted)]" />
            <input
              placeholder="Buscar por SKU ou Nome..."
              className="bg-transparent border-none text-[12px] font-bold text-white focus:outline-none w-full placeholder:text-[var(--hub-muted)]"
            />
          </div>
          <HubTable headers={["Produto", "SKU", "Qtd Disponível", "Status"]}>
            {stock.map((item, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-5 font-black text-white uppercase italic">{item.name}</td>
                <td className="px-6 py-5 text-[var(--hub-muted)] font-mono text-[11px]">
                  {item.sku}
                </td>
                <td className={cn("px-6 py-5 font-black italic", item.color)}>{item.stock}</td>
                <td className="px-6 py-5">
                  <span
                    className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded",
                      item.status === "Normal"
                        ? "bg-[var(--hub-primary)]/10 text-[var(--hub-primary)]"
                        : "bg-red-500/10 text-red-500",
                    )}
                  >
                    {item.status}
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
