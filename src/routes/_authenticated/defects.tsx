import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/defects")({
  head: () => ({ meta: [
    { title: "Defects — FactoryOS AI" },
    { name: "description", content: "Defect log, Pareto and root cause" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Defects" sub="Defect log, Pareto and root cause" />,
});
