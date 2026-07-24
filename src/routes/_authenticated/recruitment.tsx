import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/recruitment")({
  head: () => ({ meta: [
    { title: "Recruitment — FactoryOS AI" },
    { name: "description", content: "Open reqs, candidates and offers" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Recruitment" sub="Open reqs, candidates and offers" />,
});
