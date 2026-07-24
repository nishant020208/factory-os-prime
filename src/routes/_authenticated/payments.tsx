import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [
    { title: "Payments — FactoryOS AI" },
    { name: "description", content: "Payments received and pending" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Payments" sub="Payments received and pending" />,
});
