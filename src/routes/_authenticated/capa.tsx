import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/capa")({
  head: () => ({ meta: [
    { title: "CAPA — FactoryOS AI" },
    { name: "description", content: "Corrective and preventive action tracking" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="CAPA" sub="Corrective and preventive action tracking" />,
});
