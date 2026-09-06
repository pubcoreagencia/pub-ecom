import * as React from "react";
import {
  Settings,
  Shield,
  Globe,
  Zap,
  Database,
  Bell,
  Lock,
  CreditCard,
  Check,
  ChevronRight,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const sections = [
    {
      title: "Geral",
      icon: Globe,
      settings: [
        { label: "Nome da Operação", value: "PUB ECOM - OFFICIAL", type: "text" },
        { label: "Moeda Base", value: "BRL (R$)", type: "select" },
        { label: "Fuso Horário", value: "America/Sao_Paulo (UTC-3)", type: "select" },
      ],
    },
    {
      title: "Segurança & API",
      icon: Shield,
      settings: [
        { label: "Autenticação em Duas Etapas", value: true, type: "toggle" },
        { label: "Logs de Acesso", value: "Ver Histórico", type: "button" },
        { label: "Chave API (Master)", value: "pk_live_********************", type: "key" },
      ],
    },
    {
      title: "Notificações",
      icon: Bell,
      settings: [
        { label: "Alertas de Vendas (Telegram)", value: true, type: "toggle" },
        { label: "Relatórios Diários por Email", value: true, type: "toggle" },
        { label: "Alertas de Estoque Baixo", value: false, type: "toggle" },
      ],
    },
  ];

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              Configurações
            </h2>
            <p className="text-[var(--hub-muted)] text-[9px] font-bold uppercase tracking-[0.3em]">
              Gerenciamento Global do Ecossistema
            </p>
          </div>
          <Button className="h-10 hub-bg-primary hover:opacity-90 text-black text-[10px] font-black uppercase tracking-[0.2em] px-8 shadow-lg shadow-[var(--hub-primary)]/20 rounded-xl">
            <Check className="mr-2 h-4 w-4" />
            Salvar Alterações
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="hub-card hub-gradient-border p-2 bg-black/20">
              {[
                { label: "Geral", icon: Globe, active: true },
                { label: "Faturamento", icon: CreditCard },
                { label: "Equipe", icon: Database },
                { label: "Integrações", icon: Zap },
                { label: "Segurança", icon: Lock },
              ].map((item, i) => (
                <button
                  key={i}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl transition-all group",
                    item.active
                      ? "bg-white/5 text-white border border-white/10"
                      : "hover:bg-white/5 text-[var(--hub-muted)]",
                  )}
                >
                  <div className="flex items-center gap-4">
                    <item.icon
                      className={cn(
                        "h-4 w-4",
                        item.active ? "text-[var(--hub-primary)]" : "opacity-40",
                      )}
                    />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                      {item.label}
                    </span>
                  </div>
                  {!item.active && (
                    <ChevronRight className="h-4 w-4 opacity-10 group-hover:opacity-40" />
                  )}
                </button>
              ))}
            </div>

            <div className="hub-card hub-gradient-border bg-black/40 border-[var(--hub-primary)]/20 p-8">
              <h4 className="text-lg font-black text-white tracking-tighter uppercase mb-2 italic">
                Enterprise
              </h4>
              <p className="text-[9px] font-bold text-[var(--hub-muted)] uppercase tracking-widest mb-6 leading-relaxed italic">
                Sua operação está rodando na versão mais completa do ecossistema PUB ECOM.
              </p>
              <Button
                variant="outline"
                className="w-full rounded-xl border-white/10 text-white hover:bg-white/5 font-black text-[9px] uppercase tracking-[0.2em] h-10 italic"
              >
                Ver Faturas
              </Button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            {sections.map((section, i) => (
              <div key={i} className="hub-card hub-gradient-border overflow-hidden bg-black/20">
                <div className="px-10 py-6 border-b border-[var(--hub-border)] bg-black/40 flex items-center gap-4">
                  <div className="h-8 w-8 rounded-lg bg-black/40 border border-[var(--hub-border)] flex items-center justify-center">
                    <section.icon className="h-4 w-4 text-[var(--hub-muted)]" />
                  </div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white italic">
                    {section.title}
                  </h3>
                </div>
                <div className="divide-y divide-[var(--hub-border)]">
                  {section.settings.map((setting, j) => (
                    <div
                      key={j}
                      className="px-10 py-6 flex items-center justify-between hover:bg-white/[0.01] transition-colors"
                    >
                      <div>
                        <p className="text-xs font-black text-white uppercase tracking-tighter italic">
                          {setting.label}
                        </p>
                        {typeof setting.value === "string" && (
                          <p className="text-[10px] font-bold text-[var(--hub-muted)] mt-1 uppercase tracking-widest opacity-40">
                            {setting.value}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        {setting.type === "toggle" ? (
                          <Switch
                            defaultChecked={setting.value as boolean}
                            className="data-[state=checked]:bg-[var(--hub-primary)]"
                          />
                        ) : setting.type === "button" ? (
                          <Button
                            variant="outline"
                            className="rounded-lg border-[var(--hub-border)] bg-black/40 text-white font-black text-[9px] uppercase tracking-[0.2em] h-9 hover:bg-white/5"
                          >
                            {setting.value}
                          </Button>
                        ) : setting.type === "key" ? (
                          <div className="bg-black/40 px-4 py-2 rounded-lg font-mono text-[9px] text-[var(--hub-muted)] border border-[var(--hub-border)] border-dashed">
                            {setting.value}
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-lg hover:bg-white/5"
                          >
                            <ChevronRight className="h-4 w-4 opacity-20" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
