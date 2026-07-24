import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/taxes")({
  head: () => ({ meta: [
    { title: "Taxes — FactoryOS AI" },
    { name: "description", content: "Tax filings, GST/VAT and compliance" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Taxes" sub="Tax filings, GST/VAT and compliance" />,
});
