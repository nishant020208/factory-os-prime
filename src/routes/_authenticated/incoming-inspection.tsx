import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/incoming-inspection")({
  head: () => ({ meta: [
    { title: "Incoming Inspection — FactoryOS AI" },
    { name: "description", content: "Quality checks on inbound materials" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Incoming Inspection" sub="Quality checks on inbound materials" />,
});
