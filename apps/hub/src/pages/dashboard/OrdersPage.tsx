import * as React from "react";
import { Shell } from "@/components/layout/Shell";
import { HubTable, CardMetric } from "@/components/ui-b";
import {
  Package,
  Search,
  Filter,
  Download,
  Eye,
  Clock,
  Truck,
  CircleDollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockOrders } from "@/data/mock";

export default function OrdersPage() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/20">
            Pago
          </span>
        );
      case "shipped":
        return (
          <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 border border-blue-500/20">
            Enviado
          </span>
        );
      case "pending":
        return (
          <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-500 border border-orange-500/20">
            Pendente
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white/5 text-white border border-white/10">
            {status}
          </span>
        );
    }
  };

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              Gestão de Pedidos
            </h2>
            <p className="text-[var(--hub-muted)] text-[9px] font-bold uppercase tracking-[0.3em]">
              Monitoramento de Vendas & Fulfillment em Tempo Real
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-black/40 px-4 py-2.5 rounded-xl border border-[var(--hub-border)] group focus-within:border-[var(--hub-primary)] transition-all w-64">
              <Search className="h-4 w-4 text-[var(--hub-muted)] group-focus-within:text-[var(--hub-primary)]" />
              <input
                type="text"
                placeholder="Buscar Pedido, Cliente ou Rastreio..."
                className="bg-transparent border-none text-[11px] font-bold text-white focus:outline-none w-full placeholder:text-[var(--hub-muted)] uppercase tracking-wider"
              />
            </div>
            <Button
              variant="outline"
              className="h-10 border-[var(--hub-border)] text-white text-[10px] font-black uppercase tracking-[0.2em] px-6 rounded-xl hover:bg-white/5"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <CardMetric
            label="Pedidos Hoje"
            value="842"
            trend="+12.4%"
            trendType="up"
            icon={Package}
          />
          <CardMetric
            label="Aguardando Envio"
            value="124"
            subtext="Fulfillment pendente"
            icon={Clock}
          />
          <CardMetric label="Em Trânsito" value="452" icon={Truck} />
          <CardMetric
            label="Ticket Médio"
            value="R$ 184,20"
            trend="+R$ 12,00"
            trendType="up"
            icon={CircleDollarSign}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">
              Log de Operações
            </h3>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-[9px] font-black text-white bg-white/5 border border-[var(--hub-border)] rounded-lg uppercase tracking-widest hover:bg-white/10 transition-all">
                <Filter className="h-3 w-3 inline-block mr-2" />
                Filtros
              </button>
            </div>
          </div>

          <HubTable
            headers={["ID Pedido", "Data", "Cliente", "Loja Origem", "Total", "Status", "Ação"]}
          >
            {mockOrders.map((order) => (
              <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-6 py-5 font-black text-[var(--hub-muted)] group-hover:text-white italic">
                  #{order.id}
                </td>
                <td className="px-6 py-5">
                  <span className="text-[var(--hub-muted)] font-bold text-[10px] uppercase tracking-wider">
                    {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </td>
                <td className="px-6 py-5">
                  <div className="space-y-0.5">
                    <span className="font-black text-white italic block leading-none">
                      João Silva
                    </span>
                    <span className="text-[9px] text-[var(--hub-muted)] uppercase tracking-widest font-bold">
                      joao@email.com
                    </span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className="text-[9px] text-[var(--hub-muted)] font-black uppercase tracking-widest bg-black/40 px-2 py-1 rounded border border-[var(--hub-border)]">
                    Titanium Hub
                  </span>
                </td>
                <td className="px-6 py-5 text-white font-black italic">
                  R$ {order.amount.toLocaleString("pt-BR")}
                </td>
                <td className="px-6 py-5">{getStatusBadge(order.status)}</td>
                <td className="px-6 py-5 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-lg hover:bg-[var(--hub-primary)]/10 text-[var(--hub-muted)] hover:text-[var(--hub-primary)] transition-all"
                  >
                    <Eye className="h-4 w-4" />
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
