import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({ meta: [
    { title: "Invoices — FactoryOS AI" },
    { name: "description", content: "Customer invoices, AR aging and reminders" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Invoices" sub="Customer invoices, AR aging and reminders" />,
});
