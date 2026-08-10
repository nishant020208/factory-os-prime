import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/budgets")({
  head: () => ({
    meta: [
      { title: "Budgets — FactoryOS AI" },
      { name: "description", content: "Departmental budgets and burn rate" },
    ],
  }),
  component: () => (
    <StubModule eyebrow="Module" title="Budgets" sub="Departmental budgets and burn rate" />
  ),
});
