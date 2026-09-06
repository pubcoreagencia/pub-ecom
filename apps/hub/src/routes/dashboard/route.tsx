import { createFileRoute } from "@tanstack/react-router";
import { DashboardGuard } from "@/components/auth/DashboardGuard";

export const Route = createFileRoute("/dashboard")({
  component: DashboardGuard,
});
