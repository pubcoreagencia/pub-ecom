import { createFileRoute } from "@tanstack/react-router";
import ProductsPage from "@/pages/dashboard/ProductsPage";

export const Route = createFileRoute("/dashboard/products")({
  component: ProductsPage,
});
