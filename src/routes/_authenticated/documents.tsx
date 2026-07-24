import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [
    { title: "Documents — FactoryOS AI" },
    { name: "description", content: "Documents shared with you" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Documents" sub="Documents shared with you" />,
});
