import * as React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface CardMetricProps {
  label: string;
  value: string;
  trend?: string;
  trendType?: "up" | "down" | "neutral";
  subtext?: string;
  icon?: React.ElementType;
}

export function CardMetric({
  label,
  value,
  trend,
  trendType,
  subtext,
  icon: Icon,
}: CardMetricProps) {
  return (
    <div className="hub-card hub-gradient-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--hub-muted)] opacity-60">
          {label}
        </span>
        {Icon && (
          <div className="h-8 w-8 rounded-lg bg-black/40 border border-[var(--hub-border)] flex items-center justify-center">
            <Icon className="h-4 w-4 text-[var(--hub-muted)] opacity-50" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-3xl font-black text-white tracking-tighter italic leading-none">
          {value}
        </h3>
        <div className="flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                "text-[10px] font-black flex items-center gap-1 px-2 py-0.5 rounded bg-black/40 border border-[var(--hub-border)]",
                trendType === "up" && "text-[var(--hub-primary)] border-[var(--hub-primary)]/20",
                trendType === "down" && "text-orange-500 border-orange-500/20",
                trendType === "neutral" && "text-[var(--hub-muted)]",
              )}
            >
              {trendType === "up" && <TrendingUp className="h-3 w-3" />}
              {trendType === "down" && <TrendingDown className="h-3 w-3" />}
              {trend}
            </span>
          )}
          {subtext && (
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--hub-muted)] opacity-40 italic">
              {subtext}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function HubTable({ children, headers }: { children: React.ReactNode; headers: (React.ReactNode | string)[] }) {
  return (
    <div className="hub-card hub-gradient-border overflow-hidden">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="border-b border-[var(--hub-border)] bg-black/40">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-6 py-4 font-black uppercase tracking-[0.3em] text-[var(--hub-muted)] opacity-60"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--hub-border)]">{children}</tbody>
      </table>
    </div>
  );
}

export function AcquisitionFunnel() {
  const steps = [
    {
      label: "L1: PAGE VIEW",
      value: "184.200",
      percent: "100%",
      width: "100%",
      color: "bg-[var(--hub-primary)]/20",
    },
    {
      label: "L2: ADD TO CART",
      value: "33.890",
      percent: "18,4%",
      width: "18.4%",
      color: "bg-[var(--hub-primary)]/40",
    },
    {
      label: "L3: ADD PAYMENT",
      value: "15.120",
      percent: "8,2%",
      width: "8.2%",
      color: "bg-[var(--hub-primary)]/60",
    },
    {
      label: "L4: PURCHASE",
      value: "6.980",
      percent: "3,8%",
      width: "3.8%",
      color: "bg-[var(--hub-primary)]",
    },
  ];

  return (
    <div className="hub-card hub-gradient-border p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">
          Audience Funnel
        </h4>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--hub-primary)]" />
          <span className="text-[9px] font-black text-[var(--hub-primary)] uppercase tracking-widest">
            Tracking Ativo
          </span>
        </div>
      </div>
      <div className="space-y-8">
        {steps.map((step) => (
          <div key={step.label} className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em]">
              <span className="text-[var(--hub-muted)]">{step.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-[var(--hub-muted)] opacity-40">{step.percent}</span>
                <span className="text-white italic">{step.value}</span>
              </div>
            </div>
            <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-[var(--hub-border)]">
              <div
                className={cn("h-full transition-all duration-1000 ease-out", step.color)}
                style={{ width: step.width }}
              />
            </div>
          </div>
        ))}
      </div>
      <button className="w-full py-4 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--hub-primary)] hover:bg-[var(--hub-primary)]/5 border border-[var(--hub-primary)]/20 rounded-xl transition-all">
        Gestão de Públicos (L1-L4)
      </button>
    </div>
  );
}
