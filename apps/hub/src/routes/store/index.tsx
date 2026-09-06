import StorePage from "@/pages/store/StorePage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/store/")({
  component: StorePage,
});
