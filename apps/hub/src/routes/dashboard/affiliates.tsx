import { createFileRoute } from "@tanstack/react-router";
import AffiliatesPage from "@/pages/dashboard/AffiliatesPage";

export const Route = createFileRoute("/dashboard/affiliates")({
  component: AffiliatesPage,
});
