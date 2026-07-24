import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/finance-reports")({
  head: () => ({ meta: [
    { title: "Finance Reports — FactoryOS AI" },
    { name: "description", content: "Balance sheet, cash flow and P&L" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Finance Reports" sub="Balance sheet, cash flow and P&L" />,
});
