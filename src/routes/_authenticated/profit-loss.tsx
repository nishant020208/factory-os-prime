import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/profit-loss")({
  head: () => ({
    meta: [
      { title: "Profit & Loss — FactoryOS AI" },
      { name: "description", content: "P&L statement and variance" },
    ],
  }),
  component: () => (
    <StubModule eyebrow="Module" title="Profit & Loss" sub="P&L statement and variance" />
  ),
});
