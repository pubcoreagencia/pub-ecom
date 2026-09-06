import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexEntry,
});

function IndexEntry() {
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error || !data?.session?.user) {
          navigate({ to: "/login", replace: true });
        } else {
          navigate({ to: "/dashboard", replace: true });
        }
      })
      .catch(() => {
        if (isMounted) {
          navigate({ to: "/login", replace: true });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-red-500" />
    </div>
  );
}
