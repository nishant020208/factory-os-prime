import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/in-process-inspection")({
  head: () => ({
    meta: [
      { title: "In-Process Inspection — FactoryOS AI" },
      { name: "description", content: "Quality checks during production" },
    ],
  }),
  component: () => (
    <StubModule
      eyebrow="Module"
      title="In-Process Inspection"
      sub="Quality checks during production"
    />
  ),
});
