import { createFileRoute } from "@tanstack/react-router";
import RankingPage from "@/pages/dashboard/RankingPage";

export const Route = createFileRoute("/dashboard/ranking")({
  component: RankingPage,
});
