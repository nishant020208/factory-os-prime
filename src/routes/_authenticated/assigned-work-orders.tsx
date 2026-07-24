import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/assigned-work-orders")({
  head: () => ({ meta: [
    { title: "My Work Orders — FactoryOS AI" },
    { name: "description", content: "Work orders assigned to you" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="My Work Orders" sub="Work orders assigned to you" />,
});
