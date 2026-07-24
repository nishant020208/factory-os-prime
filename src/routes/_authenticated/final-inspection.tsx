import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/final-inspection")({
  head: () => ({ meta: [
    { title: "Final Inspection — FactoryOS AI" },
    { name: "description", content: "Final QC before dispatch" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Final Inspection" sub="Final QC before dispatch" />,
});
