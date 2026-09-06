import { createFileRoute } from "@tanstack/react-router";
import MarketingPage from "@/pages/dashboard/MarketingPage";

export const Route = createFileRoute("/dashboard/marketing")({
  component: MarketingPage,
});
