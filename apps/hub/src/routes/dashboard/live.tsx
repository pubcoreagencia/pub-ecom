import { createFileRoute } from "@tanstack/react-router";
import LiveShopPage from "@/pages/dashboard/LiveShopPage";

export const Route = createFileRoute("/dashboard/live")({
  component: LiveShopPage,
});
