import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/quality-reports")({
  head: () => ({ meta: [
    { title: "Quality Reports — FactoryOS AI" },
    { name: "description", content: "First-pass yield, NCR and CAPA analytics" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Quality Reports" sub="First-pass yield, NCR and CAPA analytics" />,
});
