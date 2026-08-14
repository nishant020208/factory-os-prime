import { createFileRoute } from "@tanstack/react-router";
import { OperatorWorkOrders } from "@/components/operator-workspace";

export const Route = createFileRoute("/_authenticated/assigned-work-orders")({
  head: () => ({
    meta: [
      { title: "My Work Orders — FactoryOS AI" },
      { name: "description", content: "Work orders assigned to you" },
    ],
  }),
  component: OperatorWorkOrders,
});
