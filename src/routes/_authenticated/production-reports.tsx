import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/production-reports")({
  head: () => ({
    meta: [
      { title: "Production Reports — FactoryOS AI" },
      { name: "description", content: "Downloadable production analytics" },
    ],
  }),
  component: () => (
    <StubModule
      eyebrow="Module"
      title="Production Reports"
      sub="Downloadable production analytics"
    />
  ),
});
