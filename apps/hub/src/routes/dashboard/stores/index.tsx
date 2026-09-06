import { createFileRoute } from "@tanstack/react-router";
import StoresPage from "@/pages/dashboard/StoresPage";

export const Route = createFileRoute("/dashboard/stores/")({
  component: StoresPage,
});
