import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [
    { title: "Payroll — FactoryOS AI" },
    { name: "description", content: "Payroll runs, payslips and tax" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Payroll" sub="Payroll runs, payslips and tax" />,
});
