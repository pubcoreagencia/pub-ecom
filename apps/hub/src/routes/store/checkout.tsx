import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShoppingBag,
  ShieldCheck,
  CreditCard,
  Truck,
  Lock,
  ArrowLeft,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { mockProducts } from "@/data/mock";

export const Route = createFileRoute("/store/checkout")({
  component: StorefrontCheckoutB,
});

function StorefrontCheckoutB() {
  const cartItems = [
    { ...mockProducts[0], quantity: 1 },
    { ...mockProducts[1], quantity: 2 },
  ];

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price ?? 0) * item.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-primary/10 selection:text-primary">
      {/* Checkout Header */}
      <nav className="h-20 border-b border-slate-100 flex items-center justify-between px-8 lg:px-16 bg-white sticky top-0 z-50">
        <Link to="/store" className="flex items-center gap-2 group">
          <div className="h-8 w-8 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <ShoppingBag className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tighter text-slate-900 uppercase">
            PUB ECOM
          </span>
        </Link>
        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <Lock className="h-3 w-3" /> Conexão Segura
        </div>
      </nav>

      <main className="container px-8 mx-auto max-w-[1200px] py-16">
        <div className="flex flex-col lg:flex-row gap-16">
          {/* Checkout Form */}
          <div className="flex-1 space-y-12">
            <section className="space-y-6">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black italic">
                  01
                </div>
                <h2 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">
                  Informações Pessoais
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    E-mail
                  </label>
                  <Input
                    placeholder="seu@email.com"
                    className="h-14 rounded-2xl border-slate-200 font-bold focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    CPF / CNPJ
                  </label>
                  <Input
                    placeholder="000.000.000-00"
                    className="h-14 rounded-2xl border-slate-200 font-bold focus:ring-primary"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black italic">
                  02
                </div>
                <h2 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">
                  Entrega
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Endereço Completo
                  </label>
                  <Input
                    placeholder="Rua, número, complemento..."
                    className="h-14 rounded-2xl border-slate-200 font-bold focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Cidade
                  </label>
                  <Input
                    placeholder="São Paulo"
                    className="h-14 rounded-2xl border-slate-200 font-bold focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    CEP
                  </label>
                  <Input
                    placeholder="00000-000"
                    className="h-14 rounded-2xl border-slate-200 font-bold focus:ring-primary"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black italic">
                  03
                </div>
                <h2 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">
                  Pagamento
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <button className="flex items-center justify-between p-6 rounded-3xl bg-white border-2 border-primary shadow-xl shadow-primary/5 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <CreditCard className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tighter">
                        Cartão de Crédito
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Em até 12x sem juros
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </button>
                <button className="flex items-center justify-between p-6 rounded-3xl bg-white border-2 border-slate-100 hover:border-slate-200 transition-all group">
                  <div className="flex items-center gap-4 text-slate-400">
                    <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                      <Zap className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black uppercase tracking-tighter">
                        Pix Inteligente
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest">
                        Aprovação instantânea
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </section>
          </div>

          {/* Order Summary Checkout */}
          <div className="w-full lg:w-[400px] shrink-0">
            <Card className="rounded-[40px] border-none ring-1 ring-slate-200/50 shadow-2xl bg-white overflow-hidden sticky top-32">
              <div className="p-8 border-b border-slate-50 bg-slate-50/50">
                <h3 className="text-lg font-black tracking-tighter text-slate-900 uppercase italic">
                  Resumo do Pedido
                </h3>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-start gap-4">
                      <div className="flex gap-3">
                        <div className="h-12 w-12 rounded-lg overflow-hidden shrink-0 border border-slate-100">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter leading-tight line-clamp-1">
                            {item.name}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            {item.quantity}x Unidade
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-slate-900 italic">
                        R$ {((item.price ?? 0) * item.quantity).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400 uppercase tracking-widest">
                      Subtotal
                    </span>
                    <span className="font-black text-slate-900">
                      R$ {subtotal.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400 uppercase tracking-widest">
                      Frete
                    </span>
                    <span className="font-black text-emerald-500 uppercase">Grátis</span>
                  </div>
                  <div className="flex justify-between items-end pt-4 border-t border-slate-100">
                    <span className="text-sm font-black text-slate-900 uppercase tracking-widest">
                      Total
                    </span>
                    <p className="text-3xl font-black text-slate-900 tracking-tighter italic leading-none">
                      R$ {subtotal.toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>

                <Link to="/store/confirmation">
                  <Button className="w-full rounded-[20px] font-black text-sm uppercase tracking-widest h-14 shadow-xl shadow-primary/20 mt-4 group">
                    Pagar Agora{" "}
                    <CheckCircle2 className="ml-2 h-4 w-4 fill-current group-hover:scale-110 transition-transform" />
                  </Button>
                </Link>

                <div className="flex flex-col items-center gap-4 pt-6">
                  <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <ShieldCheck className="h-3 w-3 text-emerald-500" /> Site Seguro & Criptografado
                  </div>
                  <div className="flex gap-2">
                    <div className="h-6 w-10 bg-slate-50 rounded border border-slate-100" />
                    <div className="h-6 w-10 bg-slate-50 rounded border border-slate-100" />
                    <div className="h-6 w-10 bg-slate-50 rounded border border-slate-100" />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
