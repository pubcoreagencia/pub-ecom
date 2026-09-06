import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  CircleDollarSign,
  ArrowRight,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export const LoginPage = () => {
  const [mode, setMode] = useState<"login" | "recovery">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    // Check if session already exists and is valid
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        const session = data?.session;
        if (session?.user && session.access_token) {
          // Just checking if we have a session. If so, go to dashboard.
          // We removed the hardcoded vtcnundfslqqlxdyrogv check to support the official project.
          navigate({ to: "/dashboard" });
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => {
        if (isMounted) setCheckingSession(false);
      });

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Preencha o e-mail e a senha.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(
          error.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : error.message,
        );
        toast.error("Falha na autenticação.");
        setLoading(false);
        return;
      }

      if (data?.session) {
        toast.success("Login realizado com sucesso!");
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro inesperado ao realizar login.");
      toast.error("Erro de conexão ao autenticar.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Informe o e-mail cadastrado para recuperação.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) {
        setErrorMsg(error.message || "Não foi possível enviar o e-mail de recuperação.");
        toast.error("Erro ao solicitar recuperação.");
        setLoading(false);
        return;
      }

      setSuccessMsg(
        `Link de recuperação enviado com sucesso para ${email.trim()}. Verifique sua caixa de entrada e spam.`,
      );
      toast.success("E-mail de recuperação enviado!");
    } catch (err: any) {
      setErrorMsg(err?.message || "Falha ao processar solicitação de recuperação.");
      toast.error("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
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
            Acesso Operacional Master
          </p>
        </div>

        <Card className="bg-black border-red-500/20 shadow-2xl shadow-red-500/5">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-black uppercase tracking-wider text-white flex items-center justify-between">
              <span>{mode === "login" ? "Entrar no Sistema" : "Recuperar Acesso"}</span>
              {mode === "recovery" && <KeyRound className="w-5 h-5 text-red-500" />}
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              {mode === "login"
                ? "Informe suas credenciais para acessar o painel administrativo"
                : "Enviaremos um link para redefinir sua senha com segurança"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                    <Input
                      type="email"
                      placeholder="contato.pubcore@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="pl-10 bg-black/50 border-slate-800 text-white focus:border-red-500 h-11"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("recovery");
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-[10px] font-bold text-red-500 hover:text-red-400 hover:underline cursor-pointer uppercase tracking-wider"
                    >
                      Esqueci a senha
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="pl-10 bg-black/50 border-slate-800 text-white focus:border-red-500 h-11"
                      autoComplete="current-password"
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
                      Autenticando...
                    </>
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handlePasswordRecovery} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    E-mail Cadastrado
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                    <Input
                      type="email"
                      placeholder="contato.pubcore@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="pl-10 bg-black/50 border-slate-800 text-white focus:border-red-500 h-11"
                      autoComplete="email"
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

                {successMsg && (
                  <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-lg text-xs text-red-300 font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-red-500 shrink-0" />
                    <span>{successMsg}</span>
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
                      Enviando...
                    </>
                  ) : (
                    <>
                      Enviar Link de Recuperação
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="inline-flex items-center text-xs text-slate-400 hover:text-white font-bold cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                    Voltar para o Login
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-[10px] text-slate-500 uppercase font-mono">
            Origem Segura:{" "}
            {typeof window !== "undefined" ? window.location.hostname : "Cloudflare Workers"}
          </p>
        </div>
      </div>
    </div>
  );
};
