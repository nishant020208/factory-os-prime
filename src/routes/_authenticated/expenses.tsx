import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — FactoryOS AI" },
      { name: "description", content: "Approved expenses and reimbursement" },
    ],
  }),
  component: () => (
    <StubModule eyebrow="Module" title="Expenses" sub="Approved expenses and reimbursement" />
  ),
});
