import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "My Tasks — FactoryOS AI" },
      { name: "description", content: "Daily tasks and completion status" },
    ],
  }),
  component: () => (
    <StubModule eyebrow="Module" title="My Tasks" sub="Daily tasks and completion status" />
  ),
});
