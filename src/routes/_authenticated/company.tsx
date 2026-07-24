import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/company")({
  head: () => ({ meta: [
    { title: "Company — FactoryOS AI" },
    { name: "description", content: "Company profile, legal identity and corporate settings" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Company" sub="Company profile, legal identity and corporate settings" />,
});
