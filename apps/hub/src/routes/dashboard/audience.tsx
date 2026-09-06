import { createFileRoute } from "@tanstack/react-router";
import AudiencePage from "@/pages/dashboard/AudiencePage";

export const Route = createFileRoute("/dashboard/audience")({
  component: AudiencePage,
});
