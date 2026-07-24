import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/work-orders")({
  head: () => ({ meta: [
    { title: "Work Orders — FactoryOS AI" },
    { name: "description", content: "Released work orders across all production lines" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Work Orders" sub="Released work orders across all production lines" />,
});
