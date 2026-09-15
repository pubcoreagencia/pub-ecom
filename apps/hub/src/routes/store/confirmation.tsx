import * as React from "react";
import { createFileRoute, Link, useSearchParams } from "@tanstack/react-router";
import {
  CheckCircle2,
  ShoppingBag,
  ArrowRight,
  Package,
  Truck,
  ShieldCheck,
  Star,
  ExternalLink,
  Clock,
  QrCode,
  Copy,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";

export const Route = createFileRoute("/store/confirmation")({
  component: StorefrontConfirmationB,
});

function StorefrontConfirmationB() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId") || null;
  const { items } = useCart();
  const subtotal = items.reduce((acc, item) => acc + (item.price ?? 0) * item.quantity, 0);

  // Payment states
  const [paymentStatus, setPaymentStatus] = React.useState<"PENDING" | "PROCESSING" | "PAID" | "FAILED">("PENDING");
  const [pixQrCode, setPixQrCode] = React.useState<string | null>(null);
  const [pixCopyText, setPixCopyText] = React.useState<string | null>(null);
  const [isPolling, setIsPolling] = React.useState(false);
  const [paymentId, setPaymentId] = React.useState<string | null>(null);

  // Create payment intent on mount
  React.useEffect(() => {
    if (!orderId) return;
    setPaymentStatus("PROCESSING");
    createPaymentIntent(orderId);
  }, [orderId]);

  const createPaymentIntent = async (oid: string) => {
    try {
      const res = await fetch("/api/payment/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: oid, idempotency_key: sessionStorage.getItem("idempotency_key") || crypto.randomUUID() }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message || "Payment failed");
      setPaymentId(result.data.paymentId);
      setPixQrCode(result.data.qrCode);
      setPixCopyText(result.data.qrCopy);
      setPaymentStatus("PENDING");
      startPolling(result.data.paymentId);
    } catch (err: any) {
      setPaymentStatus("FAILED");
    }
  };

  // Polling for payment status
  const startPolling = (pid: string) => {
    setIsPolling(true);
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment/${pid}/status`);
        const result = await res.json();
        if (res.ok && result.data?.status) {
          setPaymentStatus(result.data.status);
          if (result.data.status === "PAID") {
            clearInterval(interval);
            setIsPolling(false);
          } else if (result.data.status === "FAILED") {
            clearInterval(interval);
            setIsPolling(false);
          }
        }
      } catch {}
    }, 5000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-primary/10 selection:text-primary">
      <nav className="h-20 border-b border-slate-50 flex items-center justify-center px-8 bg-white/80 backdrop-blur-xl z-50">
        <Link to="/store" className="flex items-center gap-3 group">
          <div className="h-10 w-10 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <ShoppingBag className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tighter text-slate-900 uppercase">PUB ECOM</span>
        </Link>
      </nav>

      <main className="container px-8 mx-auto max-w-[800px] py-20 lg:py-32 text-center">
        <div className="space-y-12 animate-in fade-in zoom-in duration-700">
          <div className="flex justify-center">
            <div className="h-32 w-32 rounded-[40px] bg-emerald-50 flex items-center justify-center shadow-2xl shadow-emerald-500/10">
              {paymentStatus === "PAID" ? (
                <CheckCircle2 className="h-16 w-16 text-emerald-500 animate-bounce" />
              ) : paymentStatus === "PROCESSING" || paymentStatus === "PENDING" ? (
                <Clock className="h-16 w-16 text-amber-500 animate-pulse" />
              ) : (
                <CheckCircle2 className="h-16 w-16 text-emerald-500 animate-bounce" />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Badge variant="outline" className="border-emerald-100 text-emerald-600 font-black px-6 py-2 rounded-full uppercase tracking-widest text-[10px]">
              {paymentStatus === "PENDING" || paymentStatus === "PROCESSING"
                ? "Aguardando Pagamento via PIX"
                : "Pagamento Confirmado"}
            </Badge>
            <h1 className="text-6xl md:text-7xl font-black tracking-tighter text-slate-900 uppercase">
              {paymentStatus === "PAID" ? "Pagamento Aprovado" : "Confirme o Pagamento"}
              <br />
              <span className="text-primary italic">{paymentStatus === "PAID" ? "OBRIGADO" : "PIX"}</span>
            </h1>
            <p className="text-xl font-bold text-slate-500 max-w-lg mx-auto leading-relaxed">
              {paymentStatus === "PAID"
                ? `Seu pedido ${orderId} foi processado com sucesso e já está sendo preparado.`
                : `Realize o pagamento via PIX para finalizar o pedido ${orderId}.`}
            </p>
          </div>

          {/* PIX Display */}
          {(paymentStatus === "PENDING" || paymentStatus === "PROCESSING") && pixQrCode && (
            <Card className="rounded-[40px] border-none ring-1 ring-slate-100 shadow-xl bg-slate-50/50 p-10 max-w-md mx-auto">
              <div className="space-y-6">
                <h3 className="text-lg font-black tracking-tighter text-slate-900 uppercase">
                  PIX - Leia o QR Code
                </h3>
                {pixQrCode && (
                  <div className="bg-white p-4 rounded-xl">
                    <img src={pixQrCode} alt="QR Code PIX" className="w-48 h-48 mx-auto" />
                  </div>
                )}
                {pixCopyText && (
                  <Button variant="outline" onClick={() => copyToClipboard(pixCopyText)}>
                    <Copy className="mr-2 h-4 w-4" /> Copiar Chave PIX
                  </Button>
                )}
                {isPolling && (
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verificando status do pagamento...
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Order Confirmation Card */}
          <Card className="rounded-[40px] border-none ring-1 ring-slate-100 shadow-xl bg-slate-50/50 p-10 max-w-md mx-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-400 uppercase tracking-widest italic">
                  Status do Pedido
                </span>
                <span className={cn(
                  "font-black uppercase",
                  paymentStatus === "PAID" ? "text-emerald-600" :
                  paymentStatus === "PROCESSING" || paymentStatus === "PENDING" ? "text-amber-600" :
                  "text-red-600"
                )}>
                  {paymentStatus}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-400 uppercase tracking-widest italic">
                  Previsão de Entrega
                </span>
                <span className="font-black text-slate-900 uppercase">2-4 Dias Úteis</span>
              </div>
              <div className="pt-6 border-t border-slate-200">
                <Button variant="outline" className="w-full rounded-2xl border-slate-200 font-black text-xs uppercase tracking-widest h-14 bg-white hover:shadow-lg transition-all group">
                  Rastrear Pedido <ExternalLink className="ml-2 h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
                </Button>
              </div>
            </div>
          </Card>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link to="/store">
              <Button className="w-full sm:w-auto rounded-2xl font-black text-sm uppercase tracking-widest px-12 h-16 shadow-2xl shadow-primary/30 group">
                Voltar à Loja <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-2 transition-transform" />
              </Button>
            </Link>
            <Button variant="ghost" className="text-slate-400 font-black text-xs uppercase tracking-[0.2em] hover:text-slate-900">
              Imprimir Recibo
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Badge({ children, variant, className }: any) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variant === "outline" ? "text-foreground" : "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        className,
      )}
    >
      {children}
    </div>
  );
}