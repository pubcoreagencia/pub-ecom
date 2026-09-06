import FinancePage from "@/pages/dashboard/FinancePage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/finance")({
  component: FinancePage,
});
