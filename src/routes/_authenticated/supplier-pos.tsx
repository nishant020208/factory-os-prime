import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/supplier-pos")({
  head: () => ({ meta: [
    { title: "Purchase Orders — FactoryOS AI" },
    { name: "description", content: "POs you have received from the buyer" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Purchase Orders" sub="POs you have received from the buyer" />,
});
