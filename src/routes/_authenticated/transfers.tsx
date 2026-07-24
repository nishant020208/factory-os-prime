import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/transfers")({
  head: () => ({ meta: [
    { title: "Transfers — FactoryOS AI" },
    { name: "description", content: "Inter-warehouse and inter-plant transfers" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Transfers" sub="Inter-warehouse and inter-plant transfers" />,
});
