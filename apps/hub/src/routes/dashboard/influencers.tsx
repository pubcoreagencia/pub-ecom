import { createFileRoute } from "@tanstack/react-router";
import InfluencersPage from "@/pages/dashboard/InfluencersPage";

export const Route = createFileRoute("/dashboard/influencers")({
  component: InfluencersPage,
});
