import { createFileRoute } from "@tanstack/react-router";
import BonificationsPage from "@/pages/dashboard/BonificationsPage";

export const Route = createFileRoute("/dashboard/bonifications")({
  component: BonificationsPage,
});
