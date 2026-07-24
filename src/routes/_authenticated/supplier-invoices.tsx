import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/supplier-invoices")({
  head: () => ({ meta: [
    { title: "Invoices — FactoryOS AI" },
    { name: "description", content: "Invoices you have raised" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Invoices" sub="Invoices you have raised" />,
});
