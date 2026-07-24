import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({ meta: [
    { title: "Employees — FactoryOS AI" },
    { name: "description", content: "Directory of all employees in your company" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Employees" sub="Directory of all employees in your company" />,
});
