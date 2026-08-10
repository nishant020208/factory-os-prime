import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/schedules")({
  head: () => ({
    meta: [
      { title: "Maintenance Schedules — FactoryOS AI" },
      { name: "description", content: "Preventive maintenance calendar" },
    ],
  }),
  component: () => (
    <StubModule
      eyebrow="Module"
      title="Maintenance Schedules"
      sub="Preventive maintenance calendar"
    />
  ),
});
