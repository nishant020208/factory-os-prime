import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/compliance")({
  head: () => ({ meta: [
    { title: "Compliance — FactoryOS AI" },
    { name: "description", content: "Compliance checklists, certificates and audit trail" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Compliance" sub="Compliance checklists, certificates and audit trail" />,
});
