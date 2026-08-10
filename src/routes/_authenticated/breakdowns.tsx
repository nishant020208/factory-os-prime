import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/breakdowns")({
  head: () => ({
    meta: [
      { title: "Breakdowns — FactoryOS AI" },
      { name: "description", content: "Machine breakdowns and downtime log" },
    ],
  }),
  component: () => (
    <StubModule eyebrow="Module" title="Breakdowns" sub="Machine breakdowns and downtime log" />
  ),
});
