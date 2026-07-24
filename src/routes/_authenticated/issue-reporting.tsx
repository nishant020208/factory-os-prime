import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/issue-reporting")({
  head: () => ({ meta: [
    { title: "Report an Issue — FactoryOS AI" },
    { name: "description", content: "Report machine or quality issues" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Report an Issue" sub="Report machine or quality issues" />,
});
