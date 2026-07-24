import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/customer-invoices")({
  head: () => ({ meta: [
    { title: "My Invoices — FactoryOS AI" },
    { name: "description", content: "Outstanding and paid invoices" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="My Invoices" sub="Outstanding and paid invoices" />,
});
