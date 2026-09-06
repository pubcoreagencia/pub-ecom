import { createFileRoute } from "@tanstack/react-router";
import { CatalogIngestion } from "@/pages/dashboard/suppliers/ingestion/CatalogIngestion";

export const Route = createFileRoute("/dashboard/ingestion")({
  component: CatalogIngestion,
});
