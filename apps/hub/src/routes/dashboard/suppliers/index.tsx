import { createFileRoute } from "@tanstack/react-router";
import SuppliersPage from "@/pages/dashboard/SuppliersPage";

export const Route = createFileRoute("/dashboard/suppliers/")({
  component: SuppliersPage,
});
