import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/hr-reports")({
  head: () => ({ meta: [
    { title: "HR Reports — FactoryOS AI" },
    { name: "description", content: "Headcount, attrition and payroll analytics" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="HR Reports" sub="Headcount, attrition and payroll analytics" />,
});
