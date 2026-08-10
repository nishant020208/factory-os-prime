import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/maintenance-reports")({
  head: () => ({
    meta: [
      { title: "Maintenance Reports — FactoryOS AI" },
      { name: "description", content: "MTBF, MTTR and reliability analytics" },
    ],
  }),
  component: () => (
    <StubModule
      eyebrow="Module"
      title="Maintenance Reports"
      sub="MTBF, MTTR and reliability analytics"
    />
  ),
});
