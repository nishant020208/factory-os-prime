import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge Center — FactoryOS AI" },
      { name: "description", content: "Company knowledge base, SOPs and manuals" },
    ],
  }),
  component: () => (
    <StubModule
      eyebrow="Module"
      title="Knowledge Center"
      sub="Company knowledge base, SOPs and manuals"
    />
  ),
});
