import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/production-logs")({
  head: () => ({ meta: [
    { title: "Production Logs — FactoryOS AI" },
    { name: "description", content: "Log completed units, downtime and scrap" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Production Logs" sub="Log completed units, downtime and scrap" />,
});
