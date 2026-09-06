import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import SupplierDetailPage from "@/pages/dashboard/suppliers/SupplierDetailPage";

export const Route = createFileRoute("/dashboard/suppliers/$supplierId")({
  component: SupplierDetailPage,
});
