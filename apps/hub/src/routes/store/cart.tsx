import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBag, ArrowLeft, Trash2, Plus, Minus, ShieldCheck, Truck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { mockProducts } from "@/data/mock";

export const Route = createFileRoute("/store/cart")({
  component: StorefrontCartB,
});

function StorefrontCartB() {
  const cartItems = [
    { ...mockProducts[0], quantity: 1 },
    { ...mockProducts[1], quantity: 2 },
  ];

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price ?? 0) * item.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-primary/10 selection:text-primary">
      {/* Premium Navbar */}
      <nav className="h-24 border-b border-slate-100 flex items-center justify-between px-8 lg:px-16 sticky top-0 bg-white/80 backdrop-blur-xl z-50">
        <Link to="/store" className="flex items-center gap-3 group">
          <div className="h-10 w-10 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-300">
            <ShoppingBag className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tighter text-slate-900 uppercase">
            PUB ECOM
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            className="rounded-2xl font-black text-[10px] uppercase tracking-widest px-6 h-12 text-slate-500 hover:text-slate-900"
          >
            Continuar Comprando
          </Button>
        </div>
      </nav>

      <main className="container px-8 mx-auto max-w-[1400px] py-16 lg:py-24">
        <div className="flex flex-col lg:flex-row gap-16">
          {/* Cart Items */}
          <div className="flex-1 space-y-8">
            <div className="flex items-end justify-between border-b border-slate-200 pb-8">
              <h1 className="text-5xl font-black tracking-tighter text-slate-900 uppercase">
                Seu Carrinho
              </h1>
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                {cartItems.length} Itens
              </span>
            </div>

            <div className="space-y-6">
              {cartItems.map((item) => (
                <Card
                  key={item.id}
                  className="rounded-[32px] border-none ring-1 ring-slate-200/50 shadow-sm overflow-hidden bg-white group hover:shadow-xl transition-all duration-500"
                >
                  <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
                    <div className="h-32 w-32 rounded-2xl overflow-hidden shrink-0 bg-slate-100 group-hover:scale-105 transition-transform">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 space-y-1 text-center md:text-left">
                      <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase leading-tight group-hover:text-primary transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                        Edição Titanium
                      </p>
                    </div>

                    <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl hover:bg-white transition-colors"
                      >
                        <Minus className="h-4 w-4 text-slate-900" />
                      </Button>
                      <span className="text-sm font-black w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl hover:bg-white transition-colors"
                      >
                        <Plus className="h-4 w-4 text-slate-900" />
                      </Button>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xl font-black text-slate-900 tracking-tighter italic">
                        R$ {((item.price ?? 0) * item.quantity).toLocaleString("pt-BR")}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl px-4 mt-1 font-black text-[9px] uppercase tracking-widest"
                      >
                        Remover <Trash2 className="ml-2 h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="w-full lg:w-[400px] shrink-0">
            <div className="sticky top-40 space-y-6">
              <Card className="rounded-[40px] border-none ring-1 ring-slate-200/50 shadow-2xl bg-white overflow-hidden p-10">
                <h2 className="text-2xl font-black tracking-tighter text-slate-900 uppercase mb-8">
                  Resumo
                </h2>

                <div className="space-y-6 mb-10 pb-8 border-b border-slate-100">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-400 uppercase tracking-widest italic">
                      Subtotal
                    </span>
                    <span className="font-black text-slate-900">
                      R$ {subtotal.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-400 uppercase tracking-widest italic">
                      Frete
                    </span>
                    <span className="font-black text-emerald-500 uppercase">Grátis</span>
                  </div>
                </div>

                <div className="flex justify-between items-end mb-10">
                  <span className="text-sm font-black text-slate-900 uppercase tracking-widest">
                    Total
                  </span>
                  <div className="text-right">
                    <p className="text-4xl font-black text-slate-900 tracking-tighter italic leading-none">
                      R$ {subtotal.toLocaleString("pt-BR")}
                    </p>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-2">
                      ou 12x de R$ {(subtotal / 12).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>

                <Link to="/store/checkout">
                  <Button className="w-full rounded-[24px] font-black text-sm uppercase tracking-widest h-16 shadow-2xl shadow-primary/30 group">
                    Finalizar Compra{" "}
                    <Zap className="ml-3 h-5 w-5 fill-current group-hover:scale-125 transition-transform" />
                  </Button>
                </Link>

                <div className="mt-10 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-tight">
                      Seguro <br />
                      Garantido
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <Truck className="h-5 w-5 text-blue-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-tight">
                      Envio <br />
                      Expresso
                    </span>
                  </div>
                </div>
              </Card>

              <Link
                to="/store"
                className="flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" /> Continuar Escolhendo
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
