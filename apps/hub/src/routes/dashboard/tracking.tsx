import { createFileRoute } from "@tanstack/react-router";
import TrackingPage from "@/pages/dashboard/TrackingPage";

export const Route = createFileRoute("/dashboard/tracking")({
  component: TrackingPage,
});
