import React, { useEffect, useState } from "react";
import { useNavigate, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const DashboardGuard = () => {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData?.session) {
          if (isMounted) {
            navigate({ to: "/login" });
          }
          return;
        }

        const userId = sessionData.session.user.id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        const role = profile?.role || "LOJISTA";

        if (isMounted) {
          setUserRole(role);
          // Allow all authenticated operational users (MASTER, ADMIN, LOJISTA)
          setIsAuthorized(true);
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          navigate({ to: "/login" });
        }
      }
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        if (isMounted) {
          navigate({ to: "/login" });
        }
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020817] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#020817] text-white flex items-center justify-center p-4">
        <Card className="bg-[#0a0f1d] border-red-500/30 max-w-md w-full shadow-2xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg font-black uppercase tracking-wider text-red-400">
              Acesso Negado
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              O painel operacional exige permissões de administrador{" "}
              <strong className="text-white">MASTER</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-xs text-slate-400">
              Seu perfil atual é{" "}
              <span className="font-mono text-amber-400 font-bold">{userRole}</span>.
            </p>
            <Button
              variant="outline"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/login" });
              }}
              className="border-slate-800 hover:bg-red-500/10 hover:text-red-400 text-xs uppercase font-bold w-full"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair da Conta
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <Outlet />;
};
