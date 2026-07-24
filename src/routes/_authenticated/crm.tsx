import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [
    { title: "CRM — FactoryOS AI" },
    { name: "description", content: "Leads, opportunities and account activities" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="CRM" sub="Leads, opportunities and account activities" />,
});
