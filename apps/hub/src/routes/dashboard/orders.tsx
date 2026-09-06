import { createFileRoute } from "@tanstack/react-router";
import OrdersPage from "@/pages/dashboard/OrdersPage";

export const Route = createFileRoute("/dashboard/orders")({
  component: OrdersPage,
});
