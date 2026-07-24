import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/plants")({
  head: () => ({ meta: [
    { title: "Plants — FactoryOS AI" },
    { name: "description", content: "All plants belonging to your company" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Plants" sub="All plants belonging to your company" />,
});
