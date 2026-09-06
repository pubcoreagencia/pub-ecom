import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Lock,
  Loader2,
  AlertCircle,
  CircleDollarSign,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export const ResetPasswordPage = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      try {
        if (typeof window !== "undefined") {
          // 1. Check for PKCE exchange code in query string
          const params = new URLSearchParams(window.location.search);
          const code = params.get("code");
          if (code) {
            const { data } = await supabase.auth.exchangeCodeForSession(code);
            if (data?.session && isMounted) {
              setReady(true);
              return;
            }
          }

          // 2. Check for hash tokens from Supabase Auth recovery link
          if (window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
            const accessToken = hashParams.get("access_token");
            const refreshToken = hashParams.get("refresh_token");
            if (accessToken && refreshToken) {
              const { data } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (data?.session && isMounted) {
                setReady(true);
                return;
              }
            }
          }
        }

        const { data } = await supabase.auth.getSession();
        if (data?.session && isMounted) {
          setReady(true);
        }
      } catch (err) {
        console.error("Auth recovery init error:", err);
      } finally {
        if (isMounted) setReady(true);
      }
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || session) && isMounted) {
        setReady(true);
      }
    });
    authSubscription = listener?.subscription ?? null;

    return () => {
      isMounted = false;
      authSubscription?.unsubscribe();
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setErrorMsg("Preencha a nova senha e a confirmação.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMsg(error.message || "Falha ao redefinir a senha.");
        toast.error("Erro ao redefinir senha.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      toast.success("Senha atualizada com sucesso!");
      setTimeout(() => {
        navigate({ to: "/dashboard" });
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro inesperado ao redefinir senha.");
      toast.error("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 selection:bg-red-500/30">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/20 mb-2">
            <CircleDollarSign className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">
            PUB ECOM
          </h1>
          <p className="text-xs font-bold text-red-500 uppercase tracking-widest">
            Redefinição de Senha
          </p>
        </div>

        <Card className="bg-black border-red-500/20 shadow-2xl shadow-red-500/5">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-black uppercase tracking-wider text-white">
              Criar Nova Senha
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Digite e confirme sua nova senha de acesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center space-y-4 py-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-white">Senha Redefinida!</h3>
                <p className="text-xs text-slate-400">
                  Redirecionando para o painel principal em instantes...
                </p>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                    <Input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={loading}
                      className="pl-10 bg-black/50 border-slate-800 text-white focus:border-red-500 h-11"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                    <Input
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      className="pl-10 bg-black/50 border-slate-800 text-white focus:border-red-500 h-11"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-lg text-xs text-red-400 font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-red-600/10 mt-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      Salvar Nova Senha
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
