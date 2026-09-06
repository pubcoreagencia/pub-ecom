import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  ShoppingBag,
  ArrowRight,
  Package,
  Truck,
  ShieldCheck,
  Star,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mockProducts } from "@/data/mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/store/confirmation")({
  component: StorefrontConfirmationB,
});

function StorefrontConfirmationB() {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-primary/10 selection:text-primary">
      {/* Mini Navbar */}
      <nav className="h-20 border-b border-slate-50 flex items-center justify-center px-8 bg-white/80 backdrop-blur-xl z-50">
        <Link to="/store" className="flex items-center gap-3 group">
          <div className="h-10 w-10 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <ShoppingBag className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tighter text-slate-900 uppercase">
            PUB ECOM
          </span>
        </Link>
      </nav>

      <main className="container px-8 mx-auto max-w-[800px] py-20 lg:py-32 text-center">
        <div className="space-y-12 animate-in fade-in zoom-in duration-700">
          <div className="flex justify-center">
            <div className="h-32 w-32 rounded-[40px] bg-emerald-50 flex items-center justify-center shadow-2xl shadow-emerald-500/10">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 animate-bounce" />
            </div>
          </div>

          <div className="space-y-4">
            <Badge
              variant="outline"
              className="border-emerald-100 text-emerald-600 font-black px-6 py-2 rounded-full uppercase tracking-widest text-[10px]"
            >
              Pagamento Confirmado
            </Badge>
            <h1 className="text-6xl md:text-7xl font-black tracking-tighter text-slate-900 uppercase">
              OBRIGADO PELA <br />
              <span className="text-primary italic">CONFIANÇA.</span>
            </h1>
            <p className="text-xl font-bold text-slate-500 max-w-lg mx-auto leading-relaxed">
              Seu pedido <span className="text-slate-900 italic">#PUB-2026-88X</span> foi processado
              com sucesso e já está sendo preparado.
            </p>
          </div>

          <Card className="rounded-[40px] border-none ring-1 ring-slate-100 shadow-xl bg-slate-50/50 p-10 max-w-md mx-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-400 uppercase tracking-widest italic">
                  Status do Pedido
                </span>
                <span className="font-black text-blue-600 uppercase">Em Preparação</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-400 uppercase tracking-widest italic">
                  Previsão de Entrega
                </span>
                <span className="font-black text-slate-900 uppercase">2-4 Dias Úteis</span>
              </div>
              <div className="pt-6 border-t border-slate-200">
                <Button
                  variant="outline"
                  className="w-full rounded-2xl border-slate-200 font-black text-xs uppercase tracking-widest h-14 bg-white hover:shadow-lg transition-all group"
                >
                  Rastrear Pedido{" "}
                  <ExternalLink className="ml-2 h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
                </Button>
              </div>
            </div>
          </Card>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link to="/store">
              <Button className="w-full sm:w-auto rounded-2xl font-black text-sm uppercase tracking-widest px-12 h-16 shadow-2xl shadow-primary/30 group">
                Voltar à Loja{" "}
                <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-2 transition-transform" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="text-slate-400 font-black text-xs uppercase tracking-[0.2em] hover:text-slate-900"
            >
              Imprimir Recibo
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 border-t border-slate-50">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Compra 100% Segura
              </p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-500" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Embalagem Titanium
              </p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                <Star className="h-6 w-6 text-yellow-500" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Avaliação 5 Estrelas
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-16 text-center border-t border-slate-50">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          © 2026 PUB ECOM. Powered by Titanium Engine.
        </p>
      </footer>
    </div>
  );
}

function Badge({ children, variant, className }: any) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variant === "outline"
          ? "text-foreground"
          : "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        className,
      )}
    >
      {children}
    </div>
  );
}
