import * as React from "react";
import { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { CardMetric, HubTable } from "@/components/ui-b";
import {
  CircleDollarSign,
  TrendingUp,
  ArrowDownToLine,
  Percent,
  Wallet,
  Receipt,
  ArrowUpRight,
  CreditCard,
  Building2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Download,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Transaction {
  id: string;
  date: string;
  store: string;
  gateway: "Mercado Pago" | "Stripe" | "Asaas" | "PIX Direto";
  amount: number;
  fee: number;
  net: number;
  status: "completed" | "processing" | "refunded";
}

const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: "TX-9021", date: "Hoje, 14:32", store: "Glow & Co. Luxury", gateway: "PIX Direto", amount: 189.90, fee: 1.89, net: 188.01, status: "completed" },
  { id: "TX-9020", date: "Hoje, 14:15", store: "PetLover Express", gateway: "Mercado Pago", amount: 329.90, fee: 13.19, net: 316.71, status: "completed" },
  { id: "TX-9019", date: "Hoje, 13:50", store: "IronPeak Performance", gateway: "Stripe", amount: 249.00, fee: 9.96, net: 239.04, status: "completed" },
  { id: "TX-9018", date: "Hoje, 12:40", store: "Urban Vogue Street", gateway: "Asaas", amount: 199.90, fee: 3.99, net: 195.91, status: "completed" },
  { id: "TX-9017", date: "Hoje, 11:22", store: "CyberTech Pro", gateway: "PIX Direto", amount: 489.00, fee: 4.89, net: 484.11, status: "completed" },
  { id: "TX-9016", date: "Hoje, 09:10", store: "Gol de Placa Esportes", gateway: "Mercado Pago", amount: 159.90, fee: 6.39, net: 153.51, status: "completed" },
  { id: "TX-9015", date: "Ontem, 22:45", store: "Aura Gold & Diamond", gateway: "Stripe", amount: 590.00, fee: 23.60, net: 566.40, status: "completed" },
];

export default function FinancePage() {
  const [balance, setBalance] = useState(48350.20);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [pixKeyType, setPixKeyType] = useState<"cpf" | "cnpj" | "email" | "telefone" | "aleatoria">("cpf");
  const [pixKey, setPixKey] = useState("");
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(withdrawAmount);
    if (!val || val <= 0) {
      toast.error("Informe um valor válido para saque.");
      return;
    }
    if (val > balance) {
      toast.error("Saldo insuficiente para realizar este saque.");
      return;
    }
    if (!pixKey.trim()) {
      toast.error("Informe uma chave PIX válida.");
      return;
    }

    setIsProcessingWithdraw(true);
    setTimeout(() => {
      setBalance((prev) => prev - val);
      const newTx: Transaction = {
        id: `WD-${Math.floor(1000 + Math.random() * 9000)}`,
        date: "Agora mesmo",
        store: "Retirada Master",
        gateway: "PIX Direto",
        amount: -val,
        fee: 0,
        net: -val,
        status: "completed",
      };
      setTransactions([newTx, ...transactions]);
      setIsProcessingWithdraw(false);
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
      toast.success(`Saque PIX de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)} enviado com sucesso para a chave: ${pixKey}`);
    }, 1000);
  };

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              Central Financeira &amp; Payouts
            </h2>
            <p className="text-[var(--hub-muted)] text-[9px] font-bold uppercase tracking-[0.3em]">
              Consolidação de Vendas Multi-Gateway &amp; Saques PIX Realtime
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setIsWithdrawModalOpen(true)}
              className="h-10 hub-bg-primary hover:opacity-90 text-black text-[10px] font-black uppercase tracking-[0.2em] px-6 shadow-lg shadow-[var(--hub-primary)]/20 rounded-xl flex items-center gap-2"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Solicitar Saque PIX
            </Button>
          </div>
        </div>

        {/* 4 Cards de Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <CardMetric
            label="Saldo Disponível (PIX)"
            value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(balance)}
            trend="Pronto para Saque"
            trendType="up"
            icon={CircleDollarSign}
          />
          <CardMetric
            label="Receita Bruta (Mês)"
            value="R$ 184.950,00"
            trend="+18.4%"
            trendType="up"
            icon={TrendingUp}
          />
          <CardMetric
            label="Repasse Influencers &amp; Afiliados"
            value="R$ 24.680,00"
            subtext="Comissões líquidas pagas"
            icon={Wallet}
          />
          <CardMetric
            label="Taxa Média de Gateway"
            value="2.85%"
            trend="Otimizado"
            trendType="neutral"
            icon={Percent}
          />
        </div>

        {/* Breakdown por Gateway de Pagamento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-black/40 border border-emerald-500/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">PIX Direto</span>
              <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">0.99%</span>
            </div>
            <p className="text-xl font-black text-white italic">R$ 98.420,00</p>
            <p className="text-[9px] text-slate-400 mt-1">53.2% do faturamento total</p>
          </div>

          <div className="bg-black/40 border border-sky-500/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-400">Mercado Pago</span>
              <span className="text-[9px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">3.99%</span>
            </div>
            <p className="text-xl font-black text-white italic">R$ 48.210,00</p>
            <p className="text-[9px] text-slate-400 mt-1">26.1% do faturamento total</p>
          </div>

          <div className="bg-black/40 border border-purple-500/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">Stripe Global</span>
              <span className="text-[9px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">4.10%</span>
            </div>
            <p className="text-xl font-black text-white italic">R$ 24.190,00</p>
            <p className="text-[9px] text-slate-400 mt-1">13.1% do faturamento total</p>
          </div>

          <div className="bg-black/40 border border-amber-500/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Asaas Cobranças</span>
              <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">1.99%</span>
            </div>
            <p className="text-xl font-black text-white italic">R$ 14.130,00</p>
            <p className="text-[9px] text-slate-400 mt-1">7.6% do faturamento total</p>
          </div>
        </div>

        {/* Tabela de Extrato de Transações */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white italic">
              Extrato Financeiro &amp; Repasses em Tempo Real
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-400 font-mono">Atualizado via Webhooks D1</span>
            </div>
          </div>

          <HubTable
            headers={[
              "ID / Data",
              "Origem / Loja",
              "Gateway",
              "Valor Bruto",
              "Taxa",
              "Líquido",
              "Status",
            ]}
          >
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <div className="space-y-0.5">
                    <span className="font-mono text-xs font-bold text-white block">{tx.id}</span>
                    <span className="text-[9px] text-slate-400">{tx.date}</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-bold text-white text-xs">{tx.store}</td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-white/5 border border-white/10 text-cyan-300">
                    {tx.gateway}
                  </span>
                </td>
                <td className="px-6 py-4 font-mono font-bold text-xs text-white">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(tx.amount)}
                </td>
                <td className="px-6 py-4 font-mono text-xs text-red-400">
                  {tx.fee > 0 ? `- R$ ${tx.fee.toFixed(2)}` : "R$ 0,00"}
                </td>
                <td className="px-6 py-4 font-mono font-black text-xs text-emerald-400">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(tx.net)}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                    Liquidado
                  </span>
                </td>
              </tr>
            ))}
          </HubTable>
        </div>
      </div>

      {/* Modal de Saque PIX Interativo */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f172a] border border-cyan-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <ArrowDownToLine className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase italic">Saque PIX Instantâneo</h3>
                  <p className="text-[9px] text-slate-400 font-mono">Transferência Direta Banco Central</p>
                </div>
              </div>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Saldo Disponível:
                </label>
                <div className="p-3 rounded-xl bg-black/50 border border-emerald-500/30 flex items-center justify-between">
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(balance)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(balance.toFixed(2))}
                    className="text-[9px] font-black uppercase text-cyan-400 hover:underline"
                  >
                    Sacar Tudo
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Valor do Saque (R$):
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm font-bold focus:outline-none focus:border-cyan-400"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(["cpf", "cnpj", "email", "telefone", "aleatoria"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPixKeyType(type)}
                    className={`py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      pixKeyType === type
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                        : "bg-black/30 border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Chave PIX ({pixKeyType.toUpperCase()}):
                </label>
                <input
                  type="text"
                  placeholder="Informe sua chave PIX..."
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                  required
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isProcessingWithdraw}
                  className="w-full h-11 hub-bg-primary text-black font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-[var(--hub-primary)]/20"
                >
                  {isProcessingWithdraw ? "Processando TED/PIX..." : "Confirmar Saque Agora"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
