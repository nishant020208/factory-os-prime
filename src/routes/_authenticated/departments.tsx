import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/departments")({
  head: () => ({ meta: [
    { title: "Departments — FactoryOS AI" },
    { name: "description", content: "Departments, hierarchy and reporting structure" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Departments" sub="Departments, hierarchy and reporting structure" />,
});
