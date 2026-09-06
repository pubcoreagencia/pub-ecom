import { createFileRoute } from "@tanstack/react-router";
import InventoryPage from "@/pages/dashboard/InventoryPage";

export const Route = createFileRoute("/dashboard/inventory")({
  component: InventoryPage,
});
