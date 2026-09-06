import { createFileRoute } from "@tanstack/react-router";
import SEOPage from "@/pages/dashboard/SEOPage";

export const Route = createFileRoute("/dashboard/seo")({
  component: SEOPage,
});
