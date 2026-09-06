import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import StoreDetailPage from "@/pages/dashboard/stores/StoreDetailPage";

export const Route = createFileRoute("/dashboard/stores/$storeId")({
  component: StoreDetailPage,
});
